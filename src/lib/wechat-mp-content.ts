/**
 * 公众号已发表图文同步（官方 freepublish 接口）。
 * 使用与登录/支付同一套 AppID + AppSecret，换 client_credential access_token。
 */

import { prisma } from "@/lib/db";
import {
  clearWechatMediaSessionCache,
  mirrorWechatMediaUrl,
  rewriteMpContentImages,
} from "@/lib/wechat-mp-media";
import { getWechatOAuthConfig } from "@/lib/wechat-pay";

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

type WechatNewsItem = {
  title?: string;
  author?: string;
  digest?: string;
  content?: string;
  thumb_url?: string;
  url?: string;
  is_deleted?: boolean;
};

type FreepublishItem = {
  article_id?: string;
  update_time?: number;
  content?: { news_item?: WechatNewsItem[] };
};

/** 规范化微信文章 URL，便于合集条目匹配 */
export function normalizeWechatArticleUrl(url: string): string {
  const raw = (url || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    // 保留 host + pathname；去掉查询与 hash（签名参数常变）
    let path = u.pathname.replace(/\/+$/, "");
    if (!path) path = "/";
    return `${u.hostname.toLowerCase()}${path}`;
  } catch {
    return raw.split("?")[0].split("#")[0].replace(/\/+$/, "").toLowerCase();
  }
}

/**
 * 轻量消毒：去掉脚本与事件属性，保留图文常用标签。
 * 微信 CDN 图请在同步时用 rewriteMpContentImages 转存，勿直接给浏览器引用。
 */
export function sanitizeMpArticleHtml(html: string): string {
  let out = String(html || "");
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/javascript:/gi, "");
  out = out.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  return out.trim();
}

function wechatApiErrorMessage(errcode: number, errmsg: string) {
  if (errcode === 48001) {
    return "公众号未开通「发布」接口权限（需企业主体已认证）。请在公众平台开发者中心确认 freepublish 权限。";
  }
  if (errcode === 40001 || errcode === 42001) {
    return "access_token 无效或过期，请检查 AppID / AppSecret 后重试。";
  }
  if (errcode === 40125 || errcode === 40164) {
    return "AppSecret 错误或 IP 未加入白名单。";
  }
  return `微信接口错误 ${errcode}: ${errmsg || "未知错误"}`;
}

/** 服务端 client_credential；进程内缓存至到期前约 2 分钟 */
export async function getMpAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 120_000) {
    return tokenCache.token;
  }

  const cfg = await getWechatOAuthConfig();
  if (!cfg) {
    throw new Error(
      "未配置公众号 AppID / AppSecret。请在系统设置填写后再同步。",
    );
  }

  const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", cfg.appId);
  url.searchParams.set("secret", cfg.appSecret);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  };

  if (!data.access_token) {
    const code = data.errcode || 0;
    throw new Error(wechatApiErrorMessage(code, data.errmsg || ""));
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 7200) * 1000,
  };
  return data.access_token;
}

async function freepublishBatchGet(
  accessToken: string,
  offset: number,
  count: number,
  noContent = 0,
): Promise<{
  total_count: number;
  item_count: number;
  item: FreepublishItem[];
}> {
  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/freepublish/batchget?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offset, count, no_content: noContent }),
      cache: "no-store",
    },
  );
  const data = (await res.json()) as {
    total_count?: number;
    item_count?: number;
    item?: FreepublishItem[];
    errcode?: number;
    errmsg?: string;
  };
  if (data.errcode && data.errcode !== 0) {
    throw new Error(wechatApiErrorMessage(data.errcode, data.errmsg || ""));
  }
  return {
    total_count: data.total_count || 0,
    item_count: data.item_count || 0,
    item: data.item || [],
  };
}

async function freepublishGetArticle(
  accessToken: string,
  articleId: string,
): Promise<WechatNewsItem[]> {
  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/freepublish/getarticle?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ article_id: articleId }),
      cache: "no-store",
    },
  );
  const data = (await res.json()) as {
    news_item?: WechatNewsItem[];
    errcode?: number;
    errmsg?: string;
  };
  if (data.errcode && data.errcode !== 0) {
    throw new Error(wechatApiErrorMessage(data.errcode, data.errmsg || ""));
  }
  return data.news_item || [];
}

export type SyncArticlesResult = {
  upserted: number;
  totalFromWechat: number;
  pages: number;
};

/** 分页拉取已发表图文并 upsert 到本地（封面/正文图转存，规避微信防盗链） */
export async function syncPublishedArticles(): Promise<SyncArticlesResult> {
  clearWechatMediaSessionCache();
  const accessToken = await getMpAccessToken();
  let offset = 0;
  const pageSize = 20;
  let totalFromWechat = 0;
  let upserted = 0;
  let pages = 0;

  for (;;) {
    const batch = await freepublishBatchGet(accessToken, offset, pageSize, 0);
    pages += 1;
    totalFromWechat = batch.total_count;
    if (!batch.item.length) break;

    for (const entry of batch.item) {
      const articleId = (entry.article_id || "").trim();
      if (!articleId) continue;

      let newsItems = entry.content?.news_item || [];
      // 列表未带正文时补拉详情
      const needDetail = newsItems.some(
        (n) => !(n.content && String(n.content).trim()),
      );
      if (!newsItems.length || needDetail) {
        try {
          const detail = await freepublishGetArticle(accessToken, articleId);
          if (detail.length) newsItems = detail;
        } catch {
          // 详情失败时仍尽量保存列表字段
        }
      }

      const publishedAt =
        typeof entry.update_time === "number" && entry.update_time > 0
          ? new Date(entry.update_time * 1000)
          : null;

      for (let itemIndex = 0; itemIndex < newsItems.length; itemIndex += 1) {
        const news = newsItems[itemIndex]!;
        const wechatUrl = (news.url || "").trim();
        const wechatUrlKey = normalizeWechatArticleUrl(wechatUrl);
        const remoteThumb = (news.thumb_url || "").trim();
        const thumbUrl = (
          await mirrorWechatMediaUrl(remoteThumb)
        ).slice(0, 1000);
        const contentHtml = (
          await rewriteMpContentImages(
            sanitizeMpArticleHtml(news.content || ""),
          )
        ).slice(0, 500_000);
        await prisma.wechatMpArticle.upsert({
          where: {
            articleId_itemIndex: { articleId, itemIndex },
          },
          create: {
            articleId,
            itemIndex,
            title: (news.title || "").trim().slice(0, 200),
            author: (news.author || "").trim().slice(0, 80),
            digest: (news.digest || "").trim().slice(0, 500),
            contentHtml,
            thumbUrl,
            wechatUrl: wechatUrl.slice(0, 1000),
            wechatUrlKey,
            publishedAt,
            syncedAt: new Date(),
            isDeleted: Boolean(news.is_deleted),
          },
          update: {
            title: (news.title || "").trim().slice(0, 200),
            author: (news.author || "").trim().slice(0, 80),
            digest: (news.digest || "").trim().slice(0, 500),
            contentHtml,
            thumbUrl,
            wechatUrl: wechatUrl.slice(0, 1000),
            wechatUrlKey,
            publishedAt,
            syncedAt: new Date(),
            isDeleted: Boolean(news.is_deleted),
          },
        });
        upserted += 1;
      }
    }

    offset += batch.item_count;
    if (offset >= totalFromWechat || batch.item_count < pageSize) break;
    // 轻微节流，降低限流风险
    await new Promise((r) => setTimeout(r, 200));
  }

  return { upserted, totalFromWechat, pages };
}

export async function listLocalArticles(limit = 48) {
  return prisma.wechatMpArticle.findMany({
    where: { isDeleted: false },
    orderBy: [{ publishedAt: "desc" }, { syncedAt: "desc" }],
    take: Math.min(Math.max(limit, 1), 200),
  });
}

export async function getLocalArticleById(id: string) {
  return prisma.wechatMpArticle.findFirst({
    where: { id, isDeleted: false },
  });
}

/**
 * 公众号已发表推文同步（图文 news + 贴图/图片消息 newspic）。
 * 说明：
 * - freepublish 覆盖「发表」；开启群发通知的篇目用数据接口补链接再抓公开页。
 * - 永久「图文」素材仅在有公开 URL 时入库（去重）；绝不同步素材库里的单张图片。
 * - 「贴图」指文章类型 newspic，不是把推文配图拆成独立条目。
 */

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import {
  clearWechatMediaSessionCache,
  mirrorWechatMediaUrl,
  rewriteMpContentImages,
} from "@/lib/wechat-mp-media";
import { getWechatOAuthConfig } from "@/lib/wechat-pay";

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

/** 本站推文类型：news=图文文章，newspic=贴图（图片消息整篇） */
export type WechatMpContentKind = "news" | "newspic";

export function contentKindLabel(kind: string | null | undefined): string {
  return kind === "newspic" ? "贴图" : "文章";
}

type WechatNewsItem = {
  /** news=图文，newspic=贴图/图片消息（整篇推文，不是素材库单图） */
  article_type?: string;
  title?: string;
  author?: string;
  digest?: string;
  content?: string;
  thumb_url?: string;
  thumb_media_id?: string;
  url?: string;
  is_deleted?: boolean;
  image_info?: {
    image_list?: Array<{
      /** 接口字段名在不同版本可能是 image_media_id 或 media_id */
      image_media_id?: string;
      media_id?: string;
      url?: string;
    }>;
  };
  cover_info?: {
    crop_percent_list?: unknown;
  };
};

type FreepublishItem = {
  article_id?: string;
  update_time?: number;
  content?: { news_item?: WechatNewsItem[] };
};

/**
 * 规范化微信文章 URL，便于合集/去重匹配。
 * 注意：mp.weixin.qq.com/s 的唯一键在 query（__biz/mid/idx/sn），
 * 若只留 pathname 会把所有图文收成同一个键，导致漏同步、互相覆盖。
 */
export function normalizeWechatArticleUrl(url: string): string {
  const raw = (url || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    let path = u.pathname.replace(/\/+$/, "");
    if (!path) path = "/";

    if (host.includes("mp.weixin.qq.com") && (path === "/s" || path.startsWith("/s/"))) {
      const biz = u.searchParams.get("__biz") || "";
      const mid = u.searchParams.get("mid") || "";
      const idx = u.searchParams.get("idx") || "1";
      const sn = u.searchParams.get("sn") || "";
      // chksm 等会变，不纳入键
      if (biz || mid || sn) {
        return `${host}${path}?__biz=${biz}&mid=${mid}&idx=${idx}&sn=${sn}`;
      }
    }

    return `${host}${path}`;
  } catch {
    return raw.split("#")[0].replace(/\/+$/, "").toLowerCase();
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
  /** 各渠道 upsert 次数合计（含更新） */
  upserted: number;
  /** freepublish 发布记录条数 */
  totalFromWechat: number;
  pages: number;
  freepublishUpserted: number;
  /** 永久图文素材（仅有公开链的篇目） */
  materialUpserted: number;
  materialTotal: number;
  /** 已移除：素材库单图不再当作推文；保留字段兼容旧前端 */
  imageMaterialUpserted: number;
  imageMaterialTotal: number;
  /** 清理误入库的素材库单图条数 */
  purgedImageMaterials: number;
  /** 清理「同标题已有正文」的空壳 datacube/mass 条数 */
  purgedEmptyTitleStubs: number;
  /** 数据接口（发表详情 + 群发总数据）扫到的篇目入库/更新数 */
  notifiedUpserted: number;
  notifiedSeen: number;
  massHistoryUpserted: number;
  massHistorySeen: number;
  /** 对正文过短篇目补抓公开页 */
  bodyBackfillAttempted: number;
  bodyBackfillFilled: number;
  bodyBackfillFailed: number;
};

type UpsertNewsInput = {
  articleId: string;
  itemIndex: number;
  title: string;
  author?: string;
  digest?: string;
  contentHtml?: string;
  thumbUrl?: string;
  wechatUrl?: string;
  publishedAt?: Date | null;
  isDeleted?: boolean;
  /** news | newspic；缺省按正文结构推断 */
  contentKind?: WechatMpContentKind;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function articleIdFromUrlKey(urlKey: string): string {
  const hash = createHash("sha256")
    .update(urlKey || "empty")
    .digest("hex")
    .slice(0, 32);
  return `puburl_${hash}`;
}

function formatDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function decodeJsQuoted(raw: string): string {
  return raw
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
      String.fromCharCode(Number.parseInt(h, 16)),
    )
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) =>
      String.fromCharCode(Number.parseInt(h, 16)),
    )
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\\t/g, "\t")
    .replace(/\\\//g, "/")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/** 按标签深度截取 id=js_content 整块，避免内层 </div> 截断正文 */
function extractJsContentInnerHtml(html: string): string {
  const marker = /id=["']js_content["']/i.exec(html);
  if (!marker || marker.index == null) return "";
  const openGt = html.indexOf(">", marker.index);
  if (openGt < 0) return "";
  const start = openGt + 1;
  let depth = 1;
  const re = /<\/?div\b[^>]*>/gi;
  re.lastIndex = start;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    if (/^<\//.test(tag)) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(start, m.index);
      }
    } else if (!/\/>$/.test(tag)) {
      depth += 1;
    }
  }
  return "";
}

/**
 * 抓取公众号公开文章页（站长自有内容）。用于 freepublish 拿不到的「已群发通知」篇。
 */
export async function fetchPublicMpArticle(url: string): Promise<{
  title: string;
  digest: string;
  contentHtml: string;
  thumbUrl: string;
}> {
  // 微信公开页统一走 https，降低跳转/拦截失败
  const target = (url || "")
    .trim()
    .replace(/^http:\/\/mp\.weixin\.qq\.com/i, "https://mp.weixin.qq.com");
  if (!target) throw new Error("文章链接为空");

  const res = await fetch(target, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      Referer: "https://mp.weixin.qq.com/",
    },
    cache: "no-store",
    redirect: "follow",
  });
  const html = await res.text();
  if (!res.ok || !html) {
    throw new Error(`公开页拉取失败 HTTP ${res.status}`);
  }
  if (
    /环境异常|完成验证后即可继续|secitptpage|captcha/i.test(html) &&
    !/id=["']js_content["']/i.test(html)
  ) {
    throw new Error("公开页触发微信验证，暂无法抓取正文");
  }

  const pickMeta = (prop: string) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
      "i",
    );
    return (html.match(re)?.[1] || html.match(re2)?.[1] || "").trim();
  };
  const pickJs = (name: string) => {
    const re = new RegExp(
      `(?:var\\s+|window\\.|)${name}\\s*=\\s*['"]([\\s\\S]*?)['"]\\s*;`,
      "i",
    );
    const m = html.match(re);
    return m ? decodeJsQuoted(m[1] || "").trim() : "";
  };

  let contentHtml = extractJsContentInnerHtml(html);
  // 贴图页偶发用 js_image_content / 分享图列表
  if (contentHtml.trim().length < 40) {
    const imageBlock =
      extractNamedDivInnerHtml(html, "js_image_content") ||
      extractNamedDivInnerHtml(html, "js_content");
    if (imageBlock.trim().length > contentHtml.trim().length) {
      contentHtml = imageBlock;
    }
  }
  // 少数页正文在脚本字符串里
  if (contentHtml.trim().length < 40) {
    const fromVar =
      pickJs("msg_content") ||
      pickJs("content") ||
      pickJs("rich_media_content");
    if (fromVar.trim().length > contentHtml.trim().length) {
      contentHtml = fromVar;
    }
  }
  // 仍空时：收集页面 mmbiz 大图拼成贴图正文（整篇，不是拆条目）
  if (contentHtml.trim().length < 40) {
    const pageImgs = [
      ...html.matchAll(
        /(?:data-src|src)=["'](https?:\/\/[^"']*(?:qpic\.cn|qlogo\.cn)[^"']*)["']/gi,
      ),
    ]
      .map((m) => (m[1] || "").trim())
      .filter(Boolean);
    const uniq = Array.from(new Set(pageImgs)).slice(0, 20);
    if (uniq.length) {
      contentHtml = uniq
        .map((src) => `<p><img src="${src.replace(/"/g, "&quot;")}" alt="" /></p>`)
        .join("");
    }
  }

  const title =
    pickJs("msg_title") ||
    pickMeta("og:title") ||
    (html.match(/<title>([^<]*)<\/title>/i)?.[1] || "")
      .replace(/[-_|].*$/, "")
      .trim();
  const digest =
    pickJs("msg_desc") || pickMeta("og:description") || pickMeta("description");
  let thumbUrl =
    pickJs("msg_cdn_url") ||
    pickJs("cdn_url_1_1") ||
    pickMeta("og:image") ||
    "";
  if (!thumbUrl) {
    const firstImg = contentHtml.match(
      /(?:src)=["'](https?:\/\/[^"']+)["']/i,
    )?.[1];
    if (firstImg) thumbUrl = firstImg;
  }

  const cleaned = sanitizeMpArticleHtml(contentHtml).slice(0, 500_000);
  if (cleaned.trim().length < 20) {
    throw new Error("公开页未解析到正文（可能被微信拦截）");
  }

  return {
    title: title.slice(0, 200),
    digest: digest.slice(0, 500),
    contentHtml: cleaned,
    thumbUrl: thumbUrl.slice(0, 1000),
  };
}

/** 按 id 截取嵌套 div 内层 HTML（贴图页备用容器） */
function extractNamedDivInnerHtml(html: string, id: string): string {
  const marker = new RegExp(`id=["']${id}["']`, "i").exec(html);
  if (!marker || marker.index == null) return "";
  const openGt = html.indexOf(">", marker.index);
  if (openGt < 0) return "";
  const start = openGt + 1;
  let depth = 1;
  const re = /<\/?div\b[^>]*>/gi;
  re.lastIndex = start;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    if (/^<\//.test(tag)) {
      depth -= 1;
      if (depth === 0) return html.slice(start, m.index);
    } else if (!/\/>$/.test(tag)) {
      depth += 1;
    }
  }
  return "";
}

const THIN_BODY_CHARS = 80;

/**
 * 仅用于把贴图里的永久 media_id 解析成可下载 URL。
 * 不会把素材库单张图片当成推文入库。
 */
async function loadPermanentImageUrlMap(
  accessToken: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let offset = 0;
  for (;;) {
    const res = await fetch(
      `https://api.weixin.qq.com/cgi-bin/material/batchget_material?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "image", offset, count: 20 }),
        cache: "no-store",
      },
    );
    const data = (await res.json()) as {
      total_count?: number;
      item_count?: number;
      item?: Array<{ media_id?: string; url?: string; name?: string }>;
      errcode?: number;
    };
    if (data.errcode && data.errcode !== 0) break;
    const items = data.item || [];
    if (!items.length) break;
    for (const entry of items) {
      const mediaId = (entry.media_id || "").trim();
      const url = (entry.url || "").trim();
      if (mediaId && url) map.set(mediaId, url);
    }
    offset += data.item_count || items.length;
    if (offset >= (data.total_count || 0)) break;
    await sleep(120);
  }
  return map;
}

function resolveNewsImageUrls(
  news: WechatNewsItem,
  mediaUrlById: Map<string, string>,
): string[] {
  const list = news.image_info?.image_list || [];
  const urls: string[] = [];
  for (const img of list) {
    const direct = (img.url || "").trim();
    if (direct) {
      urls.push(direct);
      continue;
    }
    const mediaId = (img.image_media_id || img.media_id || "").trim();
    const mapped = mediaId ? mediaUrlById.get(mediaId) || "" : "";
    if (mapped) urls.push(mapped);
  }
  return urls;
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 把 freepublish/素材里的一条 news_item 规范成入库字段。
 * newspic（贴图）正文：说明文字 + image_info 图片列表；首图作封面。
 */
function normalizeNewsItemFields(
  news: WechatNewsItem,
  mediaUrlById: Map<string, string> = new Map(),
): {
  title: string;
  author: string;
  digest: string;
  contentHtml: string;
  thumbUrl: string;
  wechatUrl: string;
  isDeleted: boolean;
  contentKind: WechatMpContentKind;
} {
  const title = (news.title || "").trim();
  const author = (news.author || "").trim();
  const digest = (news.digest || "").trim();
  const wechatUrl = (news.url || "").trim();
  const isDeleted = Boolean(news.is_deleted);
  const rawContent = (news.content || "").trim();
  let contentHtml = rawContent;
  let thumbUrl = (news.thumb_url || "").trim();
  const imageUrls = resolveNewsImageUrls(news, mediaUrlById);

  const typeHint = (news.article_type || "").toLowerCase();
  // 贴图：微信标注 newspic，或带 image_info 图片列表的图片消息
  const isNewspic =
    typeHint === "newspic" ||
    (Boolean(news.image_info?.image_list?.length) &&
      typeHint !== "news" &&
      !/<p|<section|<div/i.test(rawContent));

  if (isNewspic) {
    // 贴图 content 多为纯文本说明，不是完整 HTML；图片在 image_info
    const caption = rawContent || digest;
    const imgs = imageUrls
      .map(
        (src) =>
          `<p><img src="${src.replace(/"/g, "&quot;")}" alt="${escapeHtmlText(title)}" /></p>`,
      )
      .join("");
    if (imgs) {
      contentHtml = caption
        ? `<p>${escapeHtmlText(caption)}</p>${imgs}`
        : imgs;
    } else if (caption && !/<img\b/i.test(rawContent)) {
      contentHtml = `<p>${escapeHtmlText(caption)}</p>`;
    }
    if (!thumbUrl && imageUrls[0]) thumbUrl = imageUrls[0];
  } else if (!thumbUrl && imageUrls[0]) {
    thumbUrl = imageUrls[0];
  }

  // 短图文常见「如图所示」但 content 无 <img>：把封面并进正文，站内才能看到图
  if (
    thumbUrl &&
    contentHtml &&
    !/<img\b/i.test(contentHtml) &&
    contentHtml.replace(/<[^>]+>/g, "").trim().length < 120
  ) {
    contentHtml = `${contentHtml}<p><img src="${thumbUrl.replace(/"/g, "&quot;")}" alt="${escapeHtmlText(title)}" /></p>`;
  }

  return {
    title,
    author,
    digest,
    contentHtml,
    thumbUrl,
    wechatUrl,
    isDeleted,
    contentKind: isNewspic ? "newspic" : "news",
  };
}

/**
 * 删除误把素材库单张图片当成「推文」入库的脏数据（articleId=img_* 等）。
 * 贴图文章本身不会被删——它们来自 freepublish/newspic，有正常标题与原文链。
 */
export async function purgeFalseImageMaterialArticles(): Promise<number> {
  const candidates = await prisma.wechatMpArticle.findMany({
    where: {
      OR: [
        { articleId: { startsWith: "img_" } },
        { digest: "贴图/图片素材" },
        // 素材库默认文件名，且不是公众号 /s 文章链
        { title: { startsWith: "upload" } },
      ],
    },
    select: {
      id: true,
      title: true,
      articleId: true,
      wechatUrl: true,
      digest: true,
    },
  });

  const ids = candidates
    .filter((row) => {
      if (row.articleId.startsWith("img_")) return true;
      if (row.digest === "贴图/图片素材") return true;
      if (
        /^upload\d+\.(png|jpe?g|gif|webp|bmp)$/i.test(row.title.trim()) &&
        !/mp\.weixin\.qq\.com\/s/i.test(row.wechatUrl || "")
      ) {
        return true;
      }
      return false;
    })
    .map((r) => r.id);

  if (!ids.length) return 0;
  const deleted = await prisma.wechatMpArticle.deleteMany({
    where: { id: { in: ids } },
  });
  return deleted.count;
}

/**
 * 仅清理「同一公开链」上的空壳重复：同标题不同 mid 是两次发表（如 4/8 原创与后来重发），绝不能按标题删。
 */
export async function purgeEmptyDuplicateTitleStubs(): Promise<number> {
  const rows = await prisma.wechatMpArticle.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      articleId: true,
      wechatUrlKey: true,
      contentHtml: true,
    },
  });

  const richKeys = new Set(
    rows
      .filter(
        (r) =>
          r.wechatUrlKey &&
          (r.contentHtml || "").trim().length >= THIN_BODY_CHARS,
      )
      .map((r) => r.wechatUrlKey),
  );

  const stubIds = rows
    .filter((r) => {
      if (!r.wechatUrlKey || !richKeys.has(r.wechatUrlKey)) return false;
      if ((r.contentHtml || "").trim().length >= THIN_BODY_CHARS) return false;
      return (
        r.articleId.startsWith("datacube_") ||
        r.articleId.startsWith("mass_")
      );
    })
    .map((r) => r.id);

  if (!stubIds.length) return 0;
  const deleted = await prisma.wechatMpArticle.deleteMany({
    where: { id: { in: stubIds } },
  });
  return deleted.count;
}

function isSyntheticArticleId(articleId: string): boolean {
  return /^(datacube_|mass_|img_|material_|url_)/.test(articleId);
}

/** 对已有链接但正文过短的图文：优先 freepublish API，再尝试公开页 */
export async function backfillThinArticleBodies(limit = 200): Promise<{
  attempted: number;
  filled: number;
  failed: number;
}> {
  const accessToken = await getMpAccessToken();
  const mediaUrlById = await loadPermanentImageUrlMap(accessToken);

  const rows = await prisma.wechatMpArticle.findMany({
    where: {
      isDeleted: false,
      wechatUrl: { not: "" },
    },
    select: {
      id: true,
      articleId: true,
      itemIndex: true,
      title: true,
      wechatUrl: true,
      contentHtml: true,
      author: true,
      digest: true,
      thumbUrl: true,
      publishedAt: true,
    },
    orderBy: { publishedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 500),
  });

  const thin = rows.filter(
    (r) => (r.contentHtml || "").trim().length < THIN_BODY_CHARS,
  );
  let filled = 0;
  let failed = 0;

  for (const row of thin) {
    try {
      let title = row.title;
      let digest = row.digest;
      let contentHtml = row.contentHtml || "";
      let thumbUrl = row.thumbUrl || "";
      let contentKind: WechatMpContentKind | undefined;

      // 真·发表 ID：走微信接口拿正文（不受公开页验证码影响）
      if (!isSyntheticArticleId(row.articleId)) {
        try {
          const detail = await freepublishGetArticle(
            accessToken,
            row.articleId,
          );
          const news = detail[row.itemIndex] || detail[0];
          if (news) {
            const fields = normalizeNewsItemFields(news, mediaUrlById);
            title = fields.title || title;
            digest = fields.digest || digest;
            contentHtml = fields.contentHtml || contentHtml;
            thumbUrl = fields.thumbUrl || thumbUrl;
            contentKind = fields.contentKind;
          }
        } catch {
          /* 再试公开页 */
        }
      }

      // 公开页常被服务器 IP 验证码拦截；失败时保留 freepublish 已拿到的短正文/封面
      if (contentHtml.trim().length < THIN_BODY_CHARS) {
        try {
          const scraped = await fetchPublicMpArticle(row.wechatUrl);
          title = scraped.title || title;
          digest = scraped.digest || digest;
          contentHtml = scraped.contentHtml || contentHtml;
          thumbUrl = scraped.thumbUrl || thumbUrl;
        } catch {
          /* 忽略 */
        }
      }

      if (
        contentHtml.trim().length < 20 &&
        thumbUrl &&
        !/<img\b/i.test(contentHtml)
      ) {
        contentHtml = `<p><img src="${thumbUrl.replace(/"/g, "&quot;")}" alt="${escapeHtmlText(title)}" /></p>`;
      }

      if (contentHtml.trim().length < 20 && !thumbUrl) {
        throw new Error("仍无正文");
      }

      if (!contentKind) {
        const textOnly = contentHtml
          .replace(/<img\b[^>]*>/gi, "")
          .replace(/<[^>]+>/g, "")
          .trim();
        contentKind =
          /<img\b/i.test(contentHtml) && textOnly.length < 80
            ? "newspic"
            : "news";
      }

      await upsertNewsItem({
        articleId: row.articleId,
        itemIndex: row.itemIndex,
        title,
        author: row.author || "",
        digest,
        contentHtml,
        thumbUrl,
        wechatUrl: row.wechatUrl,
        publishedAt: row.publishedAt,
        isDeleted: false,
        contentKind,
      });
      filled += 1;
    } catch {
      failed += 1;
    }
    await sleep(300);
  }

  return { attempted: thin.length, filled, failed };
}

async function upsertNewsItem(input: UpsertNewsInput): Promise<"created" | "updated"> {
  const wechatUrl = (input.wechatUrl || "").trim();
  const wechatUrlKey = normalizeWechatArticleUrl(wechatUrl);
  // 已有同链图文时复用其 articleId（含软删），避免同步再造一条复活到前台
  if (wechatUrlKey) {
    const byUrl =
      (await prisma.wechatMpArticle.findFirst({
        where: { wechatUrlKey, isDeleted: false },
        select: { articleId: true, itemIndex: true },
      })) ||
      (await prisma.wechatMpArticle.findFirst({
        where: { wechatUrlKey, isDeleted: true },
        select: { articleId: true, itemIndex: true },
      }));
    if (
      byUrl &&
      (byUrl.articleId !== input.articleId || byUrl.itemIndex !== input.itemIndex)
    ) {
      input = {
        ...input,
        articleId: byUrl.articleId,
        itemIndex: byUrl.itemIndex,
      };
    }
  }

  const remoteThumb = (input.thumbUrl || "").trim();
  const thumbUrl = remoteThumb
    ? (await mirrorWechatMediaUrl(remoteThumb)).slice(0, 1000)
    : "";
  const contentHtml = (
    await rewriteMpContentImages(sanitizeMpArticleHtml(input.contentHtml || ""))
  ).slice(0, 500_000);

  // 正文几乎只有图 → 贴图；否则默认文章。站长手动改过的类型在 update 时优先保留。
  const inferredKind: WechatMpContentKind =
    /<img\b/i.test(contentHtml) &&
    contentHtml.replace(/<img\b[^>]*>/gi, "").replace(/<[^>]+>/g, "").trim()
      .length < 40
      ? "newspic"
      : "news";

  const existing = await prisma.wechatMpArticle.findUnique({
    where: {
      articleId_itemIndex: {
        articleId: input.articleId,
        itemIndex: input.itemIndex,
      },
    },
    select: { id: true, isDeleted: true, contentKind: true },
  });

  const existingKind =
    existing?.contentKind === "newspic" || existing?.contentKind === "news"
      ? (existing.contentKind as WechatMpContentKind)
      : null;
  const contentKind: WechatMpContentKind =
    input.contentKind || existingKind || inferredKind;

  await prisma.wechatMpArticle.upsert({
    where: {
      articleId_itemIndex: {
        articleId: input.articleId,
        itemIndex: input.itemIndex,
      },
    },
    create: {
      articleId: input.articleId,
      itemIndex: input.itemIndex,
      title: (input.title || "").trim().slice(0, 200),
      author: (input.author || "").trim().slice(0, 80),
      digest: (input.digest || "").trim().slice(0, 500),
      contentHtml,
      thumbUrl,
      wechatUrl: wechatUrl.slice(0, 1000),
      wechatUrlKey,
      publishedAt: input.publishedAt ?? null,
      syncedAt: new Date(),
      isDeleted: Boolean(input.isDeleted),
      contentKind,
    },
    update: {
      title: (input.title || "").trim().slice(0, 200),
      author: (input.author || "").trim().slice(0, 80),
      digest: (input.digest || "").trim().slice(0, 500),
      // 公开页抓取失败时勿用空正文覆盖已有内容
      ...(contentHtml.trim()
        ? { contentHtml }
        : {}),
      ...(thumbUrl ? { thumbUrl } : {}),
      wechatUrl: wechatUrl.slice(0, 1000),
      wechatUrlKey,
      publishedAt: input.publishedAt ?? null,
      syncedAt: new Date(),
      // 站长软删后，同步只更新内容，不把已删篇目复活到前台
      isDeleted: existing?.isDeleted ? true : Boolean(input.isDeleted),
      // 显式传入或正文可判定为贴图时更新；否则保留站长手动类型
      ...(input.contentKind || inferredKind === "newspic"
        ? { contentKind: input.contentKind || inferredKind }
        : {}),
    },
  });
  return existing ? "updated" : "created";
}

async function syncFreepublishArticles(
  accessToken: string,
  mediaUrlById: Map<string, string>,
): Promise<{
  upserted: number;
  totalFromWechat: number;
  pages: number;
}> {
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
      // 贴图常无 HTML content，且 image_info 可能只有 media_id：一律拉详情补全
      const needDetail =
        !newsItems.length ||
        newsItems.some((n) => {
          const kind = (n.article_type || "").toLowerCase();
          const hasHtml = Boolean(n.content && String(n.content).trim());
          const hasThumb = Boolean((n.thumb_url || "").trim());
          const hasImgUrl = Boolean(
            n.image_info?.image_list?.some((img) => (img.url || "").trim()),
          );
          if (kind === "newspic") return !hasImgUrl || !hasThumb;
          return !hasHtml;
        });
      if (needDetail) {
        try {
          const detail = await freepublishGetArticle(accessToken, articleId);
          if (detail.length) newsItems = detail;
        } catch {
          /* 列表字段仍可入库 */
        }
      }

      const publishedAt =
        typeof entry.update_time === "number" && entry.update_time > 0
          ? new Date(entry.update_time * 1000)
          : null;

      for (let itemIndex = 0; itemIndex < newsItems.length; itemIndex += 1) {
        const news = newsItems[itemIndex]!;
        const fields = normalizeNewsItemFields(news, mediaUrlById);
        // 贴图仍缺图时，用公开页补封面/正文（不拆成单图条目）
        let contentHtml = fields.contentHtml;
        let thumbUrl = fields.thumbUrl;
        if (
          fields.contentKind === "newspic" &&
          fields.wechatUrl &&
          (contentHtml.trim().length < THIN_BODY_CHARS || !thumbUrl)
        ) {
          try {
            const scraped = await fetchPublicMpArticle(fields.wechatUrl);
            if (scraped.contentHtml.trim().length > contentHtml.trim().length) {
              contentHtml = scraped.contentHtml;
            }
            if (!thumbUrl && scraped.thumbUrl) thumbUrl = scraped.thumbUrl;
            await sleep(250);
          } catch {
            /* 保留接口字段 */
          }
        }
        await upsertNewsItem({
          articleId,
          itemIndex,
          title: fields.title,
          author: fields.author,
          digest: fields.digest,
          contentHtml,
          thumbUrl,
          wechatUrl: fields.wechatUrl,
          publishedAt,
          isDeleted: fields.isDeleted,
          contentKind: fields.contentKind,
        });
        upserted += 1;
      }
    }

    offset += batch.item_count;
    if (offset >= totalFromWechat || batch.item_count < pageSize) break;
    await sleep(200);
  }

  return { upserted, totalFromWechat, pages };
}

/** 从已入库链接推断公众号 __biz，用于拼群发历史文章 URL */
async function resolveMpBiz(): Promise<string> {
  const rows = await prisma.wechatMpArticle.findMany({
    where: { wechatUrl: { contains: "__biz=" } },
    select: { wechatUrl: true },
    take: 30,
    orderBy: { syncedAt: "desc" },
  });
  for (const row of rows) {
    try {
      const u = new URL(row.wechatUrl);
      const biz = u.searchParams.get("__biz") || "";
      if (biz) return biz;
    } catch {
      /* next */
    }
  }
  return "";
}

/** msgid 形如 2247485339_1 → mid + idx */
function parseMsgid(msgid: string): { mid: string; idx: string } | null {
  const raw = String(msgid || "").trim();
  if (!raw) return null;
  const parts = raw.split("_");
  if (parts.length < 2) return null;
  const idx = parts.pop() || "1";
  const mid = parts.join("_");
  if (!mid) return null;
  return { mid, idx };
}

function buildMpArticleUrl(biz: string, msgid: string): string {
  const parsed = parseMsgid(msgid);
  if (!biz || !parsed) return "";
  return `https://mp.weixin.qq.com/s?__biz=${encodeURIComponent(biz)}&mid=${encodeURIComponent(parsed.mid)}&idx=${encodeURIComponent(parsed.idx)}`;
}

/**
 * 永久图文素材：仅入库带公开文章链的篇目（与 freepublish 按 URL 去重）。
 * 刻意不同步 type=image 素材库——那是配图文件，不是「贴图」推文。
 */
async function syncMaterialNewsArticles(
  accessToken: string,
  mediaUrlById: Map<string, string>,
): Promise<{ upserted: number; total: number }> {
  let offset = 0;
  let total = 0;
  let upserted = 0;

  for (;;) {
    const res = await fetch(
      `https://api.weixin.qq.com/cgi-bin/material/batchget_material?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "news", offset, count: 20 }),
        cache: "no-store",
      },
    );
    const data = (await res.json()) as {
      total_count?: number;
      item_count?: number;
      item?: Array<{
        media_id?: string;
        name?: string;
        url?: string;
        update_time?: number;
        content?: { news_item?: WechatNewsItem[] };
      }>;
      errcode?: number;
      errmsg?: string;
    };
    if (data.errcode && data.errcode !== 0) break;
    total = data.total_count || 0;
    const items = data.item || [];
    if (!items.length) break;

    for (const entry of items) {
      const mediaId = (entry.media_id || "").trim();
      if (!mediaId) continue;
      const publishedAt =
        typeof entry.update_time === "number" && entry.update_time > 0
          ? new Date(entry.update_time * 1000)
          : null;

      const newsItems = entry.content?.news_item || [];
      for (let itemIndex = 0; itemIndex < newsItems.length; itemIndex += 1) {
        const news = newsItems[itemIndex]!;
        const fields = normalizeNewsItemFields(news, mediaUrlById);
        // 无公开链的草稿/本地素材不算「推文」，避免本地条数虚高
        if (!fields.wechatUrl || !/mp\.weixin\.qq\.com\/s/i.test(fields.wechatUrl)) {
          continue;
        }
        await upsertNewsItem({
          articleId: `material_${mediaId}`,
          itemIndex,
          title: fields.title,
          author: fields.author,
          digest: fields.digest,
          contentHtml: fields.contentHtml,
          thumbUrl: fields.thumbUrl,
          wechatUrl: fields.wechatUrl,
          publishedAt,
          isDeleted: fields.isDeleted,
          contentKind: fields.contentKind,
        });
        upserted += 1;
      }
    }

    offset += data.item_count || items.length;
    if (offset >= total) break;
    await sleep(200);
  }

  return { upserted, total };
}

type DatacubeArticleRow = {
  ref_date?: string;
  msgid?: string;
  publish_type?: number;
  title?: string;
  content_url?: string;
};

async function ingestDatacubeRow(input: {
  day: string;
  title: string;
  contentUrl: string;
  msgid: string;
  seen: number;
  biz: string;
}): Promise<boolean> {
  const title = input.title.trim();
  let contentUrl = input.contentUrl.trim();
  const msgid = input.msgid.trim();
  if (!title && !contentUrl && !msgid) return false;

  // 群发总数据接口常无 content_url：用 __biz + msgid 拼公开链
  if (!contentUrl && msgid && input.biz) {
    contentUrl = buildMpArticleUrl(input.biz, msgid);
  }

  const wechatUrlKey = normalizeWechatArticleUrl(contentUrl);
  const existingByUrl = wechatUrlKey
    ? await prisma.wechatMpArticle.findFirst({
        where: { wechatUrlKey },
        select: {
          id: true,
          articleId: true,
          itemIndex: true,
          contentHtml: true,
        },
      })
    : null;
  const existingByMsgid = !existingByUrl && msgid
    ? await prisma.wechatMpArticle.findFirst({
        where: {
          OR: [
            { articleId: `datacube_${msgid.replace(/[^\w.-]+/g, "_")}` },
            { articleId: `mass_${msgid.replace(/[^\w.-]+/g, "_")}` },
          ],
        },
        select: {
          id: true,
          articleId: true,
          itemIndex: true,
          contentHtml: true,
        },
      })
    : null;
  const existing = existingByUrl || existingByMsgid;

  let scraped = {
    title,
    digest: "",
    contentHtml: existing?.contentHtml || "",
    thumbUrl: "",
  };
  const needFetch =
    Boolean(contentUrl) &&
    !(existing?.contentHtml && existing.contentHtml.trim().length > 80);
  if (needFetch) {
    try {
      scraped = await fetchPublicMpArticle(contentUrl);
      if (!scraped.title) scraped.title = title;
    } catch {
      scraped = {
        title,
        digest: "",
        contentHtml: existing?.contentHtml || "",
        thumbUrl: "",
      };
    }
    await sleep(250);
  }

  const finalTitle = scraped.title || title || "未命名图文";
  // 注意：同标题不同 mid/链 是两篇推文（例如 4/8 原创与 8/8 重发），不得因同标题跳过入库

  const msgidIndex = msgid.includes("_")
    ? Number.parseInt(msgid.split("_").pop() || "0", 10)
    : 0;
  const articleId =
    existing?.articleId ||
    (msgid ? `datacube_${msgid.replace(/[^\w.-]+/g, "_")}` : "") ||
    (wechatUrlKey
      ? articleIdFromUrlKey(wechatUrlKey)
      : `datacube_${input.day}_${input.seen}`);

  const html = scraped.contentHtml || "";
  const textOnly = html
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
  // 群发补漏抓到的正文几乎只有图 → 贴图推文（整篇），不是素材库单图
  const kindFromBody: WechatMpContentKind | undefined =
    /<img\b/i.test(html) && textOnly.length < 40 ? "newspic" : undefined;

  await upsertNewsItem({
    articleId,
    itemIndex: existing
      ? existing.itemIndex
      : Number.isFinite(msgidIndex)
        ? msgidIndex
        : 0,
    title: finalTitle,
    digest: scraped.digest,
    contentHtml: scraped.contentHtml,
    thumbUrl: scraped.thumbUrl,
    wechatUrl: contentUrl,
    publishedAt: new Date(`${input.day}T12:00:00+08:00`),
    isDeleted: false,
    contentKind: kindFromBody,
  });
  return true;
}

/**
 * 发表内容详细数据：含「已群发通知 / 未通知」，自 2025-11-01 起有 title+链接。
 */
async function syncPublishDetailFromDatacube(
  accessToken: string,
  biz: string,
): Promise<{ upserted: number; seen: number }> {
  let upserted = 0;
  let seen = 0;

  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() - 1);
  const start = new Date("2025-11-01T00:00:00");
  if (start > end) return { upserted, seen };

  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const day = formatDateYmd(cursor);
    const res = await fetch(
      `https://api.weixin.qq.com/datacube/getarticletotaldetail?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ begin_date: day, end_date: day }),
        cache: "no-store",
      },
    );
    const data = (await res.json()) as {
      list?: DatacubeArticleRow[];
      errcode?: number;
    };
    if (data.errcode && data.errcode !== 0) {
      await sleep(80);
      continue;
    }
    for (const row of data.list || []) {
      seen += 1;
      const ok = await ingestDatacubeRow({
        day,
        title: row.title || "",
        contentUrl: row.content_url || "",
        msgid: String(row.msgid || ""),
        seen,
        biz,
      });
      if (ok) upserted += 1;
    }
    await sleep(100);
  }

  return { upserted, seen };
}

/**
 * 群发图文总数据（历史更长，自约 2014）：补 freepublish/发表详情拿不到的群发篇。
 * 按天扫，默认约 3 年；用 msgid + __biz 拼链再抓正文。
 */
async function syncMassHistoryFromDatacube(
  accessToken: string,
  biz: string,
  lookbackDays = 1200,
): Promise<{ upserted: number; seen: number }> {
  let upserted = 0;
  let seen = 0;

  // 发表详情接口自 2025-11-01 起更完整；此处分段扫更早的群发历史，避免重复抓页
  const end = new Date("2025-10-31T00:00:00");
  const start = new Date(end);
  start.setDate(start.getDate() - (lookbackDays - 1));
  const floor = new Date("2014-12-01T00:00:00");
  if (start < floor) start.setTime(floor.getTime());
  if (end < floor) return { upserted, seen };

  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const day = formatDateYmd(cursor);
    const res = await fetch(
      `https://api.weixin.qq.com/datacube/getarticletotal?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ begin_date: day, end_date: day }),
        cache: "no-store",
      },
    );
    const data = (await res.json()) as {
      list?: Array<{
        ref_date?: string;
        msgid?: string;
        title?: string;
      }>;
      errcode?: number;
    };
    if (data.errcode && data.errcode !== 0) {
      await sleep(60);
      continue;
    }
    for (const row of data.list || []) {
      seen += 1;
      const ok = await ingestDatacubeRow({
        day: row.ref_date || day,
        title: row.title || "",
        contentUrl: "",
        msgid: String(row.msgid || ""),
        seen,
        biz,
      });
      if (ok) upserted += 1;
    }
    await sleep(80);
  }

  return { upserted, seen };
}

/**
 * 全量同步：发表 freepublish（含 newspic 贴图推文）+ 有公开链的图文素材
 * + 发表详情/群发历史补漏 + 正文补抓。不同步素材库单张图片。
 */
export async function syncPublishedArticles(): Promise<SyncArticlesResult> {
  clearWechatMediaSessionCache();
  // 先清掉历史上误同步的素材库单图，避免列表被 upload*.png 污染
  const purgedImageMaterials = await purgeFalseImageMaterialArticles();

  const accessToken = await getMpAccessToken();
  // 贴图 image_info 常只有 media_id：用素材库 URL 表解析，绝不把单图当推文入库
  const mediaUrlById = await loadPermanentImageUrlMap(accessToken);
  const biz = await resolveMpBiz();

  const free = await syncFreepublishArticles(accessToken, mediaUrlById);
  // freepublish 后再解析 biz（可能刚写入带 __biz 的链接）
  const bizResolved = biz || (await resolveMpBiz());

  const materialNews = await syncMaterialNewsArticles(
    accessToken,
    mediaUrlById,
  );
  const publishDetail = await syncPublishDetailFromDatacube(
    accessToken,
    bizResolved,
  );
  const massHistory = await syncMassHistoryFromDatacube(
    accessToken,
    bizResolved,
  );

  // 元数据入库后补正文；再清同标题空壳，避免点进空白篇
  const bodyBackfill = await backfillThinArticleBodies(300);
  const purgedEmptyTitleStubs = await purgeEmptyDuplicateTitleStubs();

  return {
    upserted:
      free.upserted +
      materialNews.upserted +
      publishDetail.upserted +
      massHistory.upserted,
    totalFromWechat: free.totalFromWechat,
    pages: free.pages,
    freepublishUpserted: free.upserted,
    materialUpserted: materialNews.upserted,
    materialTotal: materialNews.total,
    imageMaterialUpserted: 0,
    imageMaterialTotal: 0,
    purgedImageMaterials,
    purgedEmptyTitleStubs,
    notifiedUpserted: publishDetail.upserted,
    notifiedSeen: publishDetail.seen,
    massHistoryUpserted: massHistory.upserted,
    massHistorySeen: massHistory.seen,
    bodyBackfillAttempted: bodyBackfill.attempted,
    bodyBackfillFilled: bodyBackfill.filled,
    bodyBackfillFailed: bodyBackfill.failed,
  };
}

/**
 * 前台/后台图文列表统一次序：置顶 → 手动 sortOrder → 发布时间。
 * 同步 upsert 不改 isPinned/isFeatured/sortOrder，站长设置得以保留。
 */
export const wechatMpArticleOrderBy = [
  { isPinned: "desc" as const },
  { sortOrder: "asc" as const },
  { publishedAt: "desc" as const },
  { syncedAt: "desc" as const },
];

export async function listLocalArticles(limit = 48) {
  return prisma.wechatMpArticle.findMany({
    where: { isDeleted: false },
    orderBy: wechatMpArticleOrderBy,
    take: Math.min(Math.max(limit, 1), 500),
  });
}

/** 站长改置顶/精华/类型；不碰 sortOrder */
export async function patchArticleFlags(
  id: string,
  patch: {
    isPinned?: boolean;
    isFeatured?: boolean;
    contentKind?: WechatMpContentKind;
  },
) {
  const row = await prisma.wechatMpArticle.findFirst({
    where: { id, isDeleted: false },
    select: { id: true },
  });
  if (!row) throw new Error("图文不存在或已删除");
  if (
    patch.isPinned === undefined &&
    patch.isFeatured === undefined &&
    patch.contentKind === undefined
  ) {
    throw new Error("未指定要更新的字段");
  }
  return prisma.wechatMpArticle.update({
    where: { id },
    data: {
      ...(patch.isPinned !== undefined ? { isPinned: patch.isPinned } : {}),
      ...(patch.isFeatured !== undefined
        ? { isFeatured: patch.isFeatured }
        : {}),
      ...(patch.contentKind !== undefined
        ? { contentKind: patch.contentKind }
        : {}),
    },
    select: {
      id: true,
      isPinned: true,
      isFeatured: true,
      sortOrder: true,
      contentKind: true,
    },
  });
}

/**
 * 站长从前台列表移除一篇已同步推文（软删）。
 * 同步不会复活；合集条目上的关联会因 onDelete:SetNull 断开。
 */
export async function softDeleteLocalArticle(id: string) {
  const row = await prisma.wechatMpArticle.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, title: true },
  });
  if (!row) throw new Error("图文不存在或已删除");
  await prisma.wechatMpArticle.update({
    where: { id },
    data: { isDeleted: true },
  });
  return { id: row.id, title: row.title };
}

/** @deprecated 请用 patchArticleFlags */
export async function setArticlePinned(id: string, isPinned: boolean) {
  return patchArticleFlags(id, { isPinned });
}

/** 按站长给定的 id 顺序写回 sortOrder（从 0 起） */
export async function reorderArticles(orderedIds: string[]) {
  const ids = Array.from(
    new Set(orderedIds.map((id) => id.trim()).filter(Boolean)),
  );
  if (!ids.length) throw new Error("排序列表为空");

  const existing = await prisma.wechatMpArticle.findMany({
    where: { id: { in: ids }, isDeleted: false },
    select: { id: true },
  });
  if (existing.length !== ids.length) {
    throw new Error("排序列表含无效或已删除的图文");
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.wechatMpArticle.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
  return { updated: ids.length };
}

export async function getLocalArticleById(id: string) {
  return prisma.wechatMpArticle.findFirst({
    where: { id, isDeleted: false },
  });
}

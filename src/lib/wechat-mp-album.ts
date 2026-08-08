/**
 * 公众号主页「合集/专辑」同步。
 * 微信未开放官方合集 API：站长粘贴合集链接后，拉取公开 appmsgalbum 列表，
 * 再与本站 freepublish 已同步图文按 URL 关联。
 */

import { prisma } from "@/lib/db";
import { normalizeWechatArticleUrl } from "@/lib/wechat-mp-content";
import {
  clearWechatMediaSessionCache,
  mirrorWechatMediaUrl,
} from "@/lib/wechat-mp-media";

export type ParsedAlbumUrl = {
  biz: string;
  albumId: string;
  sourceUrl: string;
};

/** 从合集页链接解析 __biz 与 album_id */
export function parseAlbumSourceUrl(raw: string): ParsedAlbumUrl {
  const text = (raw || "").trim();
  if (!text) throw new Error("请粘贴公众号合集链接");

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("合集链接格式无效，请粘贴完整 https://mp.weixin.qq.com/mp/appmsgalbum?... 链接");
  }

  if (!url.hostname.includes("mp.weixin.qq.com")) {
    throw new Error("请使用微信公众号合集链接（mp.weixin.qq.com）");
  }

  const biz =
    url.searchParams.get("__biz") ||
    url.searchParams.get("biz") ||
    "";
  const albumId =
    url.searchParams.get("album_id") ||
    url.searchParams.get("albumId") ||
    "";

  if (!biz || !albumId) {
    throw new Error(
      "链接中缺少 __biz 或 album_id。请在公众号主页打开合集后，复制地址栏完整链接。",
    );
  }

  return {
    biz,
    albumId,
    sourceUrl: url.toString().slice(0, 1000),
  };
}

type AlbumArticleRow = {
  title?: string;
  cover_img_1_1?: string;
  cover?: string;
  url?: string;
  msgid?: string | number;
  itemidx?: string | number;
};

type GetAlbumResp = {
  base_resp?: { ret?: number; err_msg?: string };
  title?: string;
  album_title?: string;
  cover_img_1_1?: string;
  cover?: string;
  article_list?: AlbumArticleRow[] | AlbumArticleRow;
  continue_flag?: string | number;
};

async function fetchAlbumPage(params: {
  biz: string;
  albumId: string;
  beginMsgid?: string;
  beginItemidx?: string;
  count?: number;
}): Promise<GetAlbumResp> {
  const url = new URL("https://mp.weixin.qq.com/mp/appmsgalbum");
  url.searchParams.set("action", "getalbum");
  url.searchParams.set("__biz", params.biz);
  url.searchParams.set("album_id", params.albumId);
  url.searchParams.set("count", String(params.count ?? 20));
  url.searchParams.set("is_reverse", "1");
  url.searchParams.set("f", "json");
  if (params.beginMsgid) {
    url.searchParams.set("begin_msgid", params.beginMsgid);
  }
  if (params.beginItemidx) {
    url.searchParams.set("begin_itemidx", params.beginItemidx);
  }

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json,text/plain,*/*",
      Referer: "https://mp.weixin.qq.com/",
    },
    cache: "no-store",
  });
  const text = await res.text();
  let data: { getalbum_resp?: GetAlbumResp; base_resp?: { ret?: number } };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error("合集接口返回非 JSON，请稍后重试或检查链接是否有效");
  }

  const resp = data.getalbum_resp;
  if (!resp) {
    throw new Error("未能读取合集内容，请确认链接来自本公众号主页合集");
  }
  const ret = resp.base_resp?.ret ?? data.base_resp?.ret ?? 0;
  if (ret !== 0) {
    throw new Error(
      `拉取合集失败（${ret}）：${resp.base_resp?.err_msg || "请检查链接或稍后重试"}`,
    );
  }
  return resp;
}

function asArticleArray(
  list: AlbumArticleRow[] | AlbumArticleRow | undefined,
): AlbumArticleRow[] {
  if (!list) return [];
  return Array.isArray(list) ? list : [list];
}

export type SyncAlbumResult = {
  albumLocalId: string;
  title: string;
  itemCount: number;
  matchedCount: number;
};

/** 新增或刷新一个合集，并与本地已同步图文匹配 */
export async function syncAlbumFromSourceUrl(
  sourceUrl: string,
): Promise<SyncAlbumResult> {
  clearWechatMediaSessionCache();
  const parsed = parseAlbumSourceUrl(sourceUrl);
  const articles: AlbumArticleRow[] = [];
  let title = "";
  let coverUrl = "";
  let beginMsgid = "";
  let beginItemidx = "";
  let page = 0;

  for (;;) {
    page += 1;
    const resp = await fetchAlbumPage({
      biz: parsed.biz,
      albumId: parsed.albumId,
      beginMsgid: beginMsgid || undefined,
      beginItemidx: beginItemidx || undefined,
      count: 20,
    });

    if (!title) {
      title = (resp.title || resp.album_title || "未命名合集").trim().slice(0, 200);
    }
    if (!coverUrl) {
      coverUrl = (resp.cover_img_1_1 || resp.cover || "").trim().slice(0, 1000);
    }

    const chunk = asArticleArray(resp.article_list);
    if (!chunk.length) break;
    articles.push(...chunk);

    const last = chunk[chunk.length - 1]!;
    const nextMsgid = last.msgid != null ? String(last.msgid) : "";
    const nextItemidx = last.itemidx != null ? String(last.itemidx) : "";
    const continueFlag = Number(resp.continue_flag || 0);
    if (!continueFlag || !nextMsgid || page >= 50) break;

    beginMsgid = nextMsgid;
    beginItemidx = nextItemidx || "1";
    await new Promise((r) => setTimeout(r, 400));
  }

  if (!articles.length && !title) {
    throw new Error("合集为空或无法读取，请确认链接正确");
  }

  // 用封面补全：取第一篇封面
  if (!coverUrl && articles[0]) {
    coverUrl = (
      articles[0].cover_img_1_1 ||
      articles[0].cover ||
      ""
    )
      .trim()
      .slice(0, 1000);
  }
  coverUrl = (await mirrorWechatMediaUrl(coverUrl)).slice(0, 1000);

  const localArticles = await prisma.wechatMpArticle.findMany({
    where: { isDeleted: false, wechatUrlKey: { not: "" } },
    select: { id: true, wechatUrlKey: true },
  });
  const byKey = new Map(localArticles.map((a) => [a.wechatUrlKey, a.id]));

  const existing = await prisma.wechatMpAlbum.findUnique({
    where: { albumId: parsed.albumId },
    select: { title: true },
  });
  const fromWechat = (title || "").trim() || "未命名合集";
  const prevTitle = (existing?.title || "").trim();
  // 站长已命名过的合集，刷新时保留本地标题，避免被微信空标题盖回「未命名合集」
  const nextTitle =
    prevTitle && prevTitle !== "未命名合集" ? prevTitle : fromWechat;

  const album = await prisma.wechatMpAlbum.upsert({
    where: { albumId: parsed.albumId },
    create: {
      albumId: parsed.albumId,
      biz: parsed.biz,
      title: nextTitle.slice(0, 200),
      coverUrl,
      sourceUrl: parsed.sourceUrl,
      syncedAt: new Date(),
    },
    update: {
      biz: parsed.biz,
      title: nextTitle.slice(0, 200),
      coverUrl,
      sourceUrl: parsed.sourceUrl,
      syncedAt: new Date(),
    },
  });

  await prisma.wechatMpAlbumItem.deleteMany({ where: { albumId: album.id } });

  let matchedCount = 0;
  const rows: {
    albumId: string;
    sortOrder: number;
    title: string;
    thumbUrl: string;
    wechatUrl: string;
    wechatUrlKey: string;
    articleLocalId: string | null;
  }[] = [];

  for (let index = 0; index < articles.length; index += 1) {
    const row = articles[index]!;
    const wechatUrl = (row.url || "").trim();
    const wechatUrlKey = normalizeWechatArticleUrl(wechatUrl);
    const articleLocalId = wechatUrlKey
      ? byKey.get(wechatUrlKey) || null
      : null;
    if (articleLocalId) matchedCount += 1;
    const remoteThumb = (row.cover_img_1_1 || row.cover || "").trim();
    const thumbUrl = (await mirrorWechatMediaUrl(remoteThumb)).slice(0, 1000);
    rows.push({
      albumId: album.id,
      sortOrder: index,
      title: (row.title || "").trim().slice(0, 200),
      thumbUrl,
      wechatUrl: wechatUrl.slice(0, 1000),
      wechatUrlKey,
      articleLocalId,
    });
  }

  if (rows.length) {
    await prisma.wechatMpAlbumItem.createMany({ data: rows });
  }

  return {
    albumLocalId: album.id,
    title: album.title,
    itemCount: rows.length,
    matchedCount,
  };
}

/** 刷新已保存合集 */
export async function refreshAlbumByLocalId(localId: string) {
  const album = await prisma.wechatMpAlbum.findUnique({ where: { id: localId } });
  if (!album) throw new Error("合集不存在");
  return syncAlbumFromSourceUrl(album.sourceUrl || "");
}

/** 站长自定义合集展示名（刷新同步不会覆盖非默认名） */
export async function renameAlbumByLocalId(localId: string, title: string) {
  const next = title.trim().slice(0, 200);
  if (!next) throw new Error("请填写合集名称");
  const album = await prisma.wechatMpAlbum.findUnique({
    where: { id: localId },
    select: { id: true },
  });
  if (!album) throw new Error("合集不存在");
  return prisma.wechatMpAlbum.update({
    where: { id: localId },
    data: { title: next },
    select: { id: true, title: true },
  });
}

export async function deleteAlbumByLocalId(localId: string) {
  await prisma.wechatMpAlbum.delete({ where: { id: localId } });
}

export async function listAlbumsWithCounts() {
  const albums = await prisma.wechatMpAlbum.findMany({
    orderBy: { syncedAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  return albums.map((a) => ({
    id: a.id,
    albumId: a.albumId,
    title: a.title,
    coverUrl: a.coverUrl,
    sourceUrl: a.sourceUrl,
    syncedAt: a.syncedAt,
    itemCount: a._count.items,
  }));
}

export async function getAlbumDetail(localId: string) {
  return prisma.wechatMpAlbum.findUnique({
    where: { id: localId },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          article: {
            select: {
              id: true,
              title: true,
              digest: true,
              thumbUrl: true,
              wechatUrl: true,
            },
          },
        },
      },
    },
  });
}

/** 合集条目重新匹配本地图文（同步图文后可调用） */
export async function rematchAllAlbumItems() {
  const localArticles = await prisma.wechatMpArticle.findMany({
    where: { isDeleted: false, wechatUrlKey: { not: "" } },
    select: { id: true, wechatUrlKey: true },
  });
  const byKey = new Map(localArticles.map((a) => [a.wechatUrlKey, a.id]));
  const items = await prisma.wechatMpAlbumItem.findMany({
    select: { id: true, wechatUrlKey: true },
  });
  let matched = 0;
  for (const item of items) {
    const articleLocalId = item.wechatUrlKey
      ? byKey.get(item.wechatUrlKey) || null
      : null;
    if (articleLocalId) matched += 1;
    await prisma.wechatMpAlbumItem.update({
      where: { id: item.id },
      data: { articleLocalId },
    });
  }
  return { itemCount: items.length, matchedCount: matched };
}

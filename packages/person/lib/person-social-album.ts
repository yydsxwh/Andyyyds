/**
 * 个人 IP 合集：对标公司介绍的公众号专辑。
 * B 站有公开合集/系列接口，同步主页时自动拉；其它平台没有对等官方列表，
 * 站长粘贴合集页链接后尽量解析公开页，再按作品 URL 对齐已同步投稿。
 */

import { prisma } from "@andyyyds/shared/db";
import {
  detectPersonSocialPlatform,
  normalizePersonSocialUrlKey,
  parseBilibiliMid,
  PERSON_SOCIAL_PLATFORM_LABEL,
  type PersonSocialAccounts,
  type PersonSocialPlatform,
} from "@andyyyds/person/lib/person-social";
import {
  extractScriptJson,
  fetchPersonSocialJson,
  fetchPersonSocialText,
  parseOgMeta,
  walkUnknownStrings,
} from "@andyyyds/person/lib/person-social-fetch";

export type PersonSocialAlbumDraftItem = {
  title: string;
  coverUrl: string;
  sourceUrl: string;
};

export type PersonSocialAlbumDraft = {
  platform: PersonSocialPlatform;
  externalId: string;
  title: string;
  coverUrl: string;
  sourceUrl: string;
  items: PersonSocialAlbumDraftItem[];
};

function httpsUrl(url: string) {
  return url.replace(/^http:\/\//i, "https://").slice(0, 800);
}

function parseBilibiliCollectionUrl(raw: string): {
  mid: string;
  kind: "season" | "series";
  id: string;
  sourceUrl: string;
} | null {
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (!url.hostname.includes("bilibili.com")) return null;
    const sid =
      url.searchParams.get("sid") ||
      url.searchParams.get("season_id") ||
      "";
    const seriesId = url.searchParams.get("series_id") || "";
    const lists = url.pathname.match(/\/lists\/(\d+)/);
    const mid =
      parseBilibiliMid(raw) ||
      url.pathname.match(/space\.bilibili\.com\/(\d+)/)?.[1] ||
      "";
    if (sid && mid) {
      return {
        mid,
        kind: "season",
        id: sid,
        sourceUrl: `https://space.bilibili.com/${mid}/channel/collectiondetail?sid=${sid}`,
      };
    }
    if (seriesId && mid) {
      return {
        mid,
        kind: "series",
        id: seriesId,
        sourceUrl: `https://space.bilibili.com/${mid}/lists/${seriesId}?type=series`,
      };
    }
    if (lists?.[1] && mid) {
      const type = (url.searchParams.get("type") || "").toLowerCase();
      return {
        mid,
        kind: type === "series" ? "series" : "season",
        id: lists[1],
        sourceUrl: url.toString().slice(0, 800),
      };
    }
  } catch {
    return null;
  }
  return null;
}

type BiliSeasonList = {
  data?: {
    items_lists?: {
      seasons_list?: Array<{
        meta?: {
          season_id?: number;
          name?: string;
          cover?: string;
          total?: number;
        };
      }>;
      series_list?: Array<{
        meta?: {
          series_id?: number;
          name?: string;
          cover?: string;
          total?: number;
        };
      }>;
    };
  };
};

type BiliSeasonArchives = {
  data?: {
    meta?: { name?: string; cover?: string };
    archives?: Array<{
      bvid?: string;
      title?: string;
      pic?: string;
    }>;
  };
};

type BiliSeriesArchives = {
  data?: {
    archives?: Array<{
      bvid?: string;
      title?: string;
      pic?: string;
    }>;
  };
};

async function fetchBilibiliSeasonDraft(
  mid: string,
  seasonId: string,
): Promise<PersonSocialAlbumDraft> {
  const payload = await fetchPersonSocialJson<BiliSeasonArchives>(
    `https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid=${mid}&season_id=${seasonId}&sort_reverse=false&page_num=1&page_size=100`,
    { referer: `https://space.bilibili.com/${mid}` },
  );
  const archives = payload.data?.archives || [];
  return {
    platform: "BILIBILI",
    externalId: `season:${seasonId}`,
    title: String(payload.data?.meta?.name || `B站合集 ${seasonId}`).slice(0, 200),
    coverUrl: httpsUrl(String(payload.data?.meta?.cover || archives[0]?.pic || "")),
    sourceUrl: `https://space.bilibili.com/${mid}/channel/collectiondetail?sid=${seasonId}`,
    items: archives
      .map((row) => {
        const bvid = String(row.bvid || "").trim();
        if (!bvid) return null;
        return {
          title: String(row.title || bvid).slice(0, 200),
          coverUrl: httpsUrl(String(row.pic || "")),
          sourceUrl: `https://www.bilibili.com/video/${bvid}`,
        };
      })
      .filter((row): row is PersonSocialAlbumDraftItem => Boolean(row)),
  };
}

async function fetchBilibiliSeriesDraft(
  mid: string,
  seriesId: string,
): Promise<PersonSocialAlbumDraft> {
  const payload = await fetchPersonSocialJson<BiliSeriesArchives>(
    `https://api.bilibili.com/x/series/archives?mid=${mid}&series_id=${seriesId}&only_normal=true&sort=desc&pn=1&ps=100`,
    { referer: `https://space.bilibili.com/${mid}` },
  );
  const archives = payload.data?.archives || [];
  return {
    platform: "BILIBILI",
    externalId: `series:${seriesId}`,
    title: `B站系列 ${seriesId}`,
    coverUrl: httpsUrl(String(archives[0]?.pic || "")),
    sourceUrl: `https://space.bilibili.com/${mid}/lists/${seriesId}?type=series`,
    items: archives
      .map((row) => {
        const bvid = String(row.bvid || "").trim();
        if (!bvid) return null;
        return {
          title: String(row.title || bvid).slice(0, 200),
          coverUrl: httpsUrl(String(row.pic || "")),
          sourceUrl: `https://www.bilibili.com/video/${bvid}`,
        };
      })
      .filter((row): row is PersonSocialAlbumDraftItem => Boolean(row)),
  };
}

export async function syncBilibiliAlbumsFromHome(
  accounts: PersonSocialAccounts,
): Promise<{ upserted: number; message: string }> {
  const mid = parseBilibiliMid(accounts.bilibili);
  if (!mid) return { upserted: 0, message: "" };
  const list = await fetchPersonSocialJson<BiliSeasonList>(
    `https://api.bilibili.com/x/polymer/web-space/seasons_series_list?mid=${mid}&page_num=1&page_size=20`,
    { referer: `https://space.bilibili.com/${mid}` },
  );
  const seasons = list.data?.items_lists?.seasons_list || [];
  const series = list.data?.items_lists?.series_list || [];
  let count = 0;
  for (const row of seasons) {
    const id = String(row.meta?.season_id || "").trim();
    if (!id) continue;
    const draft = await fetchBilibiliSeasonDraft(mid, id);
    if (row.meta?.name) draft.title = String(row.meta.name).slice(0, 200);
    if (row.meta?.cover) draft.coverUrl = httpsUrl(String(row.meta.cover));
    await upsertAlbumDraft(draft);
    count += 1;
  }
  for (const row of series) {
    const id = String(row.meta?.series_id || "").trim();
    if (!id) continue;
    const draft = await fetchBilibiliSeriesDraft(mid, id);
    if (row.meta?.name) draft.title = String(row.meta.name).slice(0, 200);
    if (row.meta?.cover) draft.coverUrl = httpsUrl(String(row.meta.cover));
    await upsertAlbumDraft(draft);
    count += 1;
  }
  return {
    upserted: count,
    message: count ? `B站合集 ${count} 个` : "B站主页没有可读合集",
  };
}

function collectGenericAlbumItems(node: unknown): PersonSocialAlbumDraftItem[] {
  const items: PersonSocialAlbumDraftItem[] = [];
  const seen = new Set<string>();
  walkUnknownStrings(node, (key, value, parent) => {
    if (
      key !== "url" &&
      key !== "link" &&
      key !== "share_url" &&
      key !== "shareUrl"
    ) {
      return;
    }
    const sourceUrl = String(value || "").trim();
    if (!/^https?:\/\//i.test(sourceUrl) || seen.has(sourceUrl)) return;
    const title = String(
      parent.title || parent.desc || parent.description || parent.name || "",
    ).trim();
    if (!title) return;
    seen.add(sourceUrl);
    const cover = String(
      parent.cover ||
        parent.pic ||
        parent.thumb ||
        parent.coverUrl ||
        parent.cover_url ||
        "",
    );
    items.push({
      title: title.slice(0, 200),
      coverUrl: httpsUrl(cover),
      sourceUrl: sourceUrl.slice(0, 800),
    });
  });
  return items.slice(0, 80);
}

async function scrapeAlbumFromPublicPage(
  sourceUrl: string,
  platform: PersonSocialPlatform,
): Promise<PersonSocialAlbumDraft> {
  const page = await fetchPersonSocialText(sourceUrl, { mobile: true });
  const state =
    extractScriptJson(page.text, "__NEXT_DATA__") ||
    extractScriptJson(page.text, "RENDER_DATA") ||
    extractScriptJson(page.text, "__INITIAL_STATE__");
  const items = collectGenericAlbumItems(state);
  const og = parseOgMeta(page.text, page.url);
  if (!items.length && !og.title) {
    throw new Error(
      "打不开这个合集的公开列表。请确认链接能在浏览器打开，或改用作品链接逐条导入。",
    );
  }
  const hostKey = normalizePersonSocialUrlKey(page.url) || page.url;
  return {
    platform,
    externalId: hostKey.slice(0, 80) || `${platform}:${Date.now()}`,
    title: og.title || `${PERSON_SOCIAL_PLATFORM_LABEL[platform]}合集`,
    coverUrl: httpsUrl(og.image || items[0]?.coverUrl || ""),
    sourceUrl: page.url.slice(0, 800),
    items,
  };
}

export async function addPersonSocialAlbumFromUrl(raw: string) {
  const url = raw.trim();
  if (!url) throw new Error("请粘贴合集链接");
  const bili = parseBilibiliCollectionUrl(url);
  if (bili) {
    const draft =
      bili.kind === "series"
        ? await fetchBilibiliSeriesDraft(bili.mid, bili.id)
        : await fetchBilibiliSeasonDraft(bili.mid, bili.id);
    return upsertAlbumDraft(draft);
  }
  const platform = detectPersonSocialPlatform(url);
  if (!platform) {
    throw new Error("无法识别合集平台。请粘贴 B站 / 抖音 / 小红书 / 视频号合集页链接。");
  }
  const draft = await scrapeAlbumFromPublicPage(url, platform);
  return upsertAlbumDraft(draft);
}

export async function refreshPersonSocialAlbum(id: string) {
  const row = await prisma.personSocialAlbum.findUnique({ where: { id } });
  if (!row) throw new Error("合集不存在");
  const saved = await addPersonSocialAlbumFromUrl(row.sourceUrl || "");
  return saved;
}

export async function renamePersonSocialAlbum(id: string, title: string) {
  const name = title.trim().slice(0, 80);
  if (!name) throw new Error("请填写合集名称");
  const row = await prisma.personSocialAlbum.findUnique({ where: { id } });
  if (!row) throw new Error("合集不存在");
  return prisma.personSocialAlbum.update({
    where: { id },
    data: { title: name },
  });
}

export async function deletePersonSocialAlbum(id: string) {
  const row = await prisma.personSocialAlbum.findUnique({ where: { id } });
  if (!row) throw new Error("合集不存在");
  await prisma.personSocialAlbum.delete({ where: { id } });
}

async function rematchAlbumItems(albumId: string) {
  const items = await prisma.personSocialAlbumItem.findMany({
    where: { albumId },
  });
  const posts = await prisma.personSocialPost.findMany({
    where: { isDeleted: false },
    select: { id: true, sourceUrl: true },
  });
  const byKey = new Map(
    posts.map((post) => [normalizePersonSocialUrlKey(post.sourceUrl), post.id]),
  );
  for (const item of items) {
    const key = item.sourceUrlKey || normalizePersonSocialUrlKey(item.sourceUrl);
    const postLocalId = byKey.get(key) || null;
    if (postLocalId === item.postLocalId) continue;
    await prisma.personSocialAlbumItem.update({
      where: { id: item.id },
      data: { postLocalId },
    });
  }
}

export async function rematchAllPersonSocialAlbums() {
  const albums = await prisma.personSocialAlbum.findMany({
    select: { id: true },
  });
  for (const album of albums) {
    await rematchAlbumItems(album.id);
  }
}

async function upsertAlbumDraft(draft: PersonSocialAlbumDraft) {
  const existing = await prisma.personSocialAlbum.findUnique({
    where: {
      platform_externalId: {
        platform: draft.platform,
        externalId: draft.externalId,
      },
    },
  });
  const album = existing
    ? await prisma.personSocialAlbum.update({
        where: { id: existing.id },
        data: {
          title: draft.title || existing.title,
          coverUrl: draft.coverUrl || existing.coverUrl,
          sourceUrl: draft.sourceUrl || existing.sourceUrl,
          syncedAt: new Date(),
        },
      })
    : await prisma.personSocialAlbum.create({
        data: {
          platform: draft.platform,
          externalId: draft.externalId,
          title: draft.title,
          coverUrl: draft.coverUrl,
          sourceUrl: draft.sourceUrl,
          syncedAt: new Date(),
        },
      });

  await prisma.personSocialAlbumItem.deleteMany({ where: { albumId: album.id } });
  if (draft.items.length) {
    await prisma.personSocialAlbumItem.createMany({
      data: draft.items.map((item, index) => ({
        albumId: album.id,
        sortOrder: index,
        title: item.title,
        coverUrl: item.coverUrl,
        sourceUrl: item.sourceUrl,
        sourceUrlKey: normalizePersonSocialUrlKey(item.sourceUrl),
      })),
    });
  }
  await rematchAlbumItems(album.id);
  return prisma.personSocialAlbum.findUniqueOrThrow({
    where: { id: album.id },
    include: { _count: { select: { items: true } } },
  });
}

export async function listPersonSocialAlbums() {
  return prisma.personSocialAlbum.findMany({
    orderBy: { syncedAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
}

export async function getPersonSocialAlbumDetail(id: string) {
  return prisma.personSocialAlbum.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          post: {
            select: {
              id: true,
              title: true,
              coverUrl: true,
              sourceUrl: true,
              isDeleted: true,
            },
          },
        },
      },
    },
  });
}

/**
 * 把 B站 / 抖音 / 小红书主页或作品链接同步进 PersonSocialPost。
 * B 站用公开投稿接口；抖音/小红书没有对等官方列表，先解析公开主页，不行再走 RSSHub，
 * 单条作品链接始终可导入（像公众号补一篇）。
 */

import { createHash } from "crypto";
import { prisma } from "@andyyyds/shared/db";
import {
  detectPersonSocialPlatform,
  parseBilibiliMid,
  parseDouyinUserId,
  parseXiaohongshuUserId,
  PERSON_SOCIAL_POST_ORDER_BY,
  splitPersonSocialUrls,
  type PersonSocialAccounts,
  type PersonSocialContentKind,
  type PersonSocialDraft,
  type PersonSocialPlatform,
} from "@andyyyds/person/lib/person-social";
import {
  extractScriptJson,
  fetchPersonSocialJson,
  fetchPersonSocialText,
  fetchRssHubItems,
  parseOgMeta,
  walkUnknownStrings,
} from "@andyyyds/person/lib/person-social-fetch";
import { getPersonSocialAccounts } from "@andyyyds/person/lib/person-social-settings";

const VIDEO_PAGE_SIZE = 30;
const MAX_BILI_PAGES = 8;
const MAX_IMPORT_URLS = 40;

const MIXIN_KEY_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33,
  9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26,
  17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34,
  44, 52,
];

function md5Hex(value: string) {
  return createHash("md5").update(value).digest("hex");
}

function mixinKey(orig: string) {
  return MIXIN_KEY_TAB.map((i) => orig[i] || "")
    .join("")
    .slice(0, 32);
}

function biliWbiQuery(
  params: Record<string, string | number>,
  imgKey: string,
  subKey: string,
) {
  const mixed = mixinKey(imgKey + subKey);
  const next: Record<string, string | number> = {
    ...params,
    wts: Math.round(Date.now() / 1000),
  };
  const query = Object.keys(next)
    .sort()
    .map((key) => {
      const value = String(next[key]).replace(/[!'()*]/g, "");
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join("&");
  return `${query}&w_rid=${md5Hex(query + mixed)}`;
}

let cachedWbi:
  | { imgKey: string; subKey: string; at: number }
  | null = null;

async function getBiliWbiKeys() {
  if (cachedWbi && Date.now() - cachedWbi.at < 50 * 60 * 1000) {
    return cachedWbi;
  }
  const nav = await fetchPersonSocialJson<{
    data?: { wbi_img?: { img_url?: string; sub_url?: string } };
  }>("https://api.bilibili.com/x/web-interface/nav");
  const imgUrl = nav.data?.wbi_img?.img_url || "";
  const subUrl = nav.data?.wbi_img?.sub_url || "";
  const imgKey = imgUrl.slice(imgUrl.lastIndexOf("/") + 1, imgUrl.lastIndexOf("."));
  const subKey = subUrl.slice(subUrl.lastIndexOf("/") + 1, subUrl.lastIndexOf("."));
  if (!imgKey || !subKey) throw new Error("B站签名密钥读取失败");
  cachedWbi = { imgKey, subKey, at: Date.now() };
  return cachedWbi;
}

function httpsUrl(url: string) {
  return url.replace(/^http:\/\//i, "https://").slice(0, 800);
}

type BiliSearchPage = {
  code?: number;
  message?: string;
  data?: {
    list?: {
      vlist?: Array<{
        bvid?: string;
        title?: string;
        description?: string;
        pic?: string;
        created?: number;
        typeid?: number;
      }>;
    };
  };
};

async function fetchBilibiliVideos(mid: string): Promise<PersonSocialDraft[]> {
  const keys = await getBiliWbiKeys();
  const drafts: PersonSocialDraft[] = [];
  for (let pn = 1; pn <= MAX_BILI_PAGES; pn += 1) {
    const query = biliWbiQuery(
      {
        mid,
        ps: VIDEO_PAGE_SIZE,
        pn,
        order: "pubdate",
        platform: "web",
        web_location: 1550101,
      },
      keys.imgKey,
      keys.subKey,
    );
    const payload = await fetchPersonSocialJson<BiliSearchPage>(
      `https://api.bilibili.com/x/space/wbi/arc/search?${query}`,
      { referer: `https://space.bilibili.com/${mid}` },
    );
    if (payload.code && payload.code !== 0) {
      throw new Error(payload.message || `B站投稿接口 ${payload.code}`);
    }
    const list = payload.data?.list?.vlist || [];
    if (!list.length) break;
    for (const item of list) {
      const bvid = String(item.bvid || "").trim();
      if (!bvid) continue;
      drafts.push({
        platform: "BILIBILI",
        externalId: bvid,
        title: String(item.title || bvid).trim().slice(0, 200),
        digest: String(item.description || "").trim().slice(0, 500),
        coverUrl: httpsUrl(String(item.pic || "")),
        sourceUrl: `https://www.bilibili.com/video/${bvid}`,
        contentKind: "video",
        publishedAt: item.created
          ? new Date(item.created * 1000)
          : null,
      });
    }
    if (list.length < VIDEO_PAGE_SIZE) break;
  }
  return drafts;
}

type BiliArticlePage = {
  code?: number;
  data?: {
    articles?: Array<{
      id?: number;
      title?: string;
      summary?: string;
      image_urls?: string[];
      publish_time?: number;
    }>;
  };
};

async function fetchBilibiliArticles(mid: string): Promise<PersonSocialDraft[]> {
  const drafts: PersonSocialDraft[] = [];
  for (let pn = 1; pn <= 4; pn += 1) {
    const payload = await fetchPersonSocialJson<BiliArticlePage>(
      `https://api.bilibili.com/x/space/article?mid=${mid}&pn=${pn}&ps=30&sort=publish_time`,
      { referer: `https://space.bilibili.com/${mid}` },
    );
    if (payload.code && payload.code !== 0) break;
    const list = payload.data?.articles || [];
    if (!list.length) break;
    for (const item of list) {
      const id = String(item.id || "").trim();
      if (!id) continue;
      drafts.push({
        platform: "BILIBILI",
        externalId: `cv${id}`,
        title: String(item.title || `专栏 ${id}`).trim().slice(0, 200),
        digest: String(item.summary || "").trim().slice(0, 500),
        coverUrl: httpsUrl(String(item.image_urls?.[0] || "")),
        sourceUrl: `https://www.bilibili.com/read/cv${id}`,
        contentKind: "article",
        publishedAt: item.publish_time
          ? new Date(item.publish_time * 1000)
          : null,
      });
    }
    if (list.length < 30) break;
  }
  return drafts;
}

async function syncBilibili(
  accounts: PersonSocialAccounts,
): Promise<{ upserted: number; message: string }> {
  const mid = parseBilibiliMid(accounts.bilibili);
  if (!mid) return { upserted: 0, message: "未填写 B 站主页或 UID" };
  try {
    const [videos, articles] = await Promise.all([
      fetchBilibiliVideos(mid),
      fetchBilibiliArticles(mid).catch(() => [] as PersonSocialDraft[]),
    ]);
    const drafts = [...videos, ...articles];
    if (!drafts.length) {
      const rss = await fetchRssHubFallback(
        accounts.rsshubBaseUrl,
        `/bilibili/user/video/${mid}`,
        "BILIBILI",
        "video",
      );
      const count = await upsertDrafts(rss);
      return {
        upserted: count,
        message: count
          ? `B站公开接口为空，已从 RSS 同步 ${count} 条`
          : "B站主页没有可读投稿",
      };
    }
    const count = await upsertDrafts(drafts);
    return {
      upserted: count,
      message: `B站 ${videos.length} 条视频、${articles.length} 篇专栏，入库 ${count}`,
    };
  } catch (error) {
    const rss = await fetchRssHubFallback(
      accounts.rsshubBaseUrl,
      `/bilibili/user/video/${mid}`,
      "BILIBILI",
      "video",
    );
    if (rss.length) {
      const count = await upsertDrafts(rss);
      return {
        upserted: count,
        message: `B站接口受限，已从 RSS 同步 ${count} 条`,
      };
    }
    throw error;
  }
}

async function fetchRssHubFallback(
  rsshubBaseUrl: string,
  routePath: string,
  platform: PersonSocialPlatform,
  contentKind: PersonSocialContentKind,
): Promise<PersonSocialDraft[]> {
  try {
    const items = await fetchRssHubItems(rsshubBaseUrl, routePath);
    return items.map((item) => ({
      platform,
      externalId: externalIdFromUrl(platform, item.url),
      title: item.title,
      digest: item.summary,
      coverUrl: httpsUrl(item.image),
      sourceUrl: item.url,
      contentKind,
      publishedAt: item.publishedAt,
    })).filter((item) => item.externalId);
  } catch {
    return [];
  }
}

function externalIdFromUrl(platform: PersonSocialPlatform, url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (platform === "BILIBILI") {
      const bv = path.match(/\/video\/(BV[\w]+)/i);
      if (bv?.[1]) return bv[1];
      const cv = path.match(/\/read\/cv(\d+)/i);
      if (cv?.[1]) return `cv${cv[1]}`;
    }
    if (platform === "DOUYIN") {
      const video = path.match(/\/(?:video|note|share\/video)\/(\d+)/i);
      if (video?.[1]) return video[1];
    }
    if (platform === "XIAOHONGSHU") {
      const note = path.match(
        /\/(?:explore|discovery\/item|item)\/([a-z0-9]+)/i,
      );
      if (note?.[1]) return note[1];
      const queryId = parsed.searchParams.get("noteId");
      if (queryId) return queryId;
    }
  } catch {
    // fall through
  }
  return md5Hex(`${platform}:${url}`).slice(0, 24);
}

function collectDouyinAwemes(node: unknown): PersonSocialDraft[] {
  const drafts: PersonSocialDraft[] = [];
  const seen = new Set<string>();
  walkUnknownStrings(node, (key, value, parent) => {
    if (key !== "aweme_id" && key !== "awemeId") return;
    const id = String(value || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    const desc = String(
      parent.desc || parent.description || parent.caption || "",
    ).trim();
    let cover = "";
    const video = parent.video as
      | { cover?: { url_list?: string[] }; origin_cover?: { url_list?: string[] } }
      | undefined;
    cover =
      video?.cover?.url_list?.[0] ||
      video?.origin_cover?.url_list?.[0] ||
      "";
    if (!cover) {
      const images = parent.video_info as { cover?: string } | undefined;
      cover = images?.cover || "";
    }
    drafts.push({
      platform: "DOUYIN",
      externalId: id,
      title: (desc || `抖音作品 ${id}`).slice(0, 200),
      digest: desc.slice(0, 500),
      coverUrl: httpsUrl(cover),
      sourceUrl: `https://www.douyin.com/video/${id}`,
      contentKind: "video",
      publishedAt: parent.create_time
        ? new Date(Number(parent.create_time) * 1000)
        : null,
    });
  });
  return drafts;
}

async function syncDouyin(
  accounts: PersonSocialAccounts,
): Promise<{ upserted: number; message: string }> {
  const raw = accounts.douyin.trim();
  if (!raw) return { upserted: 0, message: "未填写抖音主页" };
  const userId = parseDouyinUserId(raw);
  const profileUrl = raw.startsWith("http")
    ? raw
    : userId.startsWith("MS4w")
      ? `https://www.douyin.com/user/${userId}`
      : `https://www.douyin.com/user/${userId}`;

  try {
    const page = await fetchPersonSocialText(profileUrl, { mobile: true });
    const render = extractScriptJson(page.text, "RENDER_DATA");
    const fromPage = collectDouyinAwemes(render);
    if (fromPage.length) {
      const count = await upsertDrafts(fromPage);
      return { upserted: count, message: `抖音主页解析 ${fromPage.length} 条，入库 ${count}` };
    }
  } catch {
    // 公开页经常要登录态，下面走 RSSHub
  }

  const rss = await fetchRssHubFallback(
    accounts.rsshubBaseUrl,
    `/douyin/user/${encodeURIComponent(userId)}`,
    "DOUYIN",
    "video",
  );
  if (rss.length) {
    const count = await upsertDrafts(rss);
    return { upserted: count, message: `抖音经 RSS 同步 ${count} 条` };
  }
  return {
    upserted: 0,
    message:
      "抖音主页列表未能自动拉取（平台有登录墙）。请改用下方「粘贴作品链接导入」，或自建 RSSHub 填进地址。",
  };
}

function collectXhsNotes(node: unknown): PersonSocialDraft[] {
  const drafts: PersonSocialDraft[] = [];
  const seen = new Set<string>();
  walkUnknownStrings(node, (key, value, parent) => {
    if (key !== "noteId" && key !== "id" && key !== "note_id") return;
    const id = String(value || "").trim();
    if (!/^[a-z0-9]{16,32}$/i.test(id) || seen.has(id)) return;
    const title = String(
      parent.displayTitle || parent.title || parent.desc || "",
    ).trim();
    if (!title && key === "id") return;
    seen.add(id);
    let cover = "";
    const images = parent.imagesList || parent.imageList || parent.images;
    if (Array.isArray(images) && images[0] && typeof images[0] === "object") {
      const first = images[0] as Record<string, unknown>;
      cover = String(first.url || first.urlDefault || first.traceId || "");
    }
    const coverObj = parent.cover as
      | { url?: string; urlDefault?: string }
      | undefined;
    cover = cover || String(coverObj?.url || coverObj?.urlDefault || "");
    drafts.push({
      platform: "XIAOHONGSHU",
      externalId: id,
      title: (title || `小红书笔记 ${id}`).slice(0, 200),
      digest: String(parent.desc || parent.type || "").trim().slice(0, 500),
      coverUrl: httpsUrl(cover),
      sourceUrl: `https://www.xiaohongshu.com/explore/${id}`,
      contentKind: "note",
      publishedAt: parent.time
        ? new Date(Number(parent.time))
        : null,
    });
  });
  return drafts;
}

async function syncXiaohongshu(
  accounts: PersonSocialAccounts,
): Promise<{ upserted: number; message: string }> {
  const raw = accounts.xiaohongshu.trim();
  if (!raw) return { upserted: 0, message: "未填写小红书主页" };
  const userId = parseXiaohongshuUserId(raw);
  const profileUrl = raw.startsWith("http")
    ? raw
    : userId
      ? `https://www.xiaohongshu.com/user/profile/${userId}`
      : "";
  if (profileUrl) {
    try {
      const page = await fetchPersonSocialText(profileUrl, { mobile: true });
      const state =
        extractScriptJson(page.text, "__NEXT_DATA__") ||
        (() => {
          const match = page.text.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
          if (!match?.[1]) return null;
          try {
            return JSON.parse(match[1]);
          } catch {
            return null;
          }
        })();
      const fromPage = collectXhsNotes(state);
      if (fromPage.length) {
        const count = await upsertDrafts(fromPage);
        return {
          upserted: count,
          message: `小红书主页解析 ${fromPage.length} 条，入库 ${count}`,
        };
      }
    } catch {
      // 下面 RSSHub
    }
  }
  if (userId) {
    const rss = await fetchRssHubFallback(
      accounts.rsshubBaseUrl,
      `/xiaohongshu/user/${userId}/notes`,
      "XIAOHONGSHU",
      "note",
    );
    if (rss.length) {
      const count = await upsertDrafts(rss);
      return { upserted: count, message: `小红书经 RSS 同步 ${count} 条` };
    }
  }
  return {
    upserted: 0,
    message:
      "小红书主页列表未能自动拉取。请打开笔记点分享，把链接贴到「粘贴作品链接导入」。",
  };
}

async function ingestDouyinUrl(url: string): Promise<PersonSocialDraft> {
  const page = await fetchPersonSocialText(url, { mobile: true });
  const idMatch =
    page.url.match(/\/(?:video|note|share\/video)\/(\d+)/i) ||
    page.text.match(/"aweme_id"\s*:\s*"(\d+)"/);
  const awemeId = idMatch?.[1] || "";
  if (awemeId) {
    try {
      const info = await fetchPersonSocialJson<{
        item_list?: Array<{
          aweme_id?: string;
          desc?: string;
          video?: { cover?: { url_list?: string[] } };
          create_time?: number;
        }>;
      }>(
        `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${awemeId}`,
        { mobile: true, referer: "https://www.douyin.com/" },
      );
      const item = info.item_list?.[0];
      if (item) {
        const desc = String(item.desc || "").trim();
        return {
          platform: "DOUYIN",
          externalId: String(item.aweme_id || awemeId),
          title: (desc || `抖音作品 ${awemeId}`).slice(0, 200),
          digest: desc.slice(0, 500),
          coverUrl: httpsUrl(item.video?.cover?.url_list?.[0] || ""),
          sourceUrl: `https://www.douyin.com/video/${awemeId}`,
          contentKind: "video",
          publishedAt: item.create_time
            ? new Date(item.create_time * 1000)
            : null,
        };
      }
    } catch {
      // og 兜底
    }
  }
  const og = parseOgOrThrow(await fetchOgFromResolved(page.url, page.text));
  return {
    platform: "DOUYIN",
    externalId: awemeId || externalIdFromUrl("DOUYIN", page.url),
    title: og.title || "抖音作品",
    digest: og.description,
    coverUrl: httpsUrl(og.image),
    sourceUrl: page.url,
    contentKind: "video",
    publishedAt: null,
  };
}

async function ingestBilibiliUrl(url: string): Promise<PersonSocialDraft> {
  const page = await fetchPersonSocialText(url, { mobile: false });
  const bv = page.url.match(/\/video\/(BV[\w]+)/i)?.[1];
  const cv = page.url.match(/\/read\/cv(\d+)/i)?.[1];
  if (bv) {
    const view = await fetchPersonSocialJson<{
      code?: number;
      data?: {
        bvid?: string;
        title?: string;
        desc?: string;
        pic?: string;
        pubdate?: number;
      };
    }>(`https://api.bilibili.com/x/web-interface/view?bvid=${bv}`);
    const data = view.data;
    if (data?.bvid) {
      return {
        platform: "BILIBILI",
        externalId: data.bvid,
        title: String(data.title || bv).slice(0, 200),
        digest: String(data.desc || "").slice(0, 500),
        coverUrl: httpsUrl(String(data.pic || "")),
        sourceUrl: `https://www.bilibili.com/video/${data.bvid}`,
        contentKind: "video",
        publishedAt: data.pubdate ? new Date(data.pubdate * 1000) : null,
      };
    }
  }
  const og = parseOgOrThrow(await fetchOgFromResolved(page.url, page.text));
  return {
    platform: "BILIBILI",
    externalId: bv || (cv ? `cv${cv}` : externalIdFromUrl("BILIBILI", page.url)),
    title: og.title || "B站投稿",
    digest: og.description,
    coverUrl: httpsUrl(og.image),
    sourceUrl: page.url,
    contentKind: cv ? "article" : "video",
    publishedAt: null,
  };
}

async function ingestXiaohongshuUrl(url: string): Promise<PersonSocialDraft> {
  const page = await fetchPersonSocialText(url, { mobile: true });
  const noteId =
    page.url.match(/\/(?:explore|discovery\/item|item)\/([a-z0-9]+)/i)?.[1] ||
    "";
  const og = parseOgOrThrow(await fetchOgFromResolved(page.url, page.text));
  return {
    platform: "XIAOHONGSHU",
    externalId: noteId || externalIdFromUrl("XIAOHONGSHU", page.url),
    title: og.title || "小红书笔记",
    digest: og.description,
    coverUrl: httpsUrl(og.image),
    sourceUrl: noteId
      ? `https://www.xiaohongshu.com/explore/${noteId}`
      : page.url,
    contentKind: "note",
    publishedAt: null,
  };
}

function fetchOgFromResolved(url: string, html: string) {
  return parseOgMeta(html, url);
}

function parseOgOrThrow(og: { title: string; description: string; image: string; url: string }) {
  if (!og.title && !og.image) {
    throw new Error("打不开这篇作品的公开信息，请确认链接可在浏览器打开");
  }
  return og;
}

export async function ingestPersonSocialUrls(raw: string) {
  const urls = splitPersonSocialUrls(raw).slice(0, MAX_IMPORT_URLS);
  if (!urls.length) throw new Error("请粘贴抖音、B站或小红书作品链接");
  let upserted = 0;
  const errors: string[] = [];
  for (const url of urls) {
    const platform = detectPersonSocialPlatform(url);
    if (!platform) {
      errors.push(`无法识别：${url.slice(0, 48)}`);
      continue;
    }
    try {
      const draft =
        platform === "BILIBILI"
          ? await ingestBilibiliUrl(url)
          : platform === "DOUYIN"
            ? await ingestDouyinUrl(url)
            : await ingestXiaohongshuUrl(url);
      upserted += await upsertDrafts([draft]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "导入失败";
      errors.push(`${url.slice(0, 36)}… ${msg}`);
    }
  }
  return { upserted, attempted: urls.length, errors };
}

async function upsertDrafts(drafts: PersonSocialDraft[]): Promise<number> {
  let count = 0;
  for (const draft of drafts) {
    if (!draft.externalId || !draft.sourceUrl) continue;
    const existing = await prisma.personSocialPost.findUnique({
      where: {
        platform_externalId: {
          platform: draft.platform,
          externalId: draft.externalId,
        },
      },
      select: { id: true, isDeleted: true },
    });
    // 站长手动删过的不再被同步救回
    if (existing?.isDeleted) continue;
    await prisma.personSocialPost.upsert({
      where: {
        platform_externalId: {
          platform: draft.platform,
          externalId: draft.externalId,
        },
      },
      create: {
        platform: draft.platform,
        externalId: draft.externalId,
        title: draft.title,
        digest: draft.digest,
        coverUrl: draft.coverUrl,
        sourceUrl: draft.sourceUrl,
        contentKind: draft.contentKind,
        publishedAt: draft.publishedAt,
        syncedAt: new Date(),
      },
      update: {
        title: draft.title || undefined,
        digest: draft.digest,
        coverUrl: draft.coverUrl || undefined,
        sourceUrl: draft.sourceUrl,
        contentKind: draft.contentKind,
        publishedAt: draft.publishedAt || undefined,
        syncedAt: new Date(),
      },
    });
    count += 1;
  }
  return count;
}

export async function syncPersonSocialPosts(accounts?: PersonSocialAccounts) {
  const config = accounts || (await getPersonSocialAccounts());
  const parts: string[] = [];
  let upserted = 0;
  const run = async (
    label: string,
    fn: () => Promise<{ upserted: number; message: string }>,
  ) => {
    try {
      const result = await fn();
      upserted += result.upserted;
      parts.push(result.message);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "同步失败";
      parts.push(`${label}失败：${msg}`);
    }
  };
  await run("B站", () => syncBilibili(config));
  await run("抖音", () => syncDouyin(config));
  await run("小红书", () => syncXiaohongshu(config));
  if (!parts.length) {
    return { upserted: 0, message: "请先填写至少一个平台主页再同步。" };
  }
  return { upserted, message: parts.join("；") };
}

export async function listPersonSocialPosts(take = 500) {
  return prisma.personSocialPost.findMany({
    where: { isDeleted: false },
    orderBy: PERSON_SOCIAL_POST_ORDER_BY,
    take,
  });
}

export async function patchPersonSocialPost(
  id: string,
  patch: { isPinned?: boolean; isFeatured?: boolean },
) {
  const row = await prisma.personSocialPost.findFirst({
    where: { id, isDeleted: false },
  });
  if (!row) throw new Error("投稿不存在");
  return prisma.personSocialPost.update({
    where: { id },
    data: {
      ...(patch.isPinned !== undefined ? { isPinned: patch.isPinned } : {}),
      ...(patch.isFeatured !== undefined
        ? { isFeatured: patch.isFeatured }
        : {}),
    },
  });
}

export async function softDeletePersonSocialPost(id: string) {
  const row = await prisma.personSocialPost.findFirst({
    where: { id, isDeleted: false },
  });
  if (!row) throw new Error("投稿不存在");
  await prisma.personSocialPost.update({
    where: { id },
    data: { isDeleted: true },
  });
}

export async function reorderPersonSocialPosts(orderedIds: string[]) {
  const ids = orderedIds.filter(Boolean).slice(0, 500);
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.personSocialPost.updateMany({
        where: { id, isDeleted: false },
        data: { sortOrder: index },
      }),
    ),
  );
}

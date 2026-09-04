/**
 * 个人 IP 外平台投稿：平台枚举、主页/作品链接解析、前台展示文案。
 * 业务规则集中在这里，方便以后加微博等渠道。
 */

export const PERSON_SOCIAL_PLATFORMS = [
  "BILIBILI",
  "DOUYIN",
  "XIAOHONGSHU",
  "WECHAT_CHANNELS",
] as const;

export type PersonSocialPlatform = (typeof PERSON_SOCIAL_PLATFORMS)[number];

export const PERSON_SOCIAL_PLATFORM_LABEL: Record<PersonSocialPlatform, string> =
  {
    BILIBILI: "B站",
    DOUYIN: "抖音",
    XIAOHONGSHU: "小红书",
    WECHAT_CHANNELS: "视频号",
  };

export type PersonSocialContentKind = "video" | "article" | "note";

export const PERSON_SOCIAL_KIND_LABEL: Record<PersonSocialContentKind, string> =
  {
    video: "视频",
    article: "专栏",
    note: "笔记",
  };

export type PersonSocialAccounts = {
  bilibili: string;
  douyin: string;
  xiaohongshu: string;
  /** 微信视频号主页或 sph 短链；无官方列表接口，主页同步常要靠作品链接补 */
  wechatChannels: string;
  /** 可选。抖音/小红书/视频号主页列表常要靠 RSSHub；空则用公开实例 */
  rsshubBaseUrl: string;
};

export const DEFAULT_PERSON_SOCIAL_ACCOUNTS: PersonSocialAccounts = {
  bilibili: "",
  douyin: "",
  xiaohongshu: "",
  wechatChannels: "",
  rsshubBaseUrl: "",
};

export type PersonSocialDraft = {
  platform: PersonSocialPlatform;
  externalId: string;
  title: string;
  digest: string;
  coverUrl: string;
  sourceUrl: string;
  contentKind: PersonSocialContentKind;
  publishedAt: Date | null;
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

export function personSocialUserAgent(kind: "desktop" | "mobile" = "desktop") {
  return kind === "mobile" ? MOBILE_UA : BROWSER_UA;
}

export function isPersonSocialPlatform(
  value: string,
): value is PersonSocialPlatform {
  return (PERSON_SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

export function parsePersonSocialAccounts(
  raw: string | null | undefined,
): PersonSocialAccounts {
  let parsed: Partial<PersonSocialAccounts> = {};
  if (raw?.trim()) {
    try {
      parsed = JSON.parse(raw) as Partial<PersonSocialAccounts>;
    } catch {
      parsed = {};
    }
  }
  return {
    bilibili: String(parsed.bilibili || "").trim().slice(0, 400),
    douyin: String(parsed.douyin || "").trim().slice(0, 400),
    xiaohongshu: String(parsed.xiaohongshu || "").trim().slice(0, 400),
    wechatChannels: String(parsed.wechatChannels || "").trim().slice(0, 400),
    rsshubBaseUrl: String(parsed.rsshubBaseUrl || "").trim().slice(0, 400),
  };
}

export function serializePersonSocialAccounts(accounts: PersonSocialAccounts) {
  return JSON.stringify({
    bilibili: accounts.bilibili.trim().slice(0, 400),
    douyin: accounts.douyin.trim().slice(0, 400),
    xiaohongshu: accounts.xiaohongshu.trim().slice(0, 400),
    wechatChannels: accounts.wechatChannels.trim().slice(0, 400),
    rsshubBaseUrl: accounts.rsshubBaseUrl.trim().slice(0, 400),
  });
}

export function personSocialHasAccount(accounts: PersonSocialAccounts) {
  return Boolean(
    accounts.bilibili ||
      accounts.douyin ||
      accounts.xiaohongshu ||
      accounts.wechatChannels,
  );
}

/** 把主页栏填的内容收成 B 站 mid（纯数字） */
export function parseBilibiliMid(input: string): string {
  const text = input.trim();
  if (!text) return "";
  const space = text.match(/space\.bilibili\.com\/(\d+)/i);
  if (space?.[1]) return space[1];
  const uidParam = text.match(/[?&]mid=(\d+)/i);
  if (uidParam?.[1]) return uidParam[1];
  if (/^\d{1,16}$/.test(text)) return text;
  return "";
}

/** 抖音主页：优先 sec_user_id（MS4wLjABAAAA…），其次数字 uid */
export function parseDouyinUserId(input: string): string {
  const text = input.trim();
  if (!text) return "";
  const sec = text.match(/\/user\/(MS4wLjABAAAA[\w-]+)/i);
  if (sec?.[1]) return sec[1];
  const query = text.match(/sec_uid=([^&]+)/i);
  if (query?.[1]) return decodeURIComponent(query[1]);
  if (/^MS4wLjABAAAA[\w-]+$/i.test(text)) return text;
  const unique = text.match(/\/user\/(\d{5,20})(?:[/?#]|$)/);
  if (unique?.[1]) return unique[1];
  return text.slice(0, 80);
}

/** 小红书主页 user/profile/{hex id} */
export function parseXiaohongshuUserId(input: string): string {
  const text = input.trim();
  if (!text) return "";
  const profile = text.match(/xiaohongshu\.com\/user\/profile\/([a-z0-9]+)/i);
  if (profile?.[1]) return profile[1];
  if (/^[a-f0-9]{16,32}$/i.test(text)) return text;
  return "";
}

export function detectPersonSocialPlatform(
  url: string,
): PersonSocialPlatform | null {
  const raw = url.trim();
  if (!raw) return null;
  let host = "";
  try {
    host = new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (
    host.includes("bilibili.com") ||
    host === "b23.tv" ||
    host.endsWith(".b23.tv")
  ) {
    return "BILIBILI";
  }
  if (
    host.includes("douyin.com") ||
    host.includes("iesdouyin.com") ||
    host.includes("tiktok.com")
  ) {
    return "DOUYIN";
  }
  if (host.includes("xiaohongshu.com") || host.includes("xhslink.com")) {
    return "XIAOHONGSHU";
  }
  if (isWechatChannelsHost(host, raw)) {
    return "WECHAT_CHANNELS";
  }
  return null;
}

function isWechatChannelsHost(host: string, raw: string) {
  if (host.includes("channels.weixin.qq.com")) return true;
  if (host.includes("weixin.qq.com") && /\/sph\//i.test(raw)) return true;
  return false;
}

/** 视频号主页：finderUsername、sph 短号或 channels 路径 */
export function parseWechatChannelsUserId(input: string): string {
  const text = input.trim();
  if (!text) return "";
  try {
    const url = new URL(text.startsWith("http") ? text : `https://${text}`);
    const finder =
      url.searchParams.get("finderUsername") ||
      url.searchParams.get("username") ||
      url.searchParams.get("id") ||
      "";
    if (finder.trim()) return finder.trim();
    const sph = url.pathname.match(/\/sph\/([A-Za-z0-9_-]+)/i);
    if (sph?.[1]) return sph[1];
    const pathUser = url.pathname.match(
      /\/(?:user|home|platform)?\/?(v2_[A-Za-z0-9_@.-]+)/i,
    );
    if (pathUser?.[1]) return pathUser[1];
  } catch {
    // 纯 id
  }
  if (/^(v2_|sph)[A-Za-z0-9_@.-]+$/i.test(text)) return text;
  return text.slice(0, 120);
}

/** 用于合集条目与已同步投稿对齐，去掉追踪参数 */
export function normalizePersonSocialUrlKey(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text.startsWith("http") ? text : `https://${text}`);
    url.hash = "";
    url.searchParams.delete("spm_id_from");
    url.searchParams.delete("vd_source");
    url.searchParams.delete("share_source");
    url.searchParams.delete("share_unique_id");
    url.searchParams.delete("utm_source");
    url.searchParams.delete("utm_medium");
    const keep = [
      "sid",
      "season_id",
      "series_id",
      "finderUsername",
      "feedId",
      "exportId",
      "objectNonceId",
      "collectionId",
      "noteId",
    ];
    const next = new URLSearchParams();
    for (const key of keep) {
      const value = url.searchParams.get(key);
      if (value) next.set(key, value);
    }
    url.search = next.toString();
    return `${url.host}${url.pathname.replace(/\/+$/, "")}${
      url.search ? `?${url.search}` : ""
    }`.toLowerCase();
  } catch {
    return text.slice(0, 400).toLowerCase();
  }
}

export function splitPersonSocialUrls(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[\s,，;；]+/)) {
    const url = part.trim();
    if (!url || url.length < 8) continue;
    if (!/^https?:\/\//i.test(url) && !url.includes(".")) continue;
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out.slice(0, 40);
}

export const PERSON_SOCIAL_POST_ORDER_BY = [
  { isPinned: "desc" as const },
  { sortOrder: "asc" as const },
  { publishedAt: "desc" as const },
  { syncedAt: "desc" as const },
];

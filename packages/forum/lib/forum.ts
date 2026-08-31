/**
 * 大学论坛业务规则：高校分区、专区、发帖权限、互动动作。
 * 账号与全站同一套 User / 登录 Cookie，不另开论坛号；微信、登录名、手机、邮箱均可。
 * 发帖：该校实名认证通过（本科或研究生档），或站长；未认证的旧「加入」账号仍可发公开帖。
 * 站长发布时可勾选多所高校，各校各有一份独立帖（专区按同 key 对齐）。
 * 浏览默认开放；发帖可选「仅本校认证用户可见」。
 * 后台可关「其他用户」发帖/评论/点赞收藏蹲后续/私信；站长（ADMIN）一律不受这些开关限制。
 * 发帖与写笔记是同一入口：最多 30 张图/视频，正文最多 4000 字。
 */

import { wgs84ToGcj02 } from "@andyyyds/shared/geo-china";
import { isAdmin, type RoleInput } from "@andyyyds/shared/roles";

export const FORUM_POST_KIND = ["POST", "NOTE"] as const;
export type ForumPostKind = (typeof FORUM_POST_KIND)[number];

export const FORUM_POST_STATUS = ["PUBLISHED", "HIDDEN", "DRAFT"] as const;
export type ForumPostStatus = (typeof FORUM_POST_STATUS)[number];

export const FORUM_POST_AUDIENCE = ["PUBLIC", "SCHOOL_VERIFIED"] as const;
export type ForumPostAudience = (typeof FORUM_POST_AUDIENCE)[number];
export const FORUM_AUDIENCE_PUBLIC = "PUBLIC";
export const FORUM_AUDIENCE_SCHOOL = "SCHOOL_VERIFIED";

export const FORUM_ACTION_TYPES = ["LIKE", "FAVORITE", "WATCH"] as const;
export type ForumActionType = (typeof FORUM_ACTION_TYPES)[number];

export const FORUM_MEDIA_KINDS = ["image", "video"] as const;
export type ForumMediaKind = (typeof FORUM_MEDIA_KINDS)[number];
export type ForumMediaItem = { kind: ForumMediaKind; url: string };

export const FORUM_TITLE_MAX = 80;
export const FORUM_BODY_MAX = 4000;
export const FORUM_MEDIA_MAX = 30;
export const FORUM_COMMENT_MAX = 1000;
export const FORUM_NAME_MAX = 40;
export const FORUM_SLUG_MAX = 40;
export const FORUM_SLOGAN_MAX = 80;
export const FORUM_DESC_MAX = 500;
export const FORUM_ZONE_NAME_MAX = 20;
export const FORUM_LIST_TAKE = 40;
export const FORUM_PLACE_MAX = 120;
export const FORUM_NOTICE_TITLE_MAX = 80;
export const FORUM_NOTICE_BODY_MAX = 800;
export const FORUM_NOTICE_MEDIA_MAX = 8;
export const FORUM_NOTICE_HREF_MAX = 500;
export const FORUM_REAL_NAME_MAX = 20;
export const FORUM_STUDENT_ID_MAX = 32;
export const FORUM_CAMPUS_EMAIL_MAX = 80;

/** 后台关闭成员能力时的前台/接口提示；站长走 bypass，看不到这些 */
export const FORUM_CLOSED = {
  post: "站长已关闭普通用户发帖，仅站长可发",
  comment: "站长已关闭普通用户评论，仅站长可评",
  interact: "站长已关闭普通用户点赞、收藏和蹲后续，仅站长可操作",
  message: "站长已关闭论坛私信，仅站长可发",
} as const;

export const FORUM_NOTICE_THEMES = ["brand", "amber", "red", "dark"] as const;
export type ForumNoticeTheme = (typeof FORUM_NOTICE_THEMES)[number];

export const FORUM_NOTICE_ANIMATIONS = [
  "none",
  "pulse",
  "marquee",
  "shine",
  "float",
] as const;
export type ForumNoticeAnimation = (typeof FORUM_NOTICE_ANIMATIONS)[number];

export type ForumNoticeConfig = {
  enabled: boolean;
  title: string;
  body: string;
  href: string;
  theme: ForumNoticeTheme;
  animation: ForumNoticeAnimation;
  media: ForumMediaItem[];
};

export type ForumSiteConfig = {
  allowMemberPost: boolean;
  allowMemberComment: boolean;
  allowMemberInteract: boolean;
  allowMemberMessage: boolean;
  notice: ForumNoticeConfig;
};

export const DEFAULT_FORUM_SITE_CONFIG: ForumSiteConfig = {
  allowMemberPost: true,
  allowMemberComment: true,
  allowMemberInteract: true,
  allowMemberMessage: true,
  notice: {
    enabled: false,
    title: "",
    body: "",
    href: "",
    theme: "brand",
    animation: "none",
    media: [],
  },
};

export const FORUM_RESERVED_SLUGS = new Set([
  "new",
  "watching",
  "mine",
  "api",
]);

/** 创建高校时写入的默认专区（可再增删） */
export const DEFAULT_FORUM_ZONES: { key: string; name: string }[] = [
  { key: "daily", name: "日常话题" },
  { key: "food", name: "美食分享" },
  { key: "courses", name: "选课交流" },
  { key: "secondhand", name: "二手交易" },
  { key: "errand", name: "跑腿代取" },
  { key: "materials", name: "学习资料分享" },
  { key: "dating", name: "恋爱交友" },
];

export const FORUM_KIND_LABEL: Record<ForumPostKind, string> = {
  POST: "帖子",
  NOTE: "帖子",
};

export const FORUM_ACTION_LABEL: Record<ForumActionType, string> = {
  LIKE: "点赞",
  FAVORITE: "收藏",
  WATCH: "蹲蹲后续",
};

export function isForumPostKind(value: string): value is ForumPostKind {
  return (FORUM_POST_KIND as readonly string[]).includes(value);
}

export function isForumPostStatus(value: string): value is ForumPostStatus {
  return (FORUM_POST_STATUS as readonly string[]).includes(value);
}

export function isForumPostAudience(value: string): value is ForumPostAudience {
  return (FORUM_POST_AUDIENCE as readonly string[]).includes(value);
}

export function isForumActionType(value: string): value is ForumActionType {
  return (FORUM_ACTION_TYPES as readonly string[]).includes(value);
}

export function isForumMediaKind(value: string): value is ForumMediaKind {
  return (FORUM_MEDIA_KINDS as readonly string[]).includes(value);
}

export function parseForumMediaList(
  raw: unknown,
  max = FORUM_MEDIA_MAX,
): ForumMediaItem[] {
  if (!Array.isArray(raw)) return [];
  const items: ForumMediaItem[] = [];
  for (const row of raw.slice(0, max)) {
    if (!row || typeof row !== "object") continue;
    const kind = String((row as { kind?: string }).kind || "");
    const url = String((row as { url?: string }).url || "").trim();
    if (!isForumMediaKind(kind) || !url || url.length > 2000) continue;
    if (url.startsWith("//") || url.includes("..")) continue;
    items.push({ kind, url });
  }
  return items;
}

export function parseForumMedia(raw: string | null | undefined): ForumMediaItem[] {
  if (!raw?.trim()) return [];
  try {
    return parseForumMediaList(JSON.parse(raw) as unknown, FORUM_MEDIA_MAX);
  } catch {
    return [];
  }
}

/** 发帖附件必须是当前用户目录下的已上传文件，避免把别人的 OSS 地址写进帖子 */
export function isOwnedForumMediaUrl(url: string, userId: string): boolean {
  if (!userId || !url) return false;
  if (url.includes("..") || url.startsWith("//")) return false;
  return url.includes(`/${userId}/`);
}

export function serializeForumMedia(items: ForumMediaItem[]): string {
  return JSON.stringify(
    items.slice(0, FORUM_MEDIA_MAX).map((item) => ({
      kind: item.kind,
      url: item.url,
    })),
  );
}

export function isForumNoticeTheme(value: string): value is ForumNoticeTheme {
  return (FORUM_NOTICE_THEMES as readonly string[]).includes(value);
}

export function isForumNoticeAnimation(
  value: string,
): value is ForumNoticeAnimation {
  return (FORUM_NOTICE_ANIMATIONS as readonly string[]).includes(value);
}

export function parseForumNotice(raw: unknown): ForumNoticeConfig {
  const base = DEFAULT_FORUM_SITE_CONFIG.notice;
  if (!raw || typeof raw !== "object") return { ...base, media: [] };
  const o = raw as Record<string, unknown>;
  return {
    enabled: Boolean(o.enabled),
    title: String(o.title || "").trim().slice(0, FORUM_NOTICE_TITLE_MAX),
    body: String(o.body || "").trim().slice(0, FORUM_NOTICE_BODY_MAX),
    href: String(o.href || "").trim().slice(0, FORUM_NOTICE_HREF_MAX),
    theme: isForumNoticeTheme(String(o.theme || ""))
      ? (o.theme as ForumNoticeTheme)
      : "brand",
    animation: isForumNoticeAnimation(String(o.animation || ""))
      ? (o.animation as ForumNoticeAnimation)
      : "none",
    media: parseForumMediaList(o.media, FORUM_NOTICE_MEDIA_MAX),
  };
}

export function parseForumSiteConfig(raw: string | null | undefined): ForumSiteConfig {
  const defaults = DEFAULT_FORUM_SITE_CONFIG;
  if (!raw?.trim()) {
    return {
      ...defaults,
      notice: { ...defaults.notice, media: [] },
    };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { ...defaults, notice: { ...defaults.notice, media: [] } };
    }
    const o = parsed as Record<string, unknown>;
    return {
      allowMemberPost: o.allowMemberPost !== false,
      allowMemberComment: o.allowMemberComment !== false,
      allowMemberInteract: o.allowMemberInteract !== false,
      allowMemberMessage: o.allowMemberMessage !== false,
      notice: parseForumNotice(o.notice),
    };
  } catch {
    return { ...defaults, notice: { ...defaults.notice, media: [] } };
  }
}

export function serializeForumSiteConfig(config: ForumSiteConfig): string {
  return JSON.stringify({
    allowMemberPost: Boolean(config.allowMemberPost),
    allowMemberComment: Boolean(config.allowMemberComment),
    allowMemberInteract: Boolean(config.allowMemberInteract),
    allowMemberMessage: Boolean(config.allowMemberMessage),
    notice: {
      enabled: Boolean(config.notice.enabled),
      title: config.notice.title.slice(0, FORUM_NOTICE_TITLE_MAX),
      body: config.notice.body.slice(0, FORUM_NOTICE_BODY_MAX),
      href: config.notice.href.slice(0, FORUM_NOTICE_HREF_MAX),
      theme: config.notice.theme,
      animation: config.notice.animation,
      media: config.notice.media.slice(0, FORUM_NOTICE_MEDIA_MAX).map((item) => ({
        kind: item.kind,
        url: item.url,
      })),
    },
  });
}

/** 站长始终允许；其他用户看后台开关 */
export function forumMemberMay(
  session: RoleInput | null | undefined,
  memberAllowed: boolean,
): boolean {
  if (session && isAdmin(session)) return true;
  return memberAllowed;
}

export function slugifyUniversity(name: string): string {
  const ascii = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, FORUM_SLUG_MAX);
  if (ascii.length >= 2 && !FORUM_RESERVED_SLUGS.has(ascii)) return ascii;
  return `u-${Date.now().toString(36)}`;
}

export function normalizeForumSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, FORUM_SLUG_MAX);
}

export function parseEmailDomains(raw: string): string[] {
  return raw
    .split(/[,，\s]+/)
    .map((item) => item.trim().toLowerCase().replace(/^@/, ""))
    .filter((item) => item.includes("."));
}

/**
 * 邮箱后缀限制：未配置则任意登录用户可加入该校分区。
 * 微信占位邮箱匹配不到后缀时拒绝，避免未验证身份进校。
 */
export function emailMatchesUniversityDomains(
  email: string,
  domainsRaw: string,
): boolean {
  const domains = parseEmailDomains(domainsRaw);
  if (domains.length === 0) return true;
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf("@");
  if (at < 0) return false;
  const host = lower.slice(at + 1);
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

export function canPostInUniversity(
  session: {
    forumUniversityId?: string | null;
    forumVerifiedUniversityIds?: string[] | null;
  } & RoleInput,
  universityId: string,
): boolean {
  if (isAdmin(session)) return true;
  if (session.forumVerifiedUniversityIds?.includes(universityId)) return true;
  // 旧版加入本校仍记在 forumUniversityId 上，可继续在该校发公开帖
  return Boolean(
    session.forumUniversityId && session.forumUniversityId === universityId,
  );
}

export function canModerateForum(roleOrRoles: RoleInput): boolean {
  return isAdmin(roleOrRoles);
}

export function displayPostTitle(title: string, body: string): string {
  const t = title.trim();
  if (t) return t;
  const line = body.trim().split(/\n/)[0] || "无标题";
  return line.slice(0, FORUM_TITLE_MAX);
}

export function excerptBody(body: string, max = 120): string {
  const text = body.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function parseForumCoord(
  value: unknown,
  kind: "lat" | "lng",
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (kind === "lat" && (n < -90 || n > 90)) return null;
  if (kind === "lng" && (n < -180 || n > 180)) return null;
  return n;
}

/** 纬经度必须成对；只填一侧视为无效 */
export function parseForumCoords(
  latRaw: unknown,
  lngRaw: unknown,
): { latitude: number | null; longitude: number | null; error?: string } {
  const latitude = parseForumCoord(latRaw, "lat");
  const longitude = parseForumCoord(lngRaw, "lng");
  const hasLat = latRaw !== null && latRaw !== undefined && latRaw !== "";
  const hasLng = lngRaw !== null && lngRaw !== undefined && lngRaw !== "";
  if (hasLat !== hasLng || (latitude == null) !== (longitude == null)) {
    return {
      latitude: null,
      longitude: null,
      error: "纬度和经度需要成对填写",
    };
  }
  return { latitude, longitude };
}

/** 与约搭详情相同：有坐标时钉到点上（高德/腾讯用 GCJ-02），否则按地点文案搜 */
export function forumPlaceMapLinks(
  place: string,
  lat?: number | null,
  lng?: number | null,
) {
  const q = encodeURIComponent(place.trim());
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return {
      amap: `https://uri.amap.com/search?keyword=${q}`,
      tencent: `https://apis.map.qq.com/uri/v1/search?keyword=${q}&referer=yyds`,
      apple: `https://maps.apple.com/?q=${q}`,
      google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    };
  }
  const gcj = wgs84ToGcj02(lat, lng);
  const name = place.trim() || "地点";
  const encName = encodeURIComponent(name);
  return {
    amap: `https://uri.amap.com/marker?position=${gcj.lng},${gcj.lat}&name=${encName}&coordinate=gaode&callnative=1`,
    tencent: `https://apis.map.qq.com/uri/v1/marker?marker=coord:${gcj.lat},${gcj.lng};title:${encName}&referer=yyds`,
    apple: `https://maps.apple.com/?ll=${lat},${lng}&q=${encName}`,
    google: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  };
}

export function formatForumTime(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

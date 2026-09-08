/**
 * 个人展示站：档案 + 条目种类。规则集中在这里，方便以后整包拆到独立域名。
 */

export const PERSON_ENTRY_KINDS = [
  "PROJECT",
  "BLOG",
  "PORTFOLIO",
  "HONOR",
  "GRADE",
  "PRACTICE",
  "ACTIVITY",
  "INTEREST",
  "PHOTO",
] as const;

export type PersonEntryKind = (typeof PERSON_ENTRY_KINDS)[number];

export const PERSON_ENTRY_KIND_LABEL: Record<PersonEntryKind, string> = {
  PROJECT: "项目经历",
  BLOG: "博客 / 技术随笔",
  PORTFOLIO: "作品集",
  HONOR: "获奖荣誉",
  GRADE: "成绩",
  PRACTICE: "社会实践",
  ACTIVITY: "课外活动",
  INTEREST: "兴趣",
  PHOTO: "照片",
};

export const PERSON_PROFILE_ID = "default";
export const PERSON_NAME_MAX = 40;
export const PERSON_HEADLINE_MAX = 80;
export const PERSON_ABOUT_MAX = 8000;
export const PERSON_TITLE_MAX = 80;
export const PERSON_SUMMARY_MAX = 400;
export const PERSON_BODY_MAX = 40_000;
export const PERSON_CONTACT_MAX = 80;
export const PERSON_URL_MAX = 400;
export const PERSON_MAX_IMAGES = 12;
export const PERSON_MAX_EXTRA_CONTACTS = 8;

export type PersonExtraContact = {
  label: string;
  value: string;
  href: string;
};

export type PersonProfilePayload = {
  displayName: string;
  headline: string;
  about: string;
  avatarUrl: string;
  coverUrl: string;
  location: string;
  email: string;
  phone: string;
  wechat: string;
  qq: string;
  website: string;
  github: string;
  linkedin: string;
  zhihu: string;
  weibo: string;
  extraContacts: PersonExtraContact[];
};

export type PersonEntryPayload = {
  id: string;
  kind: PersonEntryKind;
  title: string;
  summary: string;
  body: string;
  coverUrl: string;
  images: string[];
  org: string;
  role: string;
  period: string;
  location: string;
  link: string;
  sortOrder: number;
  published: boolean;
  featured: boolean;
  occurredAt: string | null;
  updatedAt: string;
};

export const DEFAULT_PERSON_PROFILE: PersonProfilePayload = {
  displayName: "",
  headline: "",
  about: "",
  avatarUrl: "",
  coverUrl: "",
  location: "",
  email: "",
  phone: "",
  wechat: "",
  qq: "",
  website: "",
  github: "",
  linkedin: "",
  zhihu: "",
  weibo: "",
  extraContacts: [],
};

export function isPersonEntryKind(value: string): value is PersonEntryKind {
  return (PERSON_ENTRY_KINDS as readonly string[]).includes(value);
}

function clip(raw: unknown, max: number): string {
  return String(raw ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
}

function clipUrl(raw: unknown): string {
  const text = clip(raw, PERSON_URL_MAX);
  if (!text) return "";
  if (/^(https?:\/\/|\/uploads\/|\/|mailto:|tel:)/i.test(text)) return text;
  if (/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(text)) return `https://${text}`;
  return "";
}

export function normalizeExtraContacts(raw: unknown): PersonExtraContact[] {
  let list: unknown[] = [];
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw || "[]") as unknown[];
    } catch {
      list = [];
    }
  } else if (Array.isArray(raw)) {
    list = raw;
  }
  return list
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      label: clip(item.label, 20),
      value: clip(item.value, PERSON_CONTACT_MAX),
      href: clipUrl(item.href),
    }))
    .filter((item) => item.label || item.value)
    .slice(0, PERSON_MAX_EXTRA_CONTACTS);
}

export function normalizeImageList(raw: unknown): string[] {
  let list: unknown[] = [];
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw || "[]") as unknown[];
    } catch {
      list = [];
    }
  } else if (Array.isArray(raw)) {
    list = raw;
  }
  return list
    .map((item) => clipUrl(item))
    .filter(Boolean)
    .slice(0, PERSON_MAX_IMAGES);
}

export function normalizePersonProfile(raw: unknown): PersonProfilePayload {
  const input = raw && typeof raw === "object" ? (raw as Partial<PersonProfilePayload>) : {};
  return {
    displayName: clip(input.displayName, PERSON_NAME_MAX),
    headline: clip(input.headline, PERSON_HEADLINE_MAX),
    about: String(input.about ?? "").replace(/\u0000/g, "").trim().slice(0, PERSON_ABOUT_MAX),
    avatarUrl: clipUrl(input.avatarUrl),
    coverUrl: clipUrl(input.coverUrl),
    location: clip(input.location, PERSON_CONTACT_MAX),
    email: clip(input.email, PERSON_CONTACT_MAX),
    phone: clip(input.phone, PERSON_CONTACT_MAX),
    wechat: clip(input.wechat, PERSON_CONTACT_MAX),
    qq: clip(input.qq, PERSON_CONTACT_MAX),
    website: clipUrl(input.website),
    github: clipUrl(input.github) || clip(input.github, PERSON_CONTACT_MAX),
    linkedin: clipUrl(input.linkedin),
    zhihu: clipUrl(input.zhihu),
    weibo: clipUrl(input.weibo),
    extraContacts: normalizeExtraContacts(input.extraContacts),
  };
}

export function normalizePersonEntry(
  raw: unknown,
  fallbackKind: PersonEntryKind = "PROJECT",
): Omit<PersonEntryPayload, "id" | "updatedAt"> & { id?: string } {
  const input = raw && typeof raw === "object" ? (raw as Partial<PersonEntryPayload>) : {};
  const kind = isPersonEntryKind(String(input.kind || ""))
    ? (input.kind as PersonEntryKind)
    : fallbackKind;
  const sort = Number(input.sortOrder);
  return {
    id: input.id ? String(input.id) : undefined,
    kind,
    title: clip(input.title, PERSON_TITLE_MAX),
    summary: clip(input.summary, PERSON_SUMMARY_MAX),
    body: String(input.body ?? "").replace(/\u0000/g, "").trim().slice(0, PERSON_BODY_MAX),
    coverUrl: clipUrl(input.coverUrl),
    images: normalizeImageList(input.images),
    org: clip(input.org, PERSON_TITLE_MAX),
    role: clip(input.role, PERSON_TITLE_MAX),
    period: clip(input.period, PERSON_CONTACT_MAX),
    location: clip(input.location, PERSON_CONTACT_MAX),
    link: clipUrl(input.link),
    sortOrder: Number.isFinite(sort) ? Math.max(0, Math.min(9999, Math.round(sort))) : 0,
    published: input.published !== false,
    featured: Boolean(input.featured),
    occurredAt: input.occurredAt ? String(input.occurredAt) : null,
  };
}

export type PersonContactChip = {
  key: string;
  label: string;
  value: string;
  href: string;
};

function githubHref(raw: string): string {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://github.com/${raw.replace(/^@/, "")}`;
}

/** 前台联系条：有值才展示，顺序固定，方便以后加渠道只改这里 */
export function buildPersonContactChips(
  profile: PersonProfilePayload,
): PersonContactChip[] {
  const chips: PersonContactChip[] = [];
  if (profile.email) {
    chips.push({
      key: "email",
      label: "邮箱",
      value: profile.email,
      href: `mailto:${profile.email}`,
    });
  }
  if (profile.phone) {
    chips.push({
      key: "phone",
      label: "电话",
      value: profile.phone,
      href: `tel:${profile.phone}`,
    });
  }
  if (profile.wechat) {
    chips.push({ key: "wechat", label: "微信", value: profile.wechat, href: "" });
  }
  if (profile.qq) {
    chips.push({ key: "qq", label: "QQ", value: profile.qq, href: "" });
  }
  if (profile.location) {
    chips.push({
      key: "location",
      label: "地点",
      value: profile.location,
      href: "",
    });
  }
  if (profile.website) {
    chips.push({
      key: "website",
      label: "网站",
      value: "个人网站",
      href: profile.website,
    });
  }
  if (profile.github) {
    chips.push({
      key: "github",
      label: "GitHub",
      value: "GitHub",
      href: githubHref(profile.github),
    });
  }
  if (profile.linkedin) {
    chips.push({
      key: "linkedin",
      label: "LinkedIn",
      value: "LinkedIn",
      href: profile.linkedin,
    });
  }
  if (profile.zhihu) {
    chips.push({
      key: "zhihu",
      label: "知乎",
      value: "知乎",
      href: profile.zhihu,
    });
  }
  if (profile.weibo) {
    chips.push({
      key: "weibo",
      label: "微博",
      value: "微博",
      href: profile.weibo,
    });
  }
  for (const extra of profile.extraContacts) {
    chips.push({
      key: `extra-${extra.label}`,
      label: extra.label || "联系",
      value: extra.value || extra.label,
      href: extra.href,
    });
  }
  return chips;
}

export function splitPersonAbout(about: string): string[] {
  return about
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function personEntrySectionHref(kind: PersonEntryKind): string {
  if (kind === "PROJECT") return "/about/person/projects";
  if (kind === "BLOG") return "/about/person/blog";
  if (kind === "PORTFOLIO") return "/about/person/portfolio";
  if (kind === "HONOR" || kind === "GRADE") return "/about/person/honors";
  if (kind === "PHOTO") return "/about/person/photos";
  return "/about/person/life";
}

export function personEntryHref(entry: Pick<PersonEntryPayload, "kind" | "id">): string {
  if (entry.kind === "PROJECT") return `/about/person/projects/${entry.id}`;
  if (entry.kind === "BLOG") return `/about/person/blog/${entry.id}`;
  return `/about/person/e/${entry.id}`;
}

/** 会话与消息枚举：业务规则集中在此，便于以后扩展 */

export const CHAT_KIND = {
  DIRECT: "DIRECT",
  GROUP: "GROUP",
} as const;

export type ChatKind = (typeof CHAT_KIND)[keyof typeof CHAT_KIND];

export const CHAT_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  REJECTED: "REJECTED",
  CLOSED: "CLOSED",
} as const;

export type ChatStatus = (typeof CHAT_STATUS)[keyof typeof CHAT_STATUS];

export const CHAT_SOURCE = {
  USER_SEARCH: "USER_SEARCH",
  PRODUCT_CONSULT: "PRODUCT_CONSULT",
  MEETUP_CONSULT: "MEETUP_CONSULT",
  FORUM_DM: "FORUM_DM",
  GROUP: "GROUP",
  MEETUP_GROUP: "MEETUP_GROUP",
  COURSE_GROUP: "COURSE_GROUP",
} as const;

export type ChatSource = (typeof CHAT_SOURCE)[keyof typeof CHAT_SOURCE];

export const CHAT_MEMBER_ROLE = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
  REQUESTER: "REQUESTER",
  RECIPIENT: "RECIPIENT",
} as const;

export const CHAT_JOIN_STATUS = {
  ACTIVE: "ACTIVE",
  PENDING: "PENDING",
  REJECTED: "REJECTED",
  LEFT: "LEFT",
} as const;

export const CHAT_MESSAGE_TYPE = {
  TEXT: "TEXT",
  IMAGE: "IMAGE",
  SYSTEM: "SYSTEM",
  NOTICE: "NOTICE",
} as const;

export const CHAT_TEXT_MAX_LEN = 2000;
export const CHAT_SEARCH_LIMIT = 20;
export const CHAT_HISTORY_PAGE = 50;
export const CHAT_GROUP_INVITE_MAX = 40;
/** 普通成员撤回时限（毫秒），对齐常见 IM */
export const CHAT_RECALL_WINDOW_MS = 2 * 60 * 1000;

export function isChatSource(v: string): v is ChatSource {
  return (Object.values(CHAT_SOURCE) as string[]).includes(v);
}

export function parseMentionIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x) => String(x)).filter(Boolean);
  } catch {
    return [];
  }
}

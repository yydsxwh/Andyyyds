/**
 * 约搭业务规则（模仿「一起玩」类活动广场，非粗门品牌复刻）
 *
 * - 游客可浏览广场/详情；登录用户可发起与报名
 * - 人数含发起人；报满自动 FULL，有人退出且仍 OPEN 窗口则恢复 OPEN
 * - 发起人可取消活动或提前截止报名（CLOSED），不可替他人报名
 */

export const MEETUP_CATEGORIES = [
  { key: "SPORT", label: "运动" },
  { key: "FOOD", label: "美食" },
  { key: "GAME", label: "游戏" },
  { key: "STUDY", label: "学习" },
  { key: "TRAVEL", label: "出行" },
  { key: "OTHER", label: "其他" },
] as const;

export type MeetupCategoryKey = (typeof MEETUP_CATEGORIES)[number]["key"];

export const MEETUP_STATUSES = [
  { key: "OPEN", label: "招募中" },
  { key: "FULL", label: "已满员" },
  { key: "CLOSED", label: "已截止" },
  { key: "CANCELLED", label: "已取消" },
] as const;

export type MeetupStatusKey = (typeof MEETUP_STATUSES)[number]["key"];

/** 人数上下限：太小无意义，太大难管理线下集合 */
export const MEETUP_MIN_PEOPLE = 2;
export const MEETUP_MAX_PEOPLE = 50;

const CATEGORY_KEYS = new Set<string>(MEETUP_CATEGORIES.map((c) => c.key));
const STATUS_KEYS = new Set<string>(MEETUP_STATUSES.map((s) => s.key));

export function isMeetupCategory(value: string): value is MeetupCategoryKey {
  return CATEGORY_KEYS.has(value);
}

export function isMeetupStatus(value: string): value is MeetupStatusKey {
  return STATUS_KEYS.has(value);
}

export function meetupCategoryLabel(key: string): string {
  return MEETUP_CATEGORIES.find((c) => c.key === key)?.label || "其他";
}

export function meetupStatusLabel(key: string): string {
  return MEETUP_STATUSES.find((s) => s.key === key)?.label || key;
}

/** 是否仍允许新用户报名（满员/截止/取消均不可） */
export function canJoinMeetup(status: string): boolean {
  return status === "OPEN";
}

/** 发起人可操作的状态流转目标 */
export const HOST_STATUS_ACTIONS = [
  { key: "CLOSED" as const, label: "截止报名" },
  { key: "FULL" as const, label: "标记满员" },
  { key: "CANCELLED" as const, label: "取消活动" },
  { key: "OPEN" as const, label: "重新开放" },
];

/**
 * 报名人数变化后的状态：仅自动在 OPEN ↔ FULL 间切换；
 * CLOSED / CANCELLED 由发起人手动决定，不因人数自动改回。
 */
export function statusAfterJoinCountChange(input: {
  currentStatus: string;
  joinCount: number;
  maxPeople: number;
}): MeetupStatusKey {
  const { currentStatus, joinCount, maxPeople } = input;
  if (currentStatus === "CLOSED" || currentStatus === "CANCELLED") {
    return currentStatus as MeetupStatusKey;
  }
  if (joinCount >= maxPeople) return "FULL";
  return "OPEN";
}

export function formatMeetupWhen(date: Date): string {
  // 用本地时区展示，方便微信内手机端一眼看懂几点集合
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

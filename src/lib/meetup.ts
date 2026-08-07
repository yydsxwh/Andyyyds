/**
 * 约搭业务规则（模仿「一起玩」类活动广场，非粗门品牌复刻）
 *
 * - 游客可浏览广场/详情；登录用户可发起与报名
 * - 人数含发起人；报满自动 FULL，有人退出且仍 OPEN 窗口则恢复 OPEN
 * - 发起人可取消活动或提前截止报名（CLOSED），不可替他人报名
 * - 定价：priceCents=0 免费直接报名；>0 走 Course(MEETUP) 订单支付，可叠加优惠券与分销
 */

/** 约搭可售壳在 Course.productType 上的取值（与 product-types 对齐） */
export const MEETUP_PRODUCT_TYPE = "MEETUP";

/** 报名费上限（分）：防误填天文数字；约 2 万元 */
export const MEETUP_MAX_PRICE_CENTS = 2_000_000;

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

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"] as const;

/** 详情页时段：08.07 周五 19:00 - 22:00（贴近一起玩类展示） */
export function formatMeetupTimeRange(startsAt: Date, endsAt?: Date | null): string {
  const m = String(startsAt.getMonth() + 1).padStart(2, "0");
  const d = String(startsAt.getDate()).padStart(2, "0");
  const week = WEEKDAYS[startsAt.getDay()];
  const hh = String(startsAt.getHours()).padStart(2, "0");
  const mm = String(startsAt.getMinutes()).padStart(2, "0");
  const start = `${m}.${d} 周${week} ${hh}:${mm}`;
  if (!endsAt || Number.isNaN(endsAt.getTime())) return start;
  const eh = String(endsAt.getHours()).padStart(2, "0");
  const em = String(endsAt.getMinutes()).padStart(2, "0");
  const sameDay =
    endsAt.getFullYear() === startsAt.getFullYear() &&
    endsAt.getMonth() === startsAt.getMonth() &&
    endsAt.getDate() === startsAt.getDate();
  if (sameDay) return `${start} - ${eh}:${em}`;
  const emon = String(endsAt.getMonth() + 1).padStart(2, "0");
  const eday = String(endsAt.getDate()).padStart(2, "0");
  return `${start} - ${emon}.${eday} ${eh}:${em}`;
}

/** 元 → 分；非法或负数按 0（免费） */
export function yuanToMeetupPriceCents(yuan: unknown): number {
  const n = typeof yuan === "number" ? yuan : Number(yuan);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MEETUP_MAX_PRICE_CENTS, Math.round(n * 100));
}

export function isMeetupPaid(priceCents: number): boolean {
  return Math.max(0, Math.floor(priceCents || 0)) > 0;
}

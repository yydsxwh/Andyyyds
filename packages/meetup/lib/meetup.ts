/**
 * 约搭业务规则（模仿「一起玩」类活动广场，非粗门品牌复刻）
 *
 * - 游客可浏览广场/详情；登录用户可发起与报名
 * - 人数含发起人；报满自动 FULL，有人退出且仍 OPEN 窗口则恢复 OPEN
 * - 发起人可取消活动或提前截止报名（CLOSED），不可替他人报名
 * - 定价：priceCents=0 免费直接报名；>0 走 Course(MEETUP) 订单支付，可叠加优惠券与分销
 */

import {
  DEFAULT_MEETUP_TIMEZONE,
  formatTimeZoneOffsetLabel,
  getZonedParts,
  meetupTimeZoneLabel,
  normalizeMeetupTimeZone,
} from "@andyyyds/meetup/lib/meetup-timezone";

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

/**
 * 广场列表排序（与 /meetup、GET /api/meetup 的 sort 参数一致）
 * - latest：按创建时间新→旧（同秒再按开场时间），方便先看到新发的局
 * - nearest：浏览者 lat/lng vs 活动举办地 latitude/longitude（非发帖时定位）近→远；无活动坐标排后
 * - score：综合（招募中优先 + 时间近 + 有名额），权重见下方常量，便于调
 */
export const MEETUP_SORTS = [
  { key: "latest", label: "最新" },
  { key: "nearest", label: "距离最近" },
  { key: "score", label: "综合" },
] as const;

export type MeetupSortKey = (typeof MEETUP_SORTS)[number]["key"];

/** 默认排序：综合，兼顾招募中与时间相关度 */
export const MEETUP_SORT_DEFAULT: MeetupSortKey = "score";

/** 综合排序权重（改业务偏好时只动这里） */
export const MEETUP_SCORE_WEIGHTS = {
  /** 招募中绝对优先，避免旧满员/截止局压过可报名局 */
  statusOpen: 1_000_000,
  statusFull: 200_000,
  statusClosed: 0,
  /** 剩余名额比例 0~1 乘此值；有空位更靠前 */
  spotsLeftRatio: 80_000,
  /**
   * 时间衰减：距「现在」越近分越高。
   * 用 |startsAt - now| 的天数；超过 horizonDays 后该项接近 0
   */
  timeProximity: 120_000,
  timeHorizonDays: 60,
} as const;

/** 单档最少 1 人；默认档显示 2（见 MEETUP_DEFAULT_SLOT_PEOPLE） */
export const MEETUP_MIN_PEOPLE = 1;
/** 单档人数上限：2000 亿（在 Number.MAX_SAFE_INTEGER 内，可用 number 运算） */
export const MEETUP_MAX_PEOPLE = 200_000_000_000;
/** 活动总人数上限：各档之和，最多 8 档 */
export const MEETUP_MAX_TOTAL_PEOPLE = MEETUP_MAX_PEOPLE * 8;
/** 下拉快捷选项上限；超过须手输 */
export const MEETUP_PEOPLE_SELECT_MAX = 100;
/** 新建分档默认人数 */
export const MEETUP_DEFAULT_SLOT_PEOPLE = 2;

/**
 * Prisma BigInt → number。
 * 为何不用直接透传 bigint：Next JSON / React props 不支持 bigint；且 2000 亿在安全整数内。
 */
export function fromMeetupPeopleDb(value: bigint | number | string): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return Number.isFinite(value) ? value : 0;
}

/** number → Prisma BigInt（SQLite Int 仅约 21 亿，2000 亿须 BigInt 列） */
export function toMeetupPeopleDb(value: number): bigint {
  return BigInt(Math.trunc(value));
}

/**
 * 解析人数手输：编辑中可为空；提交/失焦时调用。
 * 允许自由键入后在此收成整数，避免 type=number + min 卡住删改。
 */
export function parseMeetupPeopleInput(
  raw: string,
): { ok: true; value: number } | { ok: false; error: string } {
  const text = raw.trim();
  if (text === "") {
    return { ok: false, error: "请填写人数" };
  }
  // 仅接受非负整数字符串，拒绝小数/科学计数/文字
  if (!/^\d+$/.test(text)) {
    return { ok: false, error: "人数须为整数，请勿输入文字或小数" };
  }
  // 超长数字 Number 会丢精度；先挡在安全整数位数外
  if (text.length > String(MEETUP_MAX_PEOPLE).length) {
    return { ok: false, error: `人数不能超过 ${MEETUP_MAX_PEOPLE}` };
  }
  const value = Number(text);
  if (!Number.isSafeInteger(value)) {
    return { ok: false, error: "人数无效" };
  }
  if (value < MEETUP_MIN_PEOPLE) {
    return { ok: false, error: `人数至少为 ${MEETUP_MIN_PEOPLE}` };
  }
  if (value > MEETUP_MAX_PEOPLE) {
    return { ok: false, error: `人数不能超过 ${MEETUP_MAX_PEOPLE}` };
  }
  return { ok: true, value };
}

const CATEGORY_KEYS = new Set<string>(MEETUP_CATEGORIES.map((c) => c.key));
const STATUS_KEYS = new Set<string>(MEETUP_STATUSES.map((s) => s.key));
const SORT_KEYS = new Set<string>(MEETUP_SORTS.map((s) => s.key));

export function isMeetupCategory(value: string): value is MeetupCategoryKey {
  return CATEGORY_KEYS.has(value);
}

export function isMeetupStatus(value: string): value is MeetupStatusKey {
  return STATUS_KEYS.has(value);
}

export function isMeetupSort(value: string): value is MeetupSortKey {
  return SORT_KEYS.has(value);
}

export function parseMeetupSort(value?: string | null): MeetupSortKey {
  const key = (value || "").trim();
  return isMeetupSort(key) ? key : MEETUP_SORT_DEFAULT;
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

/**
 * 历史：曾用「近 30 天」裁剪广场，导致超窗历史局被藏。
 * 现政策：未取消一律可进广场；时间相关性交给排序（综合/最新），不再按 startsAt 硬过滤。
 * 常量保留仅作文档/兼容引用，buildMeetupPlazaWhere 不再使用。
 */
export const MEETUP_PLAZA_PAST_MS = 30 * 24 * 60 * 60 * 1000;

/** 广场列表条数上限 */
export const MEETUP_PLAZA_TAKE = 100;

/**
 * 前台约搭广场 / API 列表共用 where：未取消即可见（含历史、满员、已截止）。
 * includePast 保留兼容（旧客户端 past=1）；时间窗已取消，参数无实际作用。
 */
export function buildMeetupPlazaWhere(input?: {
  category?: string;
  /** @deprecated 时间窗已去掉；保留以免旧调用报错 */
  includePast?: boolean;
  now?: Date;
}): {
  category?: string;
  status: { not: string };
} {
  const where: {
    category?: string;
    status: { not: string };
  } = {
    status: { not: "CANCELLED" },
  };
  const category = input?.category?.trim() || "";
  if (category && isMeetupCategory(category)) {
    where.category = category;
  }
  return where;
}

/** 地球半径（km），Haversine 用 */
const EARTH_RADIUS_KM = 6371;

/** 两坐标球面距离（km）；任一非法则返回 null */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number | null {
  if (
    ![lat1, lng1, lat2, lng2].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    )
  ) {
    return null;
  }
  if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) return null;
  if (lng1 < -180 || lng1 > 180 || lng2 < -180 || lng2 > 180) return null;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** 解析可选经纬度；空/非法 → null（旧数据与仅填地点文案时兼容） */
export function parseOptionalCoord(
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

export type MeetupPlazaSortable = {
  createdAt: Date;
  startsAt: Date;
  status: string;
  maxPeople: number;
  joinCount: number;
  latitude?: number | null;
  longitude?: number | null;
};

function statusScore(status: string): number {
  if (status === "OPEN") return MEETUP_SCORE_WEIGHTS.statusOpen;
  if (status === "FULL") return MEETUP_SCORE_WEIGHTS.statusFull;
  return MEETUP_SCORE_WEIGHTS.statusClosed;
}

/** 综合分：越大越靠前；权重集中在 MEETUP_SCORE_WEIGHTS */
export function meetupPlazaScore(
  row: MeetupPlazaSortable,
  now: Date = new Date(),
): number {
  const spotsLeft = Math.max(row.maxPeople - row.joinCount, 0);
  const spotsRatio =
    row.maxPeople > 0 ? spotsLeft / row.maxPeople : 0;
  const dayMs = 24 * 60 * 60 * 1000;
  const daysAway = Math.abs(row.startsAt.getTime() - now.getTime()) / dayMs;
  const horizon = MEETUP_SCORE_WEIGHTS.timeHorizonDays;
  const timeFactor = Math.max(0, 1 - daysAway / horizon);

  return (
    statusScore(row.status) +
    spotsRatio * MEETUP_SCORE_WEIGHTS.spotsLeftRatio +
    timeFactor * MEETUP_SCORE_WEIGHTS.timeProximity
  );
}

/**
 * 广场列表内存排序（与 API/页面共用）。
 * nearest：无用户定位或活动无坐标时，该条排到有距离的后面，组内按 startsAt 新→旧，避免崩溃。
 */
export function sortMeetupPlazaRows<T extends MeetupPlazaSortable>(
  rows: T[],
  input: {
    sort?: string | null;
    userLat?: number | null;
    userLng?: number | null;
    now?: Date;
  } = {},
): T[] {
  const sort = parseMeetupSort(input.sort);
  const now = input?.now ?? new Date();
  const userLat = input.userLat;
  const userLng = input.userLng;
  const hasUser =
    typeof userLat === "number" &&
    Number.isFinite(userLat) &&
    typeof userLng === "number" &&
    Number.isFinite(userLng);

  const list = [...rows];

  if (sort === "latest") {
    // 最新 = 创建时间新→旧；同秒再按开场时间，避免「刚改开场」误当新发
    list.sort((a, b) => {
      const byCreated = b.createdAt.getTime() - a.createdAt.getTime();
      if (byCreated !== 0) return byCreated;
      return b.startsAt.getTime() - a.startsAt.getTime();
    });
    return list;
  }

  if (sort === "nearest") {
    list.sort((a, b) => {
      const distA =
        hasUser &&
        a.latitude != null &&
        a.longitude != null
          ? haversineKm(userLat!, userLng!, a.latitude, a.longitude)
          : null;
      const distB =
        hasUser &&
        b.latitude != null &&
        b.longitude != null
          ? haversineKm(userLat!, userLng!, b.latitude, b.longitude)
          : null;

      // 有距离的排前面；都有则近的优先
      if (distA != null && distB != null) {
        if (distA !== distB) return distA - distB;
      } else if (distA != null) {
        return -1;
      } else if (distB != null) {
        return 1;
      }
      // 无坐标/无定位：降级按开场时间新→旧
      return b.startsAt.getTime() - a.startsAt.getTime();
    });
    return list;
  }

  // score（综合）
  list.sort((a, b) => {
    const scoreDiff = meetupPlazaScore(b, now) - meetupPlazaScore(a, now);
    if (scoreDiff !== 0) return scoreDiff;
    return b.startsAt.getTime() - a.startsAt.getTime();
  });
  return list;
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

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"] as const;

/**
 * 广场卡片时间：按活动时区墙钟展示（非浏览者浏览器本地），避免国外局错 8 小时。
 * 非北京时间时附短标签，如「纽约」。
 */
export function formatMeetupWhen(
  date: Date,
  timeZone: string = DEFAULT_MEETUP_TIMEZONE,
): string {
  const tz = normalizeMeetupTimeZone(timeZone);
  const p = getZonedParts(date, tz);
  const m = String(p.month).padStart(2, "0");
  const d = String(p.day).padStart(2, "0");
  const hh = String(p.hour).padStart(2, "0");
  const mm = String(p.minute).padStart(2, "0");
  const base = `${p.year}-${m}-${d} ${hh}:${mm}`;
  if (tz === DEFAULT_MEETUP_TIMEZONE) return base;
  return `${base}（${meetupTimeZoneLabel(tz)}）`;
}

/** 详情页时段：08.07 周五 19:00 - 22:00（活动时区墙钟） */
export function formatMeetupTimeRange(
  startsAt: Date,
  endsAt?: Date | null,
  timeZone: string = DEFAULT_MEETUP_TIMEZONE,
): string {
  const tz = normalizeMeetupTimeZone(timeZone);
  const s = getZonedParts(startsAt, tz);
  const m = String(s.month).padStart(2, "0");
  const d = String(s.day).padStart(2, "0");
  const week = WEEKDAYS[s.weekday];
  const hh = String(s.hour).padStart(2, "0");
  const mm = String(s.minute).padStart(2, "0");
  let start = `${m}.${d} 周${week} ${hh}:${mm}`;
  if (tz !== DEFAULT_MEETUP_TIMEZONE) {
    start = `${start} ${meetupTimeZoneLabel(tz)}`;
  }
  if (!endsAt || Number.isNaN(endsAt.getTime())) {
    return tz === DEFAULT_MEETUP_TIMEZONE
      ? start
      : `${start}（${formatTimeZoneOffsetLabel(startsAt, tz)}）`;
  }
  const e = getZonedParts(endsAt, tz);
  const eh = String(e.hour).padStart(2, "0");
  const em = String(e.minute).padStart(2, "0");
  const sameDay =
    e.year === s.year && e.month === s.month && e.day === s.day;
  const range = sameDay
    ? `${start} - ${eh}:${em}`
    : `${start} - ${String(e.month).padStart(2, "0")}.${String(e.day).padStart(2, "0")} ${eh}:${em}`;
  if (tz === DEFAULT_MEETUP_TIMEZONE) return range;
  return `${range}（${formatTimeZoneOffsetLabel(startsAt, tz)}）`;
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

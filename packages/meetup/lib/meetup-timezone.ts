/**
 * 约搭活动时区：存 UTC 瞬间 + IANA timezone，编辑/展示用活动时区墙钟，避免错 8 小时。
 * 默认 Asia/Shanghai（北京时间）；国外局可搜城市带出时区。
 */

import { MEETUP_TZ_CITIES_DATA } from "@andyyyds/meetup/lib/meetup-tz-cities-data";
import type { MeetupTzCity } from "@andyyyds/meetup/lib/meetup-timezone-types";

export type { MeetupTzCity } from "@andyyyds/meetup/lib/meetup-timezone-types";

export const DEFAULT_MEETUP_TIMEZONE = "Asia/Shanghai";

/** 本地城市库（独立数据文件，勿把无关巨型库塞进无关页面） */
export const MEETUP_TZ_CITIES: MeetupTzCity[] = MEETUP_TZ_CITIES_DATA;

/** 快捷入口（表单顶部胶囊） */
export const MEETUP_TZ_QUICK_PICKS = [
  "beijing",
  "newyork",
  "losangeles",
  "london",
  "tokyo",
  "sydney",
] as const;

/**
 * 同一 IANA 区多城时，展示用「代表性城市」标签，避免奥马哈把芝加哥区显示成奥马哈。
 * 用户点选具体城市后仍以该 IANA 存库；墙钟偏移一致即可。
 */
const PREFERRED_TZ_LABEL_ZH: Record<string, string> = {
  "Asia/Shanghai": "北京时间",
  "Asia/Hong_Kong": "香港",
  "Asia/Taipei": "台北",
  "Asia/Tokyo": "东京",
  "Asia/Seoul": "首尔",
  "Asia/Singapore": "新加坡",
  "Asia/Bangkok": "曼谷",
  "Asia/Dubai": "迪拜",
  "Asia/Kolkata": "新德里",
  "America/New_York": "纽约",
  "America/Chicago": "芝加哥",
  "America/Denver": "丹佛",
  "America/Los_Angeles": "洛杉矶",
  "America/Toronto": "多伦多",
  "America/Vancouver": "温哥华",
  "America/Sao_Paulo": "圣保罗",
  "Europe/London": "伦敦",
  "Europe/Paris": "巴黎",
  "Europe/Berlin": "柏林",
  "Europe/Moscow": "莫斯科",
  "Australia/Sydney": "悉尼",
  "Pacific/Auckland": "奥克兰",
  "Africa/Cairo": "开罗",
  "Africa/Johannesburg": "约翰内斯堡",
};

export function isValidIanaTimeZone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeMeetupTimeZone(
  raw: string | null | undefined,
): string {
  const tz = (raw || "").trim() || DEFAULT_MEETUP_TIMEZONE;
  return isValidIanaTimeZone(tz) ? tz : DEFAULT_MEETUP_TIMEZONE;
}

/** 某 UTC 瞬间在指定时区的「本地读数」相对 UTC 的偏移（毫秒） */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second || "0"),
  );
  return asUtc - date.getTime();
}

/**
 * 把「活动时区墙钟」转为 UTC Date 存库。
 * wall 支持 datetime-local：YYYY-MM-DDTHH:mm 或带秒；也接受已带 Z/偏移的 ISO（按绝对时间）。
 */
export function wallClockToUtc(
  wall: string,
  timeZone: string,
): Date | null {
  const raw = wall.trim();
  if (!raw) return null;

  // 已是绝对时间：直接解析，timezone 仅作展示元数据
  if (/[zZ]$/.test(raw) || /[+-]\d{2}:?\d{2}$/.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!m) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] || 0);
  const tz = normalizeMeetupTimeZone(timeZone);

  // 先按「墙钟数字 = UTC」猜一瞬，再按该时区真实偏移回推；DST 边界再校正一次
  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset1 = getTimeZoneOffsetMs(utc, tz);
  utc = new Date(utc.getTime() - offset1);
  const offset2 = getTimeZoneOffsetMs(utc, tz);
  if (offset2 !== offset1) {
    utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second) - offset2);
  }
  return Number.isNaN(utc.getTime()) ? null : utc;
}

/** UTC → 活动时区墙钟，供 datetime-local 回填 */
export function utcToWallClock(date: Date, timeZone: string): string {
  const tz = normalizeMeetupTimeZone(timeZone);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=Sun
};

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const tz = normalizeMeetupTimeZone(timeZone);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: weekdayMap[map.weekday || ""] ?? 0,
  };
}

/** 时区短标签：优先代表性中文城市名，否则库内首个匹配或 IANA 尾段 */
export function meetupTimeZoneLabel(timeZone: string): string {
  const tz = normalizeMeetupTimeZone(timeZone);
  if (PREFERRED_TZ_LABEL_ZH[tz]) return PREFERRED_TZ_LABEL_ZH[tz];
  const city = MEETUP_TZ_CITIES.find((c) => c.timeZone === tz);
  if (city) return city.labelZh;
  const tail = tz.split("/").pop() || tz;
  return tail.replace(/_/g, " ");
}

export function formatTimeZoneOffsetLabel(
  date: Date,
  timeZone: string,
): string {
  const tz = normalizeMeetupTimeZone(timeZone);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  });
  const parts = fmt.formatToParts(date);
  const name = parts.find((p) => p.type === "timeZoneName")?.value || "";
  return name || tz;
}

function citySearchHaystack(c: MeetupTzCity): string {
  const alias = (c.aliases || []).join(" ");
  return `${c.labelZh} ${c.labelEn} ${alias} ${c.countryZh} ${c.timeZone}`.toLowerCase();
}

/**
 * 本地库中英/别名搜索。空关键词返回快捷胶囊城市；有关键词按匹配强度排序。
 * 奥马哈等冷门但重要城市走本地库，不依赖 Nominatim。
 */
export function searchMeetupTzCities(query: string, limit = 20): MeetupTzCity[] {
  const raw = query.trim();
  const q = raw.toLowerCase();
  if (!q) {
    return MEETUP_TZ_CITIES.filter((c) =>
      (MEETUP_TZ_QUICK_PICKS as readonly string[]).includes(c.id),
    );
  }
  const scored = MEETUP_TZ_CITIES.map((c) => {
    const enLower = c.labelEn.toLowerCase();
    const aliases = c.aliases || [];
    let score = 0;
    if (c.labelZh === raw) score += 100;
    if (enLower === q) score += 90;
    if (aliases.some((a) => a === raw || a.toLowerCase() === q)) score += 85;
    if (c.labelZh.startsWith(raw)) score += 70;
    if (enLower.startsWith(q)) score += 65;
    if (c.labelZh.includes(raw)) score += 50;
    if (enLower.includes(q)) score += 40;
    if (aliases.some((a) => a.includes(raw) || a.toLowerCase().includes(q))) {
      score += 45;
    }
    if (c.countryZh.includes(raw)) score += 15;
    if (c.timeZone.toLowerCase().includes(q)) score += 25;
    if (score === 0 && citySearchHaystack(c).includes(q)) score += 10;
    return { c, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.labelZh.localeCompare(b.c.labelZh, "zh"));
  return scored.slice(0, limit).map((x) => x.c);
}

/** 默认开始：活动时区「明天整点」墙钟 */
export function defaultMeetupStartWall(
  timeZone: string = DEFAULT_MEETUP_TIMEZONE,
): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const wall = utcToWallClock(tomorrow, timeZone);
  return wall.replace(/:\d{2}$/, ":00");
}

/** 默认结束：开始墙钟 + 3 小时（同日简单加法，跨日也成立） */
export function defaultMeetupEndWall(startWall: string): string {
  const m = startWall.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
  );
  if (!m) return startWall;
  const utc = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]) + 3,
    Number(m[5]),
  );
  const d = new Date(utc);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

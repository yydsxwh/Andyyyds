/**
 * 约搭活动时区：存 UTC 瞬间 + IANA timezone，编辑/展示用活动时区墙钟，避免错 8 小时。
 * 默认 Asia/Shanghai（北京时间）；国外局可搜城市带出时区。
 */

export const DEFAULT_MEETUP_TIMEZONE = "Asia/Shanghai";

export type MeetupTzCity = {
  id: string;
  labelZh: string;
  labelEn: string;
  timeZone: string;
  countryZh: string;
};

/** 常用城市（中英可搜）；覆盖国内与主要海外目的地，无需 key */
export const MEETUP_TZ_CITIES: MeetupTzCity[] = [
  { id: "beijing", labelZh: "北京", labelEn: "Beijing", timeZone: "Asia/Shanghai", countryZh: "中国" },
  { id: "shanghai", labelZh: "上海", labelEn: "Shanghai", timeZone: "Asia/Shanghai", countryZh: "中国" },
  { id: "guangzhou", labelZh: "广州", labelEn: "Guangzhou", timeZone: "Asia/Shanghai", countryZh: "中国" },
  { id: "shenzhen", labelZh: "深圳", labelEn: "Shenzhen", timeZone: "Asia/Shanghai", countryZh: "中国" },
  { id: "chengdu", labelZh: "成都", labelEn: "Chengdu", timeZone: "Asia/Shanghai", countryZh: "中国" },
  { id: "hangzhou", labelZh: "杭州", labelEn: "Hangzhou", timeZone: "Asia/Shanghai", countryZh: "中国" },
  { id: "hongkong", labelZh: "香港", labelEn: "Hong Kong", timeZone: "Asia/Hong_Kong", countryZh: "中国" },
  { id: "taipei", labelZh: "台北", labelEn: "Taipei", timeZone: "Asia/Taipei", countryZh: "中国" },
  { id: "macau", labelZh: "澳门", labelEn: "Macau", timeZone: "Asia/Macau", countryZh: "中国" },
  { id: "tokyo", labelZh: "东京", labelEn: "Tokyo", timeZone: "Asia/Tokyo", countryZh: "日本" },
  { id: "osaka", labelZh: "大阪", labelEn: "Osaka", timeZone: "Asia/Tokyo", countryZh: "日本" },
  { id: "seoul", labelZh: "首尔", labelEn: "Seoul", timeZone: "Asia/Seoul", countryZh: "韩国" },
  { id: "singapore", labelZh: "新加坡", labelEn: "Singapore", timeZone: "Asia/Singapore", countryZh: "新加坡" },
  { id: "bangkok", labelZh: "曼谷", labelEn: "Bangkok", timeZone: "Asia/Bangkok", countryZh: "泰国" },
  { id: "kualalumpur", labelZh: "吉隆坡", labelEn: "Kuala Lumpur", timeZone: "Asia/Kuala_Lumpur", countryZh: "马来西亚" },
  { id: "jakarta", labelZh: "雅加达", labelEn: "Jakarta", timeZone: "Asia/Jakarta", countryZh: "印尼" },
  { id: "manila", labelZh: "马尼拉", labelEn: "Manila", timeZone: "Asia/Manila", countryZh: "菲律宾" },
  { id: "hanoi", labelZh: "河内", labelEn: "Hanoi", timeZone: "Asia/Bangkok", countryZh: "越南" },
  { id: "dubai", labelZh: "迪拜", labelEn: "Dubai", timeZone: "Asia/Dubai", countryZh: "阿联酋" },
  { id: "delhi", labelZh: "新德里", labelEn: "New Delhi", timeZone: "Asia/Kolkata", countryZh: "印度" },
  { id: "mumbai", labelZh: "孟买", labelEn: "Mumbai", timeZone: "Asia/Kolkata", countryZh: "印度" },
  { id: "newyork", labelZh: "纽约", labelEn: "New York", timeZone: "America/New_York", countryZh: "美国" },
  { id: "losangeles", labelZh: "洛杉矶", labelEn: "Los Angeles", timeZone: "America/Los_Angeles", countryZh: "美国" },
  { id: "sanfrancisco", labelZh: "旧金山", labelEn: "San Francisco", timeZone: "America/Los_Angeles", countryZh: "美国" },
  { id: "chicago", labelZh: "芝加哥", labelEn: "Chicago", timeZone: "America/Chicago", countryZh: "美国" },
  { id: "seattle", labelZh: "西雅图", labelEn: "Seattle", timeZone: "America/Los_Angeles", countryZh: "美国" },
  { id: "miami", labelZh: "迈阿密", labelEn: "Miami", timeZone: "America/New_York", countryZh: "美国" },
  { id: "boston", labelZh: "波士顿", labelEn: "Boston", timeZone: "America/New_York", countryZh: "美国" },
  { id: "honolulu", labelZh: "檀香山", labelEn: "Honolulu", timeZone: "Pacific/Honolulu", countryZh: "美国" },
  { id: "toronto", labelZh: "多伦多", labelEn: "Toronto", timeZone: "America/Toronto", countryZh: "加拿大" },
  { id: "vancouver", labelZh: "温哥华", labelEn: "Vancouver", timeZone: "America/Vancouver", countryZh: "加拿大" },
  { id: "mexico", labelZh: "墨西哥城", labelEn: "Mexico City", timeZone: "America/Mexico_City", countryZh: "墨西哥" },
  { id: "saopaulo", labelZh: "圣保罗", labelEn: "Sao Paulo", timeZone: "America/Sao_Paulo", countryZh: "巴西" },
  { id: "london", labelZh: "伦敦", labelEn: "London", timeZone: "Europe/London", countryZh: "英国" },
  { id: "paris", labelZh: "巴黎", labelEn: "Paris", timeZone: "Europe/Paris", countryZh: "法国" },
  { id: "berlin", labelZh: "柏林", labelEn: "Berlin", timeZone: "Europe/Berlin", countryZh: "德国" },
  { id: "amsterdam", labelZh: "阿姆斯特丹", labelEn: "Amsterdam", timeZone: "Europe/Amsterdam", countryZh: "荷兰" },
  { id: "rome", labelZh: "罗马", labelEn: "Rome", timeZone: "Europe/Rome", countryZh: "意大利" },
  { id: "madrid", labelZh: "马德里", labelEn: "Madrid", timeZone: "Europe/Madrid", countryZh: "西班牙" },
  { id: "moscow", labelZh: "莫斯科", labelEn: "Moscow", timeZone: "Europe/Moscow", countryZh: "俄罗斯" },
  { id: "istanbul", labelZh: "伊斯坦布尔", labelEn: "Istanbul", timeZone: "Europe/Istanbul", countryZh: "土耳其" },
  { id: "sydney", labelZh: "悉尼", labelEn: "Sydney", timeZone: "Australia/Sydney", countryZh: "澳大利亚" },
  { id: "melbourne", labelZh: "墨尔本", labelEn: "Melbourne", timeZone: "Australia/Melbourne", countryZh: "澳大利亚" },
  { id: "auckland", labelZh: "奥克兰", labelEn: "Auckland", timeZone: "Pacific/Auckland", countryZh: "新西兰" },
  { id: "cairo", labelZh: "开罗", labelEn: "Cairo", timeZone: "Africa/Cairo", countryZh: "埃及" },
  { id: "johannesburg", labelZh: "约翰内斯堡", labelEn: "Johannesburg", timeZone: "Africa/Johannesburg", countryZh: "南非" },
];

/** 快捷入口（表单顶部胶囊） */
export const MEETUP_TZ_QUICK_PICKS = [
  "beijing",
  "newyork",
  "losangeles",
  "london",
  "tokyo",
  "sydney",
] as const;

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

/** 时区短标签：优先中文城市名，否则 IANA 尾段 */
export function meetupTimeZoneLabel(timeZone: string): string {
  const tz = normalizeMeetupTimeZone(timeZone);
  const city = MEETUP_TZ_CITIES.find((c) => c.timeZone === tz);
  if (city) {
    // 同一时区多城时用「北京时间」类表述
    if (tz === "Asia/Shanghai") return "北京时间";
    return city.labelZh;
  }
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

export function searchMeetupTzCities(query: string, limit = 12): MeetupTzCity[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return MEETUP_TZ_CITIES.filter((c) =>
      (MEETUP_TZ_QUICK_PICKS as readonly string[]).includes(c.id),
    );
  }
  const scored = MEETUP_TZ_CITIES.map((c) => {
    const hay = `${c.labelZh} ${c.labelEn} ${c.countryZh} ${c.timeZone}`.toLowerCase();
    let score = 0;
    if (c.labelZh === query.trim()) score += 100;
    if (c.labelEn.toLowerCase() === q) score += 90;
    if (c.labelZh.includes(query.trim())) score += 50;
    if (c.labelEn.toLowerCase().includes(q)) score += 40;
    if (c.countryZh.includes(query.trim())) score += 20;
    if (c.timeZone.toLowerCase().includes(q)) score += 30;
    if (hay.includes(q)) score += 10;
    return { c, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
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

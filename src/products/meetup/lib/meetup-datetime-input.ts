/**
 * 约搭开始/结束时间：墙钟字符串解析与手输校验。
 * 对外仍产出 YYYY-MM-DDTHH:mm，与 wallClockToUtc 兼容；此处不做时区换算。
 */

export type HourMode = "12" | "24";

export type WallParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
};

export const MEETUP_HOUR_MODE_STORAGE_KEY = "meetup-datetime-hour-mode";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function parseWallClock(value: string): WallParts | null {
  const m = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  if (!isValidYmd(year, month, day) || hour > 23 || minute > 59) return null;
  return { year, month, day, hour, minute };
}

export function formatWallClock(parts: WallParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** 闭合态展示：按当前 12/24 制可读格式 */
export function formatWallDisplay(parts: WallParts, mode: HourMode): string {
  const date = `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
  if (mode === "24") {
    return `${date} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
  }
  const { clock, period } = to12Hour(parts.hour);
  return `${date} ${pad2(clock)}:${pad2(parts.minute)} ${period === "am" ? "上午" : "下午"}`;
}

export function to12Hour(hour24: number): { clock: number; period: "am" | "pm" } {
  const period = hour24 < 12 ? "am" : "pm";
  const clock = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { clock, period };
}

export function from12Hour(clock: number, period: "am" | "pm"): number {
  const h = ((clock % 12) + 12) % 12;
  return period === "pm" ? h + 12 : h;
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function normalizeManualText(raw: string): string {
  return raw
    .trim()
    .replace(/[：]/g, ":")
    .replace(/[／]/g, "/")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ");
}

type AmPm = "am" | "pm";

function parseAmPmToken(token: string): AmPm | null {
  const t = token.trim().toLowerCase();
  if (!t) return null;
  if (t === "am" || t === "a.m." || t === "a.m") return "am";
  if (t === "pm" || t === "p.m." || t === "p.m") return "pm";
  if (t === "上午" || t === "早上" || t === "凌晨") return "am";
  if (t === "下午" || t === "晚上" || t === "傍晚") return "pm";
  return null;
}

export type ParseManualResult =
  | { ok: true; parts: WallParts }
  | { ok: false; error: string };

/**
 * 手输确认：仅时间则沿用当前草稿日期；带日期则整段覆盖。
 * 12h 模式要求上午/下午或 am/pm；24h 模式拒绝 am/pm 以免歧义。
 */
export function parseManualDatetimeInput(
  input: string,
  mode: HourMode,
  fallbackDate: Pick<WallParts, "year" | "month" | "day">,
): ParseManualResult {
  const text = normalizeManualText(input);
  if (!text) {
    return { ok: false, error: "请输入时间，例如 23:55 或 11:59 下午" };
  }

  // 日期 + 时间（可选 am/pm）
  const withDate = text.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})(?:\s*(.+))?$/,
  );
  // 仅时间
  const timeOnly = text.match(/^(\d{1,2}):(\d{2})(?:\s*(.+))?$/);

  let year = fallbackDate.year;
  let month = fallbackDate.month;
  let day = fallbackDate.day;
  let hourRaw: number;
  let minute: number;
  let suffix = "";

  if (withDate) {
    year = Number(withDate[1]);
    month = Number(withDate[2]);
    day = Number(withDate[3]);
    hourRaw = Number(withDate[4]);
    minute = Number(withDate[5]);
    suffix = (withDate[6] || "").trim();
  } else if (timeOnly) {
    hourRaw = Number(timeOnly[1]);
    minute = Number(timeOnly[2]);
    suffix = (timeOnly[3] || "").trim();
  } else {
    return {
      ok: false,
      error:
        mode === "24"
          ? "格式不对，请用 23:55 或 2026-08-10 23:55"
          : "格式不对，请用 11:59 下午 / 11:59 PM 或带日期",
    };
  }

  if (!isValidYmd(year, month, day)) {
    return { ok: false, error: "日期无效，请检查年月日" };
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return { ok: false, error: "分钟须为 00–59" };
  }

  const period = parseAmPmToken(suffix);

  if (mode === "24") {
    if (suffix && period) {
      return {
        ok: false,
        error: "当前为 24 小时制，请输入如 23:55，勿加上午/下午",
      };
    }
    if (suffix && !period) {
      return { ok: false, error: "时间后缀无法识别，24 小时制请直接写 23:55" };
    }
    if (!Number.isInteger(hourRaw) || hourRaw < 0 || hourRaw > 23) {
      return { ok: false, error: "小时须为 0–23（24 小时制）" };
    }
    return { ok: true, parts: { year, month, day, hour: hourRaw, minute } };
  }

  // 12 小时制
  if (!period) {
    return {
      ok: false,
      error: "12 小时制请加上午/下午或 AM/PM，例如 11:59 下午",
    };
  }
  if (!Number.isInteger(hourRaw) || hourRaw < 1 || hourRaw > 12) {
    return { ok: false, error: "12 小时制小时须为 1–12" };
  }
  return {
    ok: true,
    parts: {
      year,
      month,
      day,
      hour: from12Hour(hourRaw, period),
      minute,
    },
  };
}

export function readStoredHourMode(): HourMode {
  if (typeof window === "undefined") return "24";
  try {
    const v = window.localStorage.getItem(MEETUP_HOUR_MODE_STORAGE_KEY);
    return v === "12" ? "12" : "24";
  } catch {
    return "24";
  }
}

export function writeStoredHourMode(mode: HourMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEETUP_HOUR_MODE_STORAGE_KEY, mode);
  } catch {
    /* 隐私模式等忽略 */
  }
}

/** 日历用：某月天数 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 该月 1 号是周几（0=周日） */
export function monthStartWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

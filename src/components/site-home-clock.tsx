"use client";

/**
 * 首页右上角时钟：挂在顶栏头像下方，不与菜单同一行，避免把导航挤残。
 * 仅在首页展示；时区偏好存 localStorage。
 */

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import {
  DEFAULT_MEETUP_TIMEZONE,
  MEETUP_TZ_CITIES,
  MEETUP_TZ_QUICK_PICKS,
  meetupTimeZoneLabel,
  normalizeMeetupTimeZone,
  searchMeetupTzCities,
} from "@andyyyds/meetup/lib/meetup-timezone";

const TZ_STORAGE_KEY = "yyds.homeClock.timeZone";
const PROVERB = "一寸光阴一寸金，寸金难买寸光阴。";

function readStoredTimeZone(): string {
  if (typeof window === "undefined") return DEFAULT_MEETUP_TIMEZONE;
  try {
    return normalizeMeetupTimeZone(
      window.localStorage.getItem(TZ_STORAGE_KEY) || "",
    );
  } catch {
    return DEFAULT_MEETUP_TIMEZONE;
  }
}

function formatClock(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(now);
  }
}

/** 按所选时区取时/分/秒，供模拟钟面指针计算 */
function getZonedHms(
  now: Date,
  timeZone: string,
): { hour: number; minute: number; second: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const num = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value || 0);
    return {
      hour: num("hour"),
      minute: num("minute"),
      second: num("second"),
    };
  } catch {
    return {
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds(),
    };
  }
}

/**
 * 艺术感模拟钟：双圈表盘、刻度、随真实时间走动的时/分/秒针。
 * 尺寸小仍可读；颜色跟品牌金，避免通用扁平时钟感。
 */
function AnalogClockFace({
  now,
  timeZone,
  className = "",
}: {
  now: Date;
  timeZone: string;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const faceId = `homeClockFace-${uid}`;
  const rimId = `homeClockRim-${uid}`;
  const { hour, minute, second } = getZonedHms(now, timeZone);
  // 连续角：秒带动分、分带动时，走动更顺滑
  const secondDeg = second * 6;
  const minuteDeg = minute * 6 + second * 0.1;
  const hourDeg = (hour % 12) * 30 + minute * 0.5 + second * (0.5 / 60);

  const ticks = Array.from({ length: 12 }, (_, i) => {
    const deg = i * 30;
    const major = i % 3 === 0;
    return (
      <line
        key={i}
        x1="32"
        y1={major ? 8.5 : 9.5}
        x2="32"
        y2={major ? 13.5 : 12}
        stroke="currentColor"
        strokeWidth={major ? 1.6 : 1}
        strokeLinecap="round"
        opacity={major ? 0.72 : 0.38}
        transform={`rotate(${deg} 32 32)`}
      />
    );
  });

  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
    >
      <defs>
        <radialGradient id={faceId} cx="50%" cy="38%" r="62%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.18" />
          <stop offset="55%" stopColor="var(--brand)" stopOpacity="0.06" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={rimId} x1="12" y1="8" x2="52" y2="56">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--brand-strong)" stopOpacity="0.75" />
        </linearGradient>
      </defs>

      {/* 外圈光晕 */}
      <circle cx="32" cy="32" r="30" fill={`url(#${faceId})`} />
      {/* 双层表圈 */}
      <circle
        cx="32"
        cy="32"
        r="28.5"
        stroke={`url(#${rimId})`}
        strokeWidth="1.75"
      />
      <circle
        cx="32"
        cy="32"
        r="25.2"
        stroke="currentColor"
        strokeWidth="0.7"
        opacity="0.28"
      />

      {ticks}

      {/* 时针：略粗、偏短 */}
      <g transform={`rotate(${hourDeg} 32 32)`}>
        <line
          x1="32"
          y1="32"
          x2="32"
          y2="18"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.92"
        />
      </g>
      {/* 分针 */}
      <g transform={`rotate(${minuteDeg} 32 32)`}>
        <line
          x1="32"
          y1="33.5"
          x2="32"
          y2="12.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          opacity="0.85"
        />
      </g>
      {/* 秒针：细长、品牌色，尾部小配重 */}
      <g transform={`rotate(${secondDeg} 32 32)`}>
        <line
          x1="32"
          y1="38"
          x2="32"
          y2="10"
          stroke="var(--brand-strong)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <circle cx="32" cy="39.5" r="1.35" fill="var(--brand-strong)" />
      </g>

      {/* 轴心：双环铆钉感 */}
      <circle cx="32" cy="32" r="2.6" fill="var(--brand)" />
      <circle cx="32" cy="32" r="1.15" fill="white" opacity="0.9" />
    </svg>
  );
}

export function SiteHomeClock({
  className = "",
  style,
  forceVisible = false,
  fill = false,
}: {
  className?: string;
  style?: CSSProperties;
  /** 装扮画布预览不在「/」，仍要渲染真实时钟 */
  forceVisible?: boolean;
  /** 铺满装扮指定的盒子，而不是顶栏那套右对齐收缩 */
  fill?: boolean;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const visible = forceVisible || isHome;
  const [timeZone, setTimeZone] = useState(DEFAULT_MEETUP_TIMEZONE);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeZone(readStoredTimeZone());
  }, []);

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [visible]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const hits = useMemo(() => searchMeetupTzCities(query, 16), [query]);
  const quick = useMemo(
    () =>
      MEETUP_TZ_QUICK_PICKS.map(
        (id) => MEETUP_TZ_CITIES.find((c) => c.id === id)!,
      ).filter(Boolean),
    [],
  );

  if (!visible) return null;

  const label = meetupTimeZoneLabel(timeZone);
  const clockText = formatClock(now, timeZone);

  function pickZone(tz: string) {
    const next = normalizeMeetupTimeZone(tz);
    setTimeZone(next);
    try {
      window.localStorage.setItem(TZ_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    setOpen(false);
    setQuery("");
  }

  return (
    <div
      ref={rootRef}
      style={style}
      className={
        fill
          ? `relative flex h-full min-h-11 w-full max-w-none flex-col items-stretch gap-0.5 ${className}`
          : `relative flex max-w-[min(100%,20rem)] flex-col items-end gap-0.5 sm:max-w-none ${className}`
      }
    >
      <button
        type="button"
        className={
          fill
            ? "flex min-h-11 h-full w-full items-center justify-center gap-1.5 rounded-[28px] border border-[var(--line)] bg-white/50 px-2 py-1 text-[var(--ink)] shadow-[var(--glass-inset)] backdrop-blur-md transition active:bg-black/5 sm:px-3"
            : "flex min-h-11 items-center gap-1 rounded-full border border-[var(--line)] bg-white/50 px-1.5 py-1 text-[var(--ink)] shadow-[var(--glass-inset)] backdrop-blur-md transition active:bg-black/5 sm:gap-1.5 sm:px-3"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`当前时区：${label}（点击切换）`}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={
            fill
              ? "relative inline-flex aspect-square h-[min(4.5rem,70%)] w-auto shrink-0 text-[var(--ink)]"
              : "relative inline-flex h-8 w-8 shrink-0 text-[var(--ink)] sm:h-9 sm:w-9"
          }
        >
          <AnalogClockFace
            now={now}
            timeZone={timeZone}
            className="h-full w-full"
          />
        </span>
        <span
          className={
            fill
              ? "min-w-0 truncate tabular-nums text-sm font-semibold tracking-wide"
              : "hidden tabular-nums text-sm font-semibold tracking-wide min-[480px]:inline"
          }
        >
          {clockText}
        </span>
        <span
          className={
            fill
              ? "hidden min-w-0 max-w-[7rem] truncate text-xs text-[var(--muted)] min-[360px]:inline"
              : "hidden max-w-[5.5rem] truncate text-xs text-[var(--muted)] sm:inline"
          }
        >
          {label}
        </span>
      </button>

      <p
        className={
          fill
            ? "hidden px-1 text-right text-[10px] leading-snug text-[var(--brand-strong)] min-[480px]:block"
            : "hidden max-w-[16rem] text-right text-[10px] leading-snug text-[var(--brand-strong)] sm:block sm:max-w-none sm:text-xs"
        }
        title={PROVERB}
      >
        {PROVERB}
      </p>

      {open ? (
        <div
          role="dialog"
          aria-label="选择时区"
          className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-1.5rem,20rem)] rounded-2xl border border-[var(--line)] bg-white/95 p-3 shadow-lg backdrop-blur-md"
        >
          <p className="mb-2 text-xs text-[var(--muted)]">
            选择显示时区（仅影响本机首页时钟）
          </p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {quick.map((city) => (
              <button
                key={city.id}
                type="button"
                className={`min-h-10 rounded-full px-2.5 text-xs ${
                  city.timeZone === timeZone
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--line)] text-[var(--ink)]"
                }`}
                onClick={() => pickZone(city.timeZone)}
              >
                {city.labelZh}
              </button>
            ))}
          </div>
          <input
            className="field min-h-11 w-full text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索城市，如：纽约、东京"
            autoComplete="off"
          />
          {query.trim() ? (
            <ul className="mt-2 max-h-48 overflow-y-auto overscroll-contain">
              {hits.length === 0 ? (
                <li className="px-2 py-3 text-sm text-[var(--muted)]">
                  无匹配城市
                </li>
              ) : (
                hits.map((city) => (
                  <li key={city.id}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-2 text-left text-sm hover:bg-[var(--bg-deep)]/60"
                      onClick={() => pickZone(city.timeZone)}
                    >
                      <span>{city.labelZh}</span>
                      <span className="text-xs text-[var(--muted)]">
                        {city.timeZone}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

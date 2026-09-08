"use client";

/**
 * 首页时钟：装扮决定样式。
 * 未启用自由画布时，站长可按视口百分比拖位置；启用后铺在画布盒子里。
 * 点击表盘弹出＋－逐步缩放（本机）；时区改点城市名，避免和缩放抢点击。
 */

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  HomeClockFace,
  HOME_CLOCK_FRAME_CLASS,
} from "@/components/home-clock-face";
import { HomeFloatZoomControls } from "@/components/home-float-zoom-controls";
import { useHomeFloatPlace } from "@/components/use-home-float-place";
import {
  DEFAULT_HOME_CLOCK,
  normalizeHomeClock,
  type HomeClockConfig,
} from "@andyyyds/shared/home-clock";
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

type Props = {
  config?: HomeClockConfig | null;
  canDrag?: boolean;
  className?: string;
  style?: React.CSSProperties;
  forceVisible?: boolean;
  fill?: boolean;
};

export function SiteHomeClock({
  config,
  canDrag = false,
  className = "",
  style,
  forceVisible = false,
  fill = false,
}: Props) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const visible = forceVisible || isHome;
  const clock = normalizeHomeClock(config);
  const allowViewportDrag = canDrag && !fill;
  const place = useHomeFloatPlace({
    canDrag: allowViewportDrag,
    xPercent: clock.xPercent,
    yPercent: clock.yPercent,
    persistField: "homeClock",
  });
  const [timeZone, setTimeZone] = useState(DEFAULT_MEETUP_TIMEZONE);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

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
      if (!place.rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, place.rootRef]);

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
  const frameClass =
    HOME_CLOCK_FRAME_CLASS[clock.style] || HOME_CLOCK_FRAME_CLASS.imperial;
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

  const placeStyle = place.customPlace
    ? { left: `${place.placed!.x}%`, top: `${place.placed!.y}%` }
    : { right: "0.75rem", top: "4.55rem" };
  const rootStyle = fill ? style : placeStyle;

  return (
    <div
      ref={place.rootRef}
      className={
        fill
          ? `relative flex h-full min-h-11 w-full max-w-none flex-col items-stretch gap-0.5 ${className}`
          : `fixed z-[35] flex max-w-[min(100%,20rem)] select-none flex-col items-end gap-0.5 sm:max-w-none ${
              place.dragging ? "cursor-grabbing" : ""
            } ${place.dragging || place.controlsOpen || place.scaled ? "z-[42]" : ""} ${className}`
      }
      style={rootStyle}
    >
      <div
        className={
          fill
            ? `flex h-full min-h-11 w-full items-center justify-center gap-1.5 rounded-[28px] border px-2 py-1 backdrop-blur-md transition-transform duration-200 sm:px-3 ${frameClass}`
            : `flex min-h-11 items-center gap-1 rounded-full border px-1.5 py-1 backdrop-blur-md transition-transform duration-200 sm:gap-1.5 sm:px-3 ${frameClass}`
        }
        style={{ transform: `scale(${place.scale})`, transformOrigin: fill ? "center" : "top right" }}
      >
        <button
          type="button"
          className={`flex min-h-11 items-center gap-1.5 touch-manipulation ${
            allowViewportDrag ? "cursor-grab active:cursor-grabbing" : ""
          }`}
          aria-label={place.controlsOpen ? "收起时钟缩放按钮" : "显示时钟缩放按钮"}
          title={
            allowViewportDrag
              ? "按住拖动摆位置 · 点击后用＋－逐步缩放"
              : "点击后用＋－逐步放大或缩小"
          }
          onPointerDown={place.onPointerDown}
          onPointerMove={place.onPointerMove}
          onPointerUp={place.onPointerUp}
          onPointerCancel={place.onPointerUp}
          onClick={place.onActivate}
        >
          <span
            className={
              fill
                ? "relative inline-flex aspect-square h-[min(4.5rem,70%)] w-auto shrink-0"
                : "relative inline-flex h-8 w-8 shrink-0 sm:h-9 sm:w-9"
            }
          >
            <HomeClockFace
              now={now}
              timeZone={timeZone}
              style={clock.style}
              className="h-full w-full"
            />
          </span>
          {clock.showDigital ? (
            <span
              className={
                fill
                  ? "min-w-0 truncate tabular-nums text-sm font-semibold tracking-wide"
                  : "hidden tabular-nums text-sm font-semibold tracking-wide min-[480px]:inline"
              }
            >
              {clockText}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className={
            fill
              ? "hidden min-w-0 max-w-[7rem] truncate text-xs opacity-80 min-[360px]:inline"
              : "hidden max-w-[5.5rem] truncate text-xs opacity-80 sm:inline"
          }
          aria-expanded={open}
          aria-haspopup="dialog"
          title={`当前时区：${label}（点击切换）`}
          onClick={() => setOpen((v) => !v)}
        >
          {label}
        </button>
      </div>

      {place.controlsOpen ? (
        <HomeFloatZoomControls
          align={fill ? "center" : "end"}
          canZoomIn={place.canZoomIn}
          canZoomOut={place.canZoomOut}
          onZoomIn={place.zoomIn}
          onZoomOut={place.zoomOut}
        />
      ) : null}

      {clock.showProverb ? (
        <p
          className={
            fill
              ? "hidden px-1 text-right text-[10px] leading-snug opacity-90 min-[480px]:block"
              : "hidden max-w-[16rem] text-right text-[10px] leading-snug opacity-90 sm:block sm:max-w-none sm:text-xs"
          }
          title={PROVERB}
        >
          {PROVERB}
        </p>
      ) : null}

      {allowViewportDrag ? (
        <p className="hidden text-[10px] leading-4 text-[var(--muted)] sm:block">
          {place.saveHint || "按住拖动，点击后用＋－缩放；点城市名改时区"}
        </p>
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-label="选择时区"
          className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-1.5rem,20rem)] rounded-2xl border border-[var(--line)] bg-white/95 p-3 text-[var(--ink)] shadow-lg backdrop-blur-md"
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

export { DEFAULT_HOME_CLOCK };

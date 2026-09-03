"use client";

/**
 * 首页时钟：装扮决定样式；站长可拖到任意位置，松手写入 decorateJson。
 * 访客只看摆好的位置，避免每人把钟拖乱。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  HomeClockFace,
  HOME_CLOCK_FRAME_CLASS,
} from "@/components/home-clock-face";
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
const DRAG_THRESHOLD_PX = 8;
const EDGE_PAD_PX = 8;

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

function clampBox(left: number, top: number, width: number, height: number) {
  const maxLeft = Math.max(EDGE_PAD_PX, window.innerWidth - width - EDGE_PAD_PX);
  const maxTop = Math.max(EDGE_PAD_PX, window.innerHeight - height - EDGE_PAD_PX);
  return {
    left: Math.min(maxLeft, Math.max(EDGE_PAD_PX, left)),
    top: Math.min(maxTop, Math.max(EDGE_PAD_PX, top)),
  };
}

type Props = {
  config?: HomeClockConfig | null;
  canDrag?: boolean;
};

export function SiteHomeClock({ config, canDrag = false }: Props) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const clock = normalizeHomeClock(config);
  const [timeZone, setTimeZone] = useState(DEFAULT_MEETUP_TIMEZONE);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [placed, setPlaced] = useState<{ x: number; y: number } | null>(() =>
    clock.xPercent == null || clock.yPercent == null
      ? null
      : { x: clock.xPercent, y: clock.yPercent },
  );
  const [dragging, setDragging] = useState(false);
  const [saveHint, setSaveHint] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const skipClickRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
    moved: boolean;
    lastX: number;
    lastY: number;
  } | null>(null);

  useEffect(() => {
    setTimeZone(readStoredTimeZone());
  }, []);

  useEffect(() => {
    if (clock.xPercent == null || clock.yPercent == null) {
      setPlaced(null);
      return;
    }
    setPlaced({ x: clock.xPercent, y: clock.yPercent });
  }, [clock.xPercent, clock.yPercent]);

  useEffect(() => {
    if (!isHome) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [isHome]);

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

  if (!isHome) return null;

  const label = meetupTimeZoneLabel(timeZone);
  const clockText = formatClock(now, timeZone);
  const customPlace = placed != null;

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

  async function persistPlace(xPercent: number, yPercent: number) {
    setSaveHint("正在保存位置…");
    try {
      const res = await fetch("/api/studio/decorate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // 只写位置，样式以库里为准，避免覆盖刚在装扮页改的表盘
          homeClock: { xPercent, yPercent },
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "保存失败");
      }
      setSaveHint("位置已保存，访客会看到这里");
    } catch (error) {
      setSaveHint(error instanceof Error ? error.message : "保存失败");
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!canDrag || event.button !== 0) return;
    const box = rootRef.current?.getBoundingClientRect();
    if (!box) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origLeft: box.left,
      origTop: box.top,
      moved: false,
      lastX: placed?.x ?? 0,
      lastY: placed?.y ?? 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    setDragging(true);
    setOpen(false);
    const box = rootRef.current?.getBoundingClientRect();
    const width = box?.width || 160;
    const height = box?.height || 56;
    const next = clampBox(drag.origLeft + dx, drag.origTop + dy, width, height);
    const xPercent = Math.round((next.left / window.innerWidth) * 1000) / 10;
    const yPercent = Math.round((next.top / window.innerHeight) * 1000) / 10;
    drag.lastX = xPercent;
    drag.lastY = yPercent;
    setPlaced({ x: xPercent, y: yPercent });
  }

  function onPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    if (drag.moved) {
      skipClickRef.current = true;
      void persistPlace(drag.lastX, drag.lastY);
    }
  }

  function onClockClick() {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    setOpen((v) => !v);
  }

  const placeStyle = customPlace
    ? { left: `${placed.x}%`, top: `${placed.y}%` }
    : { right: "0.75rem", top: "4.55rem" };

  return (
    <div
      ref={rootRef}
      className={`fixed z-[35] flex max-w-[min(100%,20rem)] select-none flex-col items-end gap-0.5 sm:max-w-none ${
        dragging ? "cursor-grabbing" : ""
      }`}
      style={placeStyle}
    >
      <button
        type="button"
        className={`flex min-h-11 items-center gap-1 rounded-full border px-1.5 py-1 backdrop-blur-md transition sm:gap-1.5 sm:px-3 ${
          HOME_CLOCK_FRAME_CLASS[clock.style] || HOME_CLOCK_FRAME_CLASS.imperial
        } ${canDrag ? "touch-none cursor-grab active:cursor-grabbing" : "active:opacity-90"}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={
          canDrag
            ? `按住拖动摆位置 · 当前时区：${label}`
            : `当前时区：${label}（点击切换）`
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClockClick}
      >
        <span className="relative inline-flex h-8 w-8 shrink-0 sm:h-9 sm:w-9">
          <HomeClockFace
            now={now}
            timeZone={timeZone}
            style={clock.style}
            className="h-full w-full"
          />
        </span>
        {clock.showDigital ? (
          <span className="hidden tabular-nums text-sm font-semibold tracking-wide min-[480px]:inline">
            {clockText}
          </span>
        ) : null}
        <span className="hidden max-w-[5.5rem] truncate text-xs opacity-80 sm:inline">
          {label}
        </span>
      </button>

      {clock.showProverb ? (
        <p
          className="hidden max-w-[16rem] text-right text-[10px] leading-snug opacity-90 sm:block sm:max-w-none sm:text-xs"
          title={PROVERB}
        >
          {PROVERB}
        </p>
      ) : null}

      {canDrag ? (
        <p className="hidden text-[10px] leading-4 text-[var(--muted)] sm:block">
          {saveHint || "按住时钟拖动，松手保存位置"}
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

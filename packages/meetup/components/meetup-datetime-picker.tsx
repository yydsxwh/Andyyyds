"use client";

/**
 * 约搭开始/结束自定义日期时间选择。
 * 不用原生 datetime-local（OS 弹层难做手输 + 12/24 切换）；
 * 产出仍是活动时区墙钟 YYYY-MM-DDTHH:mm，由服务端 wallClockToUtc 入库。
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  daysInMonth,
  formatWallClock,
  formatWallDisplay,
  from12Hour,
  monthStartWeekday,
  parseManualDatetimeInput,
  parseWallClock,
  readStoredHourMode,
  to12Hour,
  writeStoredHourMode,
  type HourMode,
  type WallParts,
} from "@andyyyds/meetup/lib/meetup-datetime-input";

type Props = {
  value: string;
  onChange: (wall: string) => void;
  /** 结束时间可清空 */
  allowEmpty?: boolean;
  required?: boolean;
  id?: string;
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"] as const;
const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function todayParts(): WallParts {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
  };
}

function defaultDraft(value: string): WallParts {
  return parseWallClock(value) || {
    ...todayParts(),
    hour: 10,
    minute: 0,
  };
}

function manualPlaceholder(mode: HourMode): string {
  return mode === "24"
    ? "例：23:55 或 2026-08-10 23:55"
    : "例：11:59 下午 或 11:59 PM";
}

function ScrollColumn<T extends string | number>({
  items,
  value,
  onSelect,
  format = (v) => String(v).padStart(2, "0"),
  label,
}: {
  items: readonly T[];
  value: T;
  onSelect: (v: T) => void;
  format?: (v: T) => string;
  label: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-val="${String(value)}"]`);
    if (el) {
      el.scrollIntoView({ block: "center" });
    }
  }, [value]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-1 text-center text-xs text-[var(--muted)]">{label}</div>
      <div
        ref={listRef}
        className="h-40 overflow-y-auto overscroll-contain rounded-xl border border-[var(--line)] bg-white/80"
        role="listbox"
        aria-label={label}
      >
        {items.map((item) => {
          const selected = item === value;
          return (
            <button
              key={String(item)}
              type="button"
              data-val={String(item)}
              role="option"
              aria-selected={selected}
              className={`flex min-h-11 w-full items-center justify-center touch-manipulation text-sm ${
                selected
                  ? "bg-[var(--brand-soft)] font-semibold text-[var(--brand-strong)]"
                  : "text-[var(--ink)]"
              }`}
              onClick={() => onSelect(item)}
            >
              {format(item)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MeetupDatetimePicker({
  value,
  onChange,
  allowEmpty = false,
  required = false,
  id,
}: Props) {
  const reactId = useId();
  const panelId = id || `meetup-dt-${reactId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hourMode, setHourMode] = useState<HourMode>("24");
  const [draft, setDraft] = useState<WallParts>(() => defaultDraft(value));
  const [viewYear, setViewYear] = useState(() => defaultDraft(value).year);
  const [viewMonth, setViewMonth] = useState(() => defaultDraft(value).month);
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState("");

  useEffect(() => {
    setMounted(true);
    setHourMode(readStoredHourMode());
  }, []);

  // 弹层打开时锁滚动，避免微信内底层表单跟着滑
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const display = useMemo(() => {
    const parts = parseWallClock(value);
    if (!parts) return allowEmpty && !value ? "未设置" : "选择日期时间";
    return formatWallDisplay(parts, hourMode);
  }, [value, hourMode, allowEmpty]);

  function openPicker() {
    const parts = defaultDraft(value);
    setDraft(parts);
    setViewYear(parts.year);
    setViewMonth(parts.month);
    setManual("");
    setManualError("");
    setOpen(true);
  }

  function closePicker() {
    setOpen(false);
    setManualError("");
  }

  function switchHourMode(next: HourMode) {
    setHourMode(next);
    writeStoredHourMode(next);
    setManualError("");
  }

  function applyManual() {
    const parsed = parseManualDatetimeInput(manual, hourMode, draft);
    if (!parsed.ok) {
      setManualError(parsed.error);
      return;
    }
    setDraft(parsed.parts);
    setViewYear(parsed.parts.year);
    setViewMonth(parsed.parts.month);
    setManualError("");
    // 手输成功后同步展示串，便于用户再确认
    setManual(formatWallDisplay(parsed.parts, hourMode));
  }

  function confirm() {
    // 若手输框有内容且与草稿不一致，先尝试解析手输（点确认即生效）
    if (manual.trim()) {
      const parsed = parseManualDatetimeInput(manual, hourMode, draft);
      if (!parsed.ok) {
        setManualError(parsed.error);
        return;
      }
      onChange(formatWallClock(parsed.parts));
      closePicker();
      return;
    }
    onChange(formatWallClock(draft));
    closePicker();
  }

  function clearValue() {
    if (!allowEmpty) return;
    onChange("");
    closePicker();
  }

  function jumpToday() {
    const t = todayParts();
    setDraft((prev) => ({
      ...prev,
      year: t.year,
      month: t.month,
      day: t.day,
    }));
    setViewYear(t.year);
    setViewMonth(t.month);
  }

  const calendarCells = useMemo(() => {
    const dim = daysInMonth(viewYear, viewMonth);
    const start = monthStartWeekday(viewYear, viewMonth);
    const cells: Array<{ day: number | null; key: string }> = [];
    for (let i = 0; i < start; i++) {
      cells.push({ day: null, key: `pad-${i}` });
    }
    for (let d = 1; d <= dim; d++) {
      cells.push({ day: d, key: `d-${d}` });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const period = to12Hour(draft.hour).period;
  const clock12 = to12Hour(draft.hour).clock;

  const panel =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closePicker();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${panelId}-title`}
              className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[var(--bg)] shadow-xl sm:rounded-3xl"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
                <h3 id={`${panelId}-title`} className="text-base font-semibold">
                  选择日期时间
                </h3>
                <div
                  className="inline-flex rounded-full border border-[var(--line)] p-0.5"
                  role="group"
                  aria-label="小时制"
                >
                  <button
                    type="button"
                    className={`min-h-10 touch-manipulation rounded-full px-3 text-sm ${
                      hourMode === "24"
                        ? "bg-[var(--brand)] text-white"
                        : "text-[var(--muted)]"
                    }`}
                    onClick={() => switchHourMode("24")}
                  >
                    24小时
                  </button>
                  <button
                    type="button"
                    className={`min-h-10 touch-manipulation rounded-full px-3 text-sm ${
                      hourMode === "12"
                        ? "bg-[var(--brand)] text-white"
                        : "text-[var(--muted)]"
                    }`}
                    onClick={() => switchHourMode("12")}
                  >
                    12小时
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-3">
                {/* 日历 */}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl border border-[var(--line)]"
                      aria-label="上个月"
                      onClick={() => {
                        if (viewMonth === 1) {
                          setViewYear((y) => y - 1);
                          setViewMonth(12);
                        } else {
                          setViewMonth((m) => m - 1);
                        }
                      }}
                    >
                      ‹
                    </button>
                    <div className="text-sm font-medium">
                      {viewYear}年{padMonth(viewMonth)}月
                    </div>
                    <button
                      type="button"
                      className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl border border-[var(--line)]"
                      aria-label="下个月"
                      onClick={() => {
                        if (viewMonth === 12) {
                          setViewYear((y) => y + 1);
                          setViewMonth(1);
                        } else {
                          setViewMonth((m) => m + 1);
                        }
                      }}
                    >
                      ›
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--muted)]">
                    {WEEKDAYS.map((w) => (
                      <div key={w} className="py-1">
                        {w}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarCells.map((cell) => {
                      if (cell.day == null) {
                        return <div key={cell.key} className="min-h-11" />;
                      }
                      const selected =
                        draft.year === viewYear &&
                        draft.month === viewMonth &&
                        draft.day === cell.day;
                      return (
                        <button
                          key={cell.key}
                          type="button"
                          className={`min-h-11 touch-manipulation rounded-xl text-sm ${
                            selected
                              ? "bg-[var(--ink)] text-white"
                              : "hover:bg-[var(--brand-soft)]"
                          }`}
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              year: viewYear,
                              month: viewMonth,
                              day: cell.day!,
                            }))
                          }
                        >
                          {cell.day}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex justify-between gap-2 text-sm">
                    {allowEmpty ? (
                      <button
                        type="button"
                        className="min-h-11 touch-manipulation px-2 text-[var(--muted)]"
                        onClick={clearValue}
                      >
                        清除
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      className="min-h-11 touch-manipulation px-2 text-[var(--brand-strong)]"
                      onClick={jumpToday}
                    >
                      今天
                    </button>
                  </div>
                </div>

                {/* 滚动选时 */}
                <div>
                  <div className="mb-2 text-sm font-medium">具体几点</div>
                  <div className="flex gap-2">
                    {hourMode === "24" ? (
                      <ScrollColumn
                        label="时"
                        items={HOURS_24}
                        value={draft.hour}
                        onSelect={(h) =>
                          setDraft((prev) => ({ ...prev, hour: h }))
                        }
                      />
                    ) : (
                      <ScrollColumn
                        label="时"
                        items={HOURS_12}
                        value={clock12}
                        onSelect={(h) =>
                          setDraft((prev) => ({
                            ...prev,
                            hour: from12Hour(h, period),
                          }))
                        }
                      />
                    )}
                    <ScrollColumn
                      label="分"
                      items={MINUTES}
                      value={draft.minute}
                      onSelect={(m) =>
                        setDraft((prev) => ({ ...prev, minute: m }))
                      }
                    />
                    {hourMode === "12" ? (
                      <ScrollColumn
                        label="午别"
                        items={["am", "pm"] as const}
                        value={period}
                        format={(v) => (v === "am" ? "上午" : "下午")}
                        onSelect={(p) =>
                          setDraft((prev) => ({
                            ...prev,
                            hour: from12Hour(to12Hour(prev.hour).clock, p),
                          }))
                        }
                      />
                    ) : null}
                  </div>
                </div>

                {/* 手动输入：校验后点确认写入 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    手动输入
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      className="field min-h-12 flex-1 text-base"
                      value={manual}
                      onChange={(e) => {
                        setManual(e.target.value);
                        if (manualError) setManualError("");
                      }}
                      placeholder={manualPlaceholder(hourMode)}
                      inputMode="text"
                      autoComplete="off"
                      enterKeyHint="done"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyManual();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn min-h-12 shrink-0 touch-manipulation px-4"
                      onClick={applyManual}
                    >
                      应用手输
                    </button>
                  </div>
                  {manualError ? (
                    <p className="mt-1.5 text-sm text-[var(--fire)]">
                      {manualError}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-[var(--muted)]">
                      {hourMode === "24"
                        ? "24 小时制：23:55 或 2026-08-10 23:55"
                        : "12 小时制：11:59 上午 / 11:59 PM，可带日期"}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    预览：{formatWallDisplay(draft, hourMode)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 border-t border-[var(--line)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  className="btn min-h-12 flex-1 touch-manipulation"
                  onClick={closePicker}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="btn btn-primary min-h-12 flex-1 touch-manipulation"
                  onClick={confirm}
                >
                  确认
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef}>
      <button
        id={id}
        type="button"
        className="field flex min-h-12 w-full touch-manipulation items-center justify-between gap-2 text-left text-base"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-required={required || undefined}
      >
        <span className={value ? "" : "text-[var(--muted)]"}>{display}</span>
        <span
          className="shrink-0 text-[var(--muted)]"
          aria-hidden
          title="打开日历"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </span>
      </button>
      {/* 供表单 required 校验：隐藏墙钟值 */}
      <input
        type="text"
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        value={value}
        required={required}
        readOnly
        onChange={() => {}}
      />
      {panel}
    </div>
  );
}

function padMonth(m: number): string {
  return String(m).padStart(2, "0");
}

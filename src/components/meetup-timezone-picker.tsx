"use client";

/**
 * 约搭活动时区选择：默认北京时间，可快捷点纽约等，也可搜索城市带出 IANA 时区。
 * 开始/结束墙钟（自定义日期时间选择器）表示该时区本地时间，由服务端换算 UTC 存库。
 * 本地库优先（中英/别名）；不足时再走 /api/geo/city-tz 远程兜底。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MEETUP_TZ_CITIES,
  MEETUP_TZ_QUICK_PICKS,
  meetupTimeZoneLabel,
  normalizeMeetupTimeZone,
  searchMeetupTzCities,
  type MeetupTzCity,
} from "@/lib/meetup-timezone";

type RemoteHit = {
  id: string;
  labelZh: string;
  labelEn: string;
  timeZone: string;
  countryZh: string;
  source: "local" | "remote";
};

type Props = {
  value: string;
  onChange: (timeZone: string) => void;
};

function isQuickActive(
  city: MeetupTzCity,
  timeZone: string,
  quick: MeetupTzCity[],
): boolean {
  if (city.timeZone !== timeZone) return false;
  // 同一时区多个快捷项时只高亮列表中第一个（如上海区只亮「北京」）
  const first = quick.find((q) => q.timeZone === timeZone);
  return first?.id === city.id;
}

export function MeetupTimezonePicker({ value, onChange }: Props) {
  const tz = normalizeMeetupTimeZone(value);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<RemoteHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 本地库即时匹配；结果多时用可滚动下拉列表展示（触控友好 min-h-11）
  const localHits = useMemo(() => searchMeetupTzCities(query, 24), [query]);
  const quick = useMemo(
    () =>
      MEETUP_TZ_QUICK_PICKS.map(
        (id) => MEETUP_TZ_CITIES.find((c) => c.id === id)!,
      ).filter(Boolean),
    [],
  );

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setRemote([]);
      return;
    }
    // 本地已够用则不再打远程，省流量、微信内也更稳
    if (localHits.length >= 5) {
      setRemote([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void fetch(`/api/geo/city-tz?q=${encodeURIComponent(q)}`)
        .then(async (res) => {
          const data = (await res.json()) as { results?: RemoteHit[] };
          if (cancelled || !res.ok) return;
          setRemote(
            (data.results || []).filter((r) => r.source === "remote"),
          );
        })
        .catch(() => {
          if (!cancelled) setRemote([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open, localHits.length]);

  // 点外侧收起，避免挡表单其它字段（手机微信同理）
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function pick(next: string) {
    onChange(normalizeMeetupTimeZone(next));
    setOpen(false);
    setQuery("");
  }

  const mergedCount = localHits.length + remote.length;

  return (
    <div className="space-y-2" ref={rootRef}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-medium">活动时区</label>
        <span className="text-xs text-[var(--muted)]">
          当前：{meetupTimeZoneLabel(tz)}（{tz}）
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {quick.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => pick(c.timeZone)}
            className={`inline-flex min-h-11 items-center rounded-full px-3.5 py-2 text-sm touch-manipulation ${
              isQuickActive(c, tz, quick)
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--line)] bg-white/70"
            }`}
          >
            {c.labelZh}
          </button>
        ))}
      </div>

      <div className="relative">
        <input
          className="field min-h-11"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="搜索城市（中文/英文，如 奥马哈 / Omaha / Paris）"
          autoComplete="off"
          inputMode="search"
          enterKeyHint="search"
        />
        {open ? (
          <div
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto overscroll-contain rounded-2xl border border-[var(--line)] bg-[var(--bg)] shadow-lg [-webkit-overflow-scrolling:touch]"
            role="listbox"
            aria-label="城市时区候选"
          >
            {mergedCount === 0 && !searching ? (
              <p className="px-3 py-3 text-sm text-[var(--muted)]">
                {query.trim()
                  ? "无匹配城市，可换英文名或别名试试"
                  : "输入城市中文或英文名，从下拉列表选择"}
              </p>
            ) : null}
            {searching ? (
              <p className="px-3 py-2 text-xs text-[var(--muted)]">搜索中…</p>
            ) : null}
            <ul>
              {localHits.map((c) => (
                <li key={`l-${c.id}`}>
                  <button
                    type="button"
                    role="option"
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm touch-manipulation active:bg-[var(--brand-soft)] hover:bg-[var(--brand-soft)]"
                    onClick={() => pick(c.timeZone)}
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{c.labelZh}</span>
                      <span className="text-[var(--muted)]">
                        {" "}
                        · {c.labelEn}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-[var(--muted)]">
                      {c.countryZh} · {c.timeZone}
                    </span>
                  </button>
                </li>
              ))}
              {remote.map((c) => (
                <li key={`r-${c.id}`}>
                  <button
                    type="button"
                    role="option"
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm touch-manipulation active:bg-[var(--brand-soft)] hover:bg-[var(--brand-soft)]"
                    onClick={() => pick(c.timeZone)}
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{c.labelZh}</span>
                      {c.labelEn !== c.labelZh ? (
                        <span className="text-[var(--muted)]">
                          {" "}
                          · {c.labelEn}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--muted)]">
                      {c.countryZh} · {c.timeZone}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="sticky bottom-0 w-full border-t border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-center text-xs text-[var(--muted)] touch-manipulation"
              onClick={() => setOpen(false)}
            >
              收起
            </button>
          </div>
        ) : null}
      </div>

      <p className="text-xs text-[var(--muted)]">
        开始/结束时间按此时区填写；存库为 UTC。默认北京时间（东八区）。
      </p>
    </div>
  );
}

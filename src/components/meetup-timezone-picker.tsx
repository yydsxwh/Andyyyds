"use client";

/**
 * 约搭活动时区选择：默认北京时间，可快捷点纽约等，也可搜索城市带出 IANA 时区。
 * 开始/结束 datetime-local 表示该时区墙钟，由服务端换算 UTC 存库。
 */

import { useEffect, useState } from "react";
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

  const localHits = searchMeetupTzCities(query, 10);
  const quick = MEETUP_TZ_QUICK_PICKS.map(
    (id) => MEETUP_TZ_CITIES.find((c) => c.id === id)!,
  ).filter(Boolean);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setRemote([]);
      return;
    }
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

  function pick(next: string) {
    onChange(normalizeMeetupTimeZone(next));
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="space-y-2">
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
          placeholder="搜索城市（如 纽约 / Paris / 曼谷）"
          autoComplete="off"
        />
        {open ? (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--bg)] shadow-lg">
            {[...localHits, ...remote].length === 0 && !searching ? (
              <p className="px-3 py-3 text-sm text-[var(--muted)]">
                {query.trim()
                  ? "无匹配城市，可换英文名试试"
                  : "输入城市名搜索"}
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
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm touch-manipulation hover:bg-[var(--brand-soft)]"
                    onClick={() => pick(c.timeZone)}
                  >
                    <span>
                      {c.labelZh}
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
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm touch-manipulation hover:bg-[var(--brand-soft)]"
                    onClick={() => pick(c.timeZone)}
                  >
                    <span>
                      {c.labelZh}
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
              className="w-full border-t border-[var(--line)] px-3 py-2 text-center text-xs text-[var(--muted)]"
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

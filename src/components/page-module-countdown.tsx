"use client";

/**
 * 倒计时模块前台：客户端 tick，避免 SSR 与客户端时间偏差过大导致 hydration 抖动。
 */

import { useEffect, useState } from "react";

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

function remainingParts(targetMs: number, now: number) {
  const diff = Math.max(0, targetMs - now);
  const sec = Math.floor(diff / 1000);
  return {
    days: Math.floor(sec / 86400),
    hours: Math.floor((sec % 86400) / 3600),
    minutes: Math.floor((sec % 3600) / 60),
    seconds: sec % 60,
    done: diff <= 0,
  };
}

export function PageModuleCountdown({
  title,
  targetAt,
}: {
  title: string;
  targetAt: string;
}) {
  const targetMs = Date.parse(targetAt) || 0;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const parts = remainingParts(targetMs, now);

  return (
    <section className="px-3 py-3 text-center">
      {title ? <h3 className="mb-2 text-base font-semibold">{title}</h3> : null}
      {parts.done ? (
        <p className="text-sm text-[var(--muted)]">活动已结束</p>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          {[
            { label: "天", value: parts.days },
            { label: "时", value: parts.hours },
            { label: "分", value: parts.minutes },
            { label: "秒", value: parts.seconds },
          ].map((item) => (
            <div
              key={item.label}
              className="min-w-[3.25rem] rounded-xl bg-[var(--bg-deep)] px-2 py-2"
            >
              <div className="text-lg font-semibold tabular-nums">
                {pad(item.value)}
              </div>
              <div className="text-[10px] text-[var(--muted)]">{item.label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

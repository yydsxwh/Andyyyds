"use client";

import Link from "next/link";
import type { ForumNoticeConfig, ForumNoticeTheme } from "@/lib/forum";

type Props = {
  notice: ForumNoticeConfig;
  compact?: boolean;
};

const THEME_CLASS: Record<ForumNoticeTheme, string> = {
  brand:
    "from-[var(--brand)] via-[var(--brand)] to-[color-mix(in_srgb,var(--brand)_70%,#111)] text-white",
  amber: "from-amber-500 via-orange-500 to-rose-500 text-white",
  red: "from-red-600 via-rose-600 to-fuchsia-700 text-white",
  dark: "from-zinc-900 via-zinc-800 to-black text-white",
};

export function ForumNoticeBar({ notice, compact = false }: Props) {
  const hasText = Boolean(notice.title.trim() || notice.body.trim());
  const hasMedia = notice.media.length > 0;
  if (!hasText && !hasMedia) return null;

  const anim = notice.animation;
  const barAnim =
    anim === "pulse"
      ? "forum-notice-pulse"
      : anim === "float"
        ? "forum-notice-float"
        : anim === "shine"
          ? "forum-notice-shine"
          : "";

  return (
    <div
      className={`forum-notice-bar relative overflow-hidden rounded-[24px] bg-gradient-to-r shadow-[0_12px_40px_rgba(0,0,0,0.18)] ring-2 ring-white/40 ${THEME_CLASS[notice.theme]} ${barAnim}`}
    >
      {anim === "shine" ? (
        <span className="forum-notice-shine-glint" aria-hidden />
      ) : null}
      <div className="relative p-4 sm:p-5">
        {hasText ? (
          <div className={anim === "marquee" ? "forum-notice-marquee" : ""}>
            <div className={anim === "marquee" ? "forum-notice-marquee-track" : ""}>
              <NoticeCopy notice={notice} />
              {anim === "marquee" ? <NoticeCopy notice={notice} duplicate /> : null}
            </div>
          </div>
        ) : null}
        {hasMedia ? (
          <div
            className={`grid gap-2 ${hasText ? "mt-3" : ""} ${
              notice.media.length === 1
                ? "grid-cols-1"
                : notice.media.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-2 sm:grid-cols-3"
            }`}
          >
            {notice.media.map((item, index) =>
              item.kind === "video" ? (
                <video
                  key={`${item.url}-${index}`}
                  src={item.url}
                  className={`w-full rounded-2xl bg-black object-contain ${
                    compact ? "max-h-28" : "max-h-52 sm:max-h-64"
                  }`}
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${item.url}-${index}`}
                  src={item.url}
                  alt=""
                  className={`w-full rounded-2xl object-cover ${
                    compact ? "max-h-28" : "max-h-52 sm:max-h-64"
                  }`}
                />
              ),
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NoticeCopy({
  notice,
  duplicate = false,
}: {
  notice: ForumNoticeConfig;
  duplicate?: boolean;
}) {
  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
        公告
      </p>
      {notice.title.trim() ? (
        <p className="mt-1 text-lg font-semibold leading-snug sm:text-2xl">
          {notice.title}
        </p>
      ) : null}
      {notice.body.trim() ? (
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white/90 sm:text-base">
          {notice.body}
        </p>
      ) : null}
    </>
  );

  const className = duplicate ? "forum-notice-marquee-item" : "min-w-0";
  if (notice.href && !duplicate) {
    const external = notice.href.startsWith("http");
    if (external) {
      return (
        <a
          href={notice.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${className} block min-h-11`}
        >
          {body}
        </a>
      );
    }
    return (
      <Link href={notice.href} className={`${className} block min-h-11`}>
        {body}
      </Link>
    );
  }

  return (
    <div className={className} aria-hidden={duplicate || undefined}>
      {body}
    </div>
  );
}

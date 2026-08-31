"use client";

import { useEffect, useRef, useState } from "react";
import type { ForumMediaItem } from "@andyyyds/forum/lib/forum";

export function ForumMediaGallery({
  items,
  compact = false,
}: {
  items: ForumMediaItem[];
  compact?: boolean;
}) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (items.length === 0) return null;

  if (compact) {
    return <CompactForumMedia items={items} />;
  }

  return (
    <>
      {/* 详情页逐张完整展示，不用 cover 裁切；点图打开大图，微信内同样可点 */}
      <div className="mt-3 flex flex-col gap-3">
        {items.map((item, index) => (
          <div
            key={`${item.url}-${index}`}
            className="overflow-hidden rounded-2xl bg-[var(--line)]/30"
          >
            {item.kind === "video" ? (
              <video
                src={item.url}
                className="max-h-[min(80vh,40rem)] w-full bg-black object-contain"
                controls
                playsInline
                preload="metadata"
              />
            ) : (
              <button
                type="button"
                className="block min-h-11 w-full touch-manipulation p-0 text-left"
                onClick={() => setLightboxUrl(item.url)}
                aria-label="查看大图"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  className="block h-auto w-full object-contain"
                />
              </button>
            )}
          </div>
        ))}
      </div>
      {lightboxUrl ? (
        <ForumImageLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      ) : null}
    </>
  );
}

function CompactForumMedia({ items }: { items: ForumMediaItem[] }) {
  const shown = items.slice(0, 3);
  const extra = Math.max(0, items.length - shown.length);
  const cols =
    shown.length === 1
      ? "grid-cols-1"
      : shown.length === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <div className={`mt-3 grid gap-2 ${cols}`}>
      {shown.map((item, index) => (
        <div
          key={`${item.url}-${index}`}
          className="relative overflow-hidden rounded-2xl bg-[var(--line)]/30"
        >
          {item.kind === "video" ? (
            <div className="flex aspect-square items-center justify-center text-xs text-[var(--muted)]">
              视频
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.url}
              alt=""
              className="aspect-square w-full object-cover"
            />
          )}
          {extra > 0 && index === shown.length - 1 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm text-white">
              +{extra}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ForumImageLightbox({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/92"
      role="dialog"
      aria-modal="true"
      aria-label="查看图片"
    >
      <div className="flex shrink-0 justify-end px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          ref={closeBtnRef}
          type="button"
          className="min-h-11 min-w-11 rounded-full px-4 text-sm font-semibold text-white"
          onClick={onClose}
        >
          关闭
        </button>
      </div>
      <div
        className="flex min-h-0 flex-1 cursor-zoom-out items-center justify-center overflow-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onClick={onClose}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="max-h-full w-auto max-w-full object-contain"
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    </div>
  );
}

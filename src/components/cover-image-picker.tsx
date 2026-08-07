"use client";

/**
 * 封面预设图选择器：点选本地 stock 封面，写入 coverUrl。
 * 触控友好，手机微信内同样可用。
 */

import { COVER_IMAGES } from "@/lib/cover-images";

type Props = {
  value: string;
  onChange: (url: string) => void;
  /** 可选标题，默认「推荐封面」 */
  title?: string;
};

export function CoverImagePicker({
  value,
  onChange,
  title = "推荐封面",
}: Props) {
  return (
    <div className="mt-2">
      <div className="mb-2 text-xs text-[var(--muted)]">{title}</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {COVER_IMAGES.map((img) => {
          const selected = value === img.url;
          return (
            <button
              key={img.id}
              type="button"
              className={`overflow-hidden rounded-xl border text-left transition ${
                selected
                  ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/30"
                  : "border-[var(--line)]"
              }`}
              onClick={() => onChange(img.url)}
              aria-pressed={selected}
              aria-label={`选择封面：${img.label}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.label}
                className="aspect-[16/10] w-full object-cover"
              />
              <div className="truncate px-1.5 py-1 text-[11px] text-[var(--muted)]">
                {img.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

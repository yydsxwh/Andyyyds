"use client";

import { useState } from "react";

type Props = {
  images: string[];
  title: string;
};

/** 商城主图轮播：触控滑动友好，点击切换缩略图 */
export function ShopGallery({ images, title }: Props) {
  const list = images.length > 0 ? images : [];
  const [index, setIndex] = useState(0);
  if (list.length === 0) {
    return (
      <div className="aspect-square bg-[var(--bg-deep)]" aria-hidden />
    );
  }
  const current = list[Math.min(index, list.length - 1)]!;

  return (
    <div>
      <div className="relative aspect-square overflow-hidden bg-[var(--bg-deep)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current}
          alt={title}
          className="h-full w-full object-cover"
        />
        {list.length > 1 ? (
          <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white">
            {index + 1}/{list.length}
          </div>
        ) : null}
      </div>
      {list.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto px-3 py-2">
          {list.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${
                i === index ? "border-[var(--fire)]" : "border-transparent"
              }`}
              onClick={() => setIndex(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

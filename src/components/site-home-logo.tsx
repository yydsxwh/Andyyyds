"use client";

/**
 * 首页颗秒标：静帧或压缩动画；站长可拖，所有人可点按放大/缩小。
 */

import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import {
  HOME_LOGO_ALT,
  HOME_LOGO_ANIM_SRC,
  HOME_LOGO_STILL_FALLBACK_SRC,
  HOME_LOGO_STILL_SRC,
  normalizeHomeLogo,
  type HomeLogoConfig,
} from "@andyyyds/shared/home-logo";
import {
  HOME_FLOAT_ZOOM,
  useHomeFloatPlace,
} from "@/components/use-home-float-place";

type Props = {
  config?: HomeLogoConfig | null;
  canDrag?: boolean;
  className?: string;
  style?: CSSProperties;
  forceVisible?: boolean;
  fill?: boolean;
};

export function SiteHomeLogo({
  config,
  canDrag = false,
  className = "",
  style,
  forceVisible = false,
  fill = false,
}: Props) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const logo = normalizeHomeLogo(config);
  const visible = (forceVisible || isHome) && logo.visible;
  const allowViewportDrag = canDrag && !fill;
  const place = useHomeFloatPlace({
    canDrag: allowViewportDrag,
    xPercent: logo.xPercent,
    yPercent: logo.yPercent,
    persistField: "homeLogo",
  });

  if (!visible) return null;

  const placeStyle = place.customPlace
    ? { left: `${place.placed!.x}%`, top: `${place.placed!.y}%` }
    : { left: "0.75rem", top: "4.55rem" };
  const rootStyle = fill ? style : placeStyle;
  const scale = place.zoomed ? HOME_FLOAT_ZOOM : 1;
  const src = logo.useAnimation ? HOME_LOGO_ANIM_SRC : HOME_LOGO_STILL_SRC;

  return (
    <div
      ref={place.rootRef}
      className={
        fill
          ? `relative flex h-full min-h-11 w-full items-center justify-center ${className}`
          : `fixed z-[34] select-none ${place.dragging ? "cursor-grabbing" : ""} ${
              place.dragging || place.zoomed ? "z-[42]" : ""
            } ${className}`
      }
      style={rootStyle}
    >
      <button
        type="button"
        className={
          fill
            ? "flex h-full w-full items-center justify-center touch-manipulation"
            : `touch-manipulation ${
                allowViewportDrag ? "cursor-grab active:cursor-grabbing" : ""
              }`
        }
        aria-label={place.zoomed ? "缩小颗秒标" : "放大颗秒标"}
        title={
          allowViewportDrag
            ? "按住拖动摆位置 · 点击放大或缩小"
            : "点击放大或缩小"
        }
        onPointerDown={place.onPointerDown}
        onPointerMove={place.onPointerMove}
        onPointerUp={place.onPointerUp}
        onPointerCancel={place.onPointerUp}
        onClick={place.onActivate}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={HOME_LOGO_ALT}
          width={192}
          height={192}
          draggable={false}
          className={
            fill
              ? "h-full w-full max-h-full max-w-full object-contain transition-transform duration-200"
              : "h-[5.5rem] w-[5.5rem] object-contain transition-transform duration-200 sm:h-24 sm:w-24"
          }
          style={{
            transform: `scale(${scale})`,
            transformOrigin: fill ? "center" : "top left",
          }}
          onError={(event) => {
            const img = event.currentTarget;
            if (img.src.endsWith(HOME_LOGO_STILL_FALLBACK_SRC)) return;
            img.src = HOME_LOGO_STILL_FALLBACK_SRC;
          }}
        />
      </button>
      {allowViewportDrag ? (
        <p className="mt-1 hidden max-w-[9rem] text-center text-[10px] leading-4 text-[var(--muted)] sm:block">
          {place.saveHint || "按住拖动，点击放大"}
        </p>
      ) : null}
    </div>
  );
}

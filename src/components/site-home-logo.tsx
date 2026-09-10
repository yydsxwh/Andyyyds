"use client";

/**
 * 首页颗秒标：始终浮动在首页（不跟门户画布走）。
 * 站长可拖位置、拉右下角改大小，两者都写入装扮。
 */

import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import {
  HOME_LOGO_ALT,
  HOME_LOGO_ANIM_SRC,
  HOME_LOGO_STILL_FALLBACK_SRC,
  HOME_LOGO_STILL_SRC,
  homeLogoScalePercent,
  homeLogoSizePx,
  normalizeHomeLogo,
  type HomeLogoConfig,
} from "@andyyyds/shared/home-logo";
import {
  HomeFloatResizeHandle,
  HomeFloatZoomControls,
} from "@/components/home-float-zoom-controls";
import { useHomeFloatPlace } from "@/components/use-home-float-place";

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
    initialScale: logo.scale,
    persistScale: allowViewportDrag,
    persistField: "homeLogo",
    buildHidePatch: allowViewportDrag
      ? () => ({ homeLogo: { visible: false } })
      : () => null,
  });

  if (!visible || place.hidden) return null;

  const placeStyle = place.customPlace
    ? { left: `${place.placed!.x}%`, top: `${place.placed!.y}%` }
    : { left: "0.75rem", top: "4.55rem" };
  const rootStyle = fill ? style : placeStyle;
  const src = logo.useAnimation ? HOME_LOGO_ANIM_SRC : HOME_LOGO_STILL_SRC;
  const sizePx = homeLogoSizePx(place.scale);
  const scaleLabel = `${homeLogoScalePercent(place.scale)}%`;

  return (
    <div
      ref={place.rootRef}
      className={
        fill
          ? `relative flex h-full min-h-11 w-full flex-col items-center justify-center ${className}`
          : `fixed z-[34] flex select-none flex-col items-start ${
              place.dragging || place.resizing ? "cursor-grabbing" : ""
            } ${
              place.dragging || place.resizing || place.controlsOpen || place.scaled
                ? "z-[42]"
                : ""
            } ${className}`
      }
      style={rootStyle}
    >
      <div className={fill ? "relative h-full w-full" : "relative"}>
        <button
          type="button"
          className={
            fill
              ? "flex h-full w-full items-center justify-center touch-manipulation"
              : `touch-none ${
                  allowViewportDrag ? "cursor-grab active:cursor-grabbing" : ""
                }`
          }
          aria-label={
            place.controlsOpen ? "收起颗秒标大小按钮" : "显示颗秒标大小按钮"
          }
          title={
            allowViewportDrag
              ? "按住拖动摆位置 · 拉右下角改大小"
              : "点击后用＋－逐步放大或缩小，也可隐藏"
          }
          onPointerDown={place.onPointerDown}
          onClick={place.onActivate}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={HOME_LOGO_ALT}
            width={sizePx}
            height={sizePx}
            draggable={false}
            className={
              fill
                ? "h-full w-full max-h-full max-w-full object-contain"
                : "object-contain"
            }
            style={fill ? undefined : { width: sizePx, height: sizePx }}
            onError={(event) => {
              const img = event.currentTarget;
              if (img.src.endsWith(HOME_LOGO_STILL_FALLBACK_SRC)) return;
              img.src = HOME_LOGO_STILL_FALLBACK_SRC;
            }}
          />
        </button>
        {allowViewportDrag ? (
          <HomeFloatResizeHandle
            label="拖动调整颗秒标大小"
            onPointerDown={place.onResizePointerDown}
          />
        ) : null}
      </div>
      {place.controlsOpen ? (
        <HomeFloatZoomControls
          align={fill ? "center" : "start"}
          canZoomIn={place.canZoomIn}
          canZoomOut={place.canZoomOut}
          onZoomIn={place.zoomIn}
          onZoomOut={place.zoomOut}
          onHide={place.onHide}
          hideLabel="隐藏"
          scaleLabel={scaleLabel}
        />
      ) : null}
      {allowViewportDrag ? (
        <p className="mt-1 hidden max-w-[10rem] text-center text-[10px] leading-4 text-[var(--muted)] sm:block">
          {place.saveHint || `按住拖动 · 拉角改大小（${scaleLabel}）`}
        </p>
      ) : null}
    </div>
  );
}

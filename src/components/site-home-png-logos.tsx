"use client";

/**
 * 首页额外 PNG 挂件：和颗秒动画同时存在，可拖、可拉角改大小。
 */

import { usePathname } from "next/navigation";
import {
  homeLogoScalePercent,
  homeLogoSizePx,
  normalizeHomeLogo,
  type HomeLogoConfig,
  type HomePngLogo,
} from "@andyyyds/shared/home-logo";
import {
  HomeFloatResizeHandle,
  HomeFloatZoomControls,
} from "@/components/home-float-zoom-controls";
import { useHomeFloatPlace } from "@/components/use-home-float-place";

type Props = {
  config?: HomeLogoConfig | null;
  canDrag?: boolean;
};

export function SiteHomePngLogos({ config, canDrag = false }: Props) {
  const pathname = usePathname();
  const logo = normalizeHomeLogo(config);
  if (pathname !== "/") return null;

  return (
    <>
      {logo.pngLogos.map((item, index) =>
        item.visible ? (
          <SiteHomePngMark
            key={item.id}
            item={item}
            index={index}
            all={logo}
            canDrag={canDrag}
          />
        ) : null,
      )}
    </>
  );
}

function SiteHomePngMark({
  item,
  index,
  all,
  canDrag,
}: {
  item: HomePngLogo;
  index: number;
  all: HomeLogoConfig;
  canDrag: boolean;
}) {
  const place = useHomeFloatPlace({
    canDrag,
    xPercent: item.xPercent,
    yPercent: item.yPercent,
    initialScale: item.scale,
    persistScale: canDrag,
    persistField: "homeLogo",
    buildPlacePatch: (x, y) => ({
      homeLogo: {
        pngLogos: all.pngLogos.map((png) =>
          png.id === item.id ? { ...png, xPercent: x, yPercent: y } : png,
        ),
      },
    }),
    buildScalePatch: (scale) => ({
      homeLogo: {
        pngLogos: all.pngLogos.map((png) =>
          png.id === item.id ? { ...png, scale } : png,
        ),
      },
    }),
    buildHidePatch: canDrag
      ? () => ({
          homeLogo: {
            pngLogos: all.pngLogos.map((png) =>
              png.id === item.id ? { ...png, visible: false } : png,
            ),
          },
        })
      : () => null,
  });

  if (place.hidden) return null;

  const placeStyle = place.customPlace
    ? { left: `${place.placed!.x}%`, top: `${place.placed!.y}%` }
    : { left: "0.75rem", top: `${4.55 + (index + 1) * 6.75}rem` };
  const sizePx = homeLogoSizePx(place.scale);
  const scaleLabel = `${homeLogoScalePercent(place.scale)}%`;

  return (
    <div
      ref={place.rootRef}
      className={`fixed z-[33] flex select-none flex-col items-start ${
        place.dragging || place.resizing ? "cursor-grabbing" : ""
      } ${
        place.dragging || place.resizing || place.controlsOpen || place.scaled
          ? "z-[42]"
          : ""
      }`}
      style={placeStyle}
    >
      <div className="relative">
        <button
          type="button"
          className={`touch-none ${
            canDrag ? "cursor-grab active:cursor-grabbing" : ""
          }`}
          aria-label={place.controlsOpen ? "收起 PNG 标大小按钮" : "显示 PNG 标大小按钮"}
          title={
            canDrag
              ? "按住拖动摆位置 · 拉右下角改大小"
              : "点击后用＋－逐步放大或缩小，也可隐藏"
          }
          onPointerDown={place.onPointerDown}
          onClick={place.onActivate}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt="首页 Logo"
            width={sizePx}
            height={sizePx}
            draggable={false}
            className="object-contain"
            style={{ width: sizePx, height: sizePx }}
          />
        </button>
        {canDrag ? (
          <HomeFloatResizeHandle
            label="拖动调整 PNG 标大小"
            onPointerDown={place.onResizePointerDown}
          />
        ) : null}
      </div>
      {place.controlsOpen ? (
        <HomeFloatZoomControls
          align="start"
          canZoomIn={place.canZoomIn}
          canZoomOut={place.canZoomOut}
          onZoomIn={place.zoomIn}
          onZoomOut={place.zoomOut}
          onHide={place.onHide}
          hideLabel="隐藏"
          scaleLabel={scaleLabel}
        />
      ) : null}
      {canDrag ? (
        <p className="mt-1 hidden max-w-[10rem] text-center text-[10px] leading-4 text-[var(--muted)] sm:block">
          {place.saveHint || `按住拖动 · 拉角改大小（${scaleLabel}）`}
        </p>
      ) : null}
    </div>
  );
}

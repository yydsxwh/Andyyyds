"use client";

/**
 * 首页额外 PNG 挂件：和颗秒动画同时存在，可拖、可＋－、可隐藏。
 */

import { usePathname } from "next/navigation";
import {
  normalizeHomeLogo,
  type HomeLogoConfig,
  type HomePngLogo,
} from "@andyyyds/decorate/lib/home-logo";
import { HomeFloatZoomControls } from "@andyyyds/decorate/components/home-float-zoom-controls";
import { useHomeFloatPlace } from "@andyyyds/decorate/components/use-home-float-place";

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
    persistField: "homeLogo",
    buildPlacePatch: (x, y) => ({
      homeLogo: {
        pngLogos: all.pngLogos.map((png) =>
          png.id === item.id ? { ...png, xPercent: x, yPercent: y } : png,
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

  return (
    <div
      ref={place.rootRef}
      className={`fixed z-[33] flex select-none flex-col items-start ${
        place.dragging ? "cursor-grabbing" : ""
      } ${place.dragging || place.controlsOpen || place.scaled ? "z-[42]" : ""}`}
      style={placeStyle}
    >
      <button
        type="button"
        className={`touch-manipulation ${
          canDrag ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        aria-label={place.controlsOpen ? "收起 PNG 标缩放按钮" : "显示 PNG 标缩放按钮"}
        title={
          canDrag
            ? "按住拖动摆位置 · 点击后用＋－缩放或隐藏"
            : "点击后用＋－逐步放大或缩小，也可隐藏"
        }
        onPointerDown={place.onPointerDown}
        onPointerMove={place.onPointerMove}
        onPointerUp={place.onPointerUp}
        onPointerCancel={place.onPointerUp}
        onClick={place.onActivate}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt="首页 Logo"
          width={192}
          height={192}
          draggable={false}
          className="h-[5.5rem] w-[5.5rem] object-contain transition-transform duration-200 sm:h-24 sm:w-24"
          style={{
            transform: `scale(${place.scale})`,
            transformOrigin: "top left",
          }}
        />
      </button>
      {place.controlsOpen ? (
        <HomeFloatZoomControls
          align="start"
          canZoomIn={place.canZoomIn}
          canZoomOut={place.canZoomOut}
          onZoomIn={place.zoomIn}
          onZoomOut={place.zoomOut}
          onHide={place.onHide}
          hideLabel="隐藏"
        />
      ) : null}
      {canDrag ? (
        <p className="mt-1 hidden max-w-[9rem] text-center text-[10px] leading-4 text-[var(--muted)] sm:block">
          {place.saveHint || "按住拖动，点击后用＋－或隐藏"}
        </p>
      ) : null}
    </div>
  );
}

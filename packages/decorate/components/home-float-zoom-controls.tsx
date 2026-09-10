"use client";

/**
 * 首页浮动件点开后的＋－和隐藏。缩放只改本机；隐藏由调用方决定是否写库。
 */

type Props = {
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onHide: () => void;
  hideLabel?: string;
  align?: "start" | "end" | "center";
};

const iconBtnClass =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white/95 text-xl font-semibold leading-none text-[var(--ink)] shadow-sm backdrop-blur-md touch-manipulation disabled:opacity-35";

const hideBtnClass =
  "flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white/95 px-3 text-sm font-medium text-[var(--ink)] shadow-sm backdrop-blur-md touch-manipulation";

export function HomeFloatZoomControls({
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onHide,
  hideLabel = "隐藏",
  align = "start",
}: Props) {
  const justify =
    align === "end"
      ? "justify-end"
      : align === "center"
        ? "justify-center"
        : "justify-start";

  return (
    <div
      className={`mt-1 flex flex-wrap gap-1.5 ${justify}`}
      role="group"
      aria-label="缩放或隐藏挂件"
    >
      <button
        type="button"
        className={iconBtnClass}
        aria-label="缩小"
        title="缩小"
        disabled={!canZoomOut}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onZoomOut();
        }}
      >
        −
      </button>
      <button
        type="button"
        className={iconBtnClass}
        aria-label="放大"
        title="放大"
        disabled={!canZoomIn}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onZoomIn();
        }}
      >
        +
      </button>
      <button
        type="button"
        className={hideBtnClass}
        aria-label={hideLabel}
        title={hideLabel}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onHide();
        }}
      >
        {hideLabel}
      </button>
    </div>
  );
}

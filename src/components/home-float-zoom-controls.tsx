"use client";

/**
 * 首页浮动件点开后的＋－：本机逐步缩放，不写装扮，避免一个人改大小全站跟着变。
 */

type Props = {
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  align?: "start" | "end" | "center";
};

const btnClass =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white/95 text-xl font-semibold leading-none text-[var(--ink)] shadow-sm backdrop-blur-md touch-manipulation disabled:opacity-35";

export function HomeFloatZoomControls({
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
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
      className={`mt-1 flex gap-1.5 ${justify}`}
      role="group"
      aria-label="逐步放大或缩小"
    >
      <button
        type="button"
        className={btnClass}
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
        className={btnClass}
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
    </div>
  );
}

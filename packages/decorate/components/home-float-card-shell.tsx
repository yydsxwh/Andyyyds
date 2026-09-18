"use client";

/**
 * 首页内容卡片自由摆放外壳：与时钟挂件同款交互。
 * 站长（canDrag）：按住卡片空白处拖动改位置（写库，所有人可见）；
 * 点击空白处弹＋－逐步调大小（也写库，访客看到同一尺寸）；可一键还原。
 * 访客：只读展示站长保存的位置与大小；卡片里的输入框/按钮/链接照常可点。
 * 未摆放时卡片留在原文档流，站长可从原位置直接拖出。
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { HomeFloatZoomControls } from "@andyyyds/decorate/components/home-float-zoom-controls";
import {
  HOME_FLOAT_CARD_SCALE_MAX,
  HOME_FLOAT_CARD_SCALE_MIN,
  HOME_FLOAT_CARD_SCALE_STEP,
  homeFloatCardWidthPx,
  type HomeFloatCardId,
  type HomeFloatCardPlacement,
} from "@andyyyds/decorate/lib/home-float-cards";

const DRAG_THRESHOLD_PX = 8;
const EDGE_PAD_PX = 8;
const VIEWPORT_PAD_PX = EDGE_PAD_PX * 2;

/** 交互元素上不抢事件：输入框、按钮、链接等保持原生行为 */
function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, button, a, label, [contenteditable], [role='button']",
    ),
  );
}

function clampPlace(
  leftPx: number,
  topPx: number,
  widthPx: number,
  heightPx: number,
) {
  const pad = EDGE_PAD_PX;
  const maxLeft = Math.max(pad, window.innerWidth - widthPx - pad);
  const maxTop = Math.max(pad, window.innerHeight - heightPx - pad);
  return {
    left: Math.min(maxLeft, Math.max(pad, leftPx)),
    top: Math.min(maxTop, Math.max(pad, topPx)),
  };
}

function clampScale(value: number) {
  const stepped =
    Math.round(value / HOME_FLOAT_CARD_SCALE_STEP) * HOME_FLOAT_CARD_SCALE_STEP;
  return (
    Math.min(
      HOME_FLOAT_CARD_SCALE_MAX,
      Math.max(HOME_FLOAT_CARD_SCALE_MIN, Math.round(stepped * 10) / 10),
    ) || 1
  );
}

type Props = {
  cardId: HomeFloatCardId;
  placement?: HomeFloatCardPlacement | null;
  canDrag: boolean;
  /** 未摆放（文档流内）时外壳的布局类名，保持原栅格位置与宽度 */
  flowClassName?: string;
  children: ReactNode;
};

export function HomeFloatCardShell({
  cardId,
  placement,
  canDrag,
  flowClassName = "",
  children,
}: Props) {
  const storedPlaced =
    placement?.xPercent != null && placement?.yPercent != null;
  const [override, setOverride] = useState<{ x: number; y: number } | null>(() =>
    storedPlaced
      ? { x: placement!.xPercent as number, y: placement!.yPercent as number }
      : null,
  );
  const [scale, setScale] = useState(() => clampScale(placement?.scale ?? 1));
  const [dragging, setDragging] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [saveHint, setSaveHint] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const skipClickRef = useRef(false);
  const scaleRef = useRef(scale);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeftPx: number;
    origTopPx: number;
    moved: boolean;
    lastX: number;
    lastY: number;
  } | null>(null);

  // 服务端 placement 变化（保存后刷新等）同步回本地
  useEffect(() => {
    if (storedPlaced) {
      setOverride({
        x: placement!.xPercent as number,
        y: placement!.yPercent as number,
      });
      const nextScale = clampScale(placement?.scale ?? 1);
      scaleRef.current = nextScale;
      setScale(nextScale);
    } else {
      setOverride(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement?.xPercent, placement?.yPercent, placement?.scale]);

  useEffect(() => {
    if (!controlsOpen) return;
    function onDocPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setControlsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [controlsOpen]);

  async function persistPatch(
    body: Record<string, unknown>,
    busy: string,
    ok: string,
  ) {
    setSaveHint(busy);
    try {
      const res = await fetch("/api/studio/decorate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "保存失败");
      }
      setSaveHint(ok);
    } catch (error) {
      setSaveHint(error instanceof Error ? error.message : "保存失败");
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!canDrag || event.button !== 0) return;
    if (isInteractiveTarget(event.target)) return;
    const box = rootRef.current?.getBoundingClientRect();
    if (!box) return;
    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origLeftPx: box.left,
      origTopPx: box.top,
      moved: false,
      lastX: 0,
      lastY: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    if (!drag.moved) {
      // 起拖：从文档流/原位拿起，把当前像素位置换算成视口百分比
      drag.moved = true;
      setDragging(true);
    }
    const box = rootRef.current?.getBoundingClientRect();
    const widthPx = box?.width || 320;
    const heightPx = box?.height || 160;
    const next = clampPlace(
      drag.origLeftPx + dx,
      drag.origTopPx + dy,
      widthPx,
      heightPx,
    );
    const nextX = Math.round((next.left / window.innerWidth) * 1000) / 10;
    const nextY = Math.round((next.top / window.innerHeight) * 1000) / 10;
    drag.lastX = nextX;
    drag.lastY = nextY;
    setOverride({ x: nextX, y: nextY });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    if (drag.moved) {
      skipClickRef.current = true;
      void persistPatch(
        {
          homeFloatCards: {
            [cardId]: { xPercent: drag.lastX, yPercent: drag.lastY },
          },
        },
        "正在保存位置…",
        "位置已保存，所有人看到同一摆放",
      );
    }
  }

  function onActivate(event: React.MouseEvent<HTMLDivElement>) {
    if (!canDrag) return;
    if (isInteractiveTarget(event.target)) return;
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    setControlsOpen((prev) => !prev);
  }

  async function applyScale(
    nextScale: number,
    place?: { xPercent: number; yPercent: number },
  ) {
    const clamped = clampScale(nextScale);
    scaleRef.current = clamped;
    setScale(clamped);
    await persistPatch(
      {
        homeFloatCards: {
          [cardId]: { scale: clamped, ...(place || {}) },
        },
      },
      "正在保存大小…",
      "大小已保存，所有人看到同一尺寸",
    );
  }

  function zoomIn() {
    if (!override) {
      // 未摆放时调大小：先以当前屏幕位置就地拿起，再缩放
      const box = rootRef.current?.getBoundingClientRect();
      if (!box) return;
      const x = Math.round((box.left / window.innerWidth) * 1000) / 10;
      const y = Math.round((box.top / window.innerHeight) * 1000) / 10;
      setOverride({ x, y });
      void applyScale(scaleRef.current + HOME_FLOAT_CARD_SCALE_STEP, {
        xPercent: x,
        yPercent: y,
      });
      return;
    }
    void applyScale(scaleRef.current + HOME_FLOAT_CARD_SCALE_STEP);
  }

  function zoomOut() {
    if (!override) {
      const box = rootRef.current?.getBoundingClientRect();
      if (!box) return;
      const x = Math.round((box.left / window.innerWidth) * 1000) / 10;
      const y = Math.round((box.top / window.innerHeight) * 1000) / 10;
      setOverride({ x, y });
      void applyScale(scaleRef.current - HOME_FLOAT_CARD_SCALE_STEP, {
        xPercent: x,
        yPercent: y,
      });
      return;
    }
    void applyScale(scaleRef.current - HOME_FLOAT_CARD_SCALE_STEP);
  }

  function onReset() {
    setOverride(null);
    scaleRef.current = 1;
    setScale(1);
    setControlsOpen(false);
    void persistPatch(
      { homeFloatCards: { [cardId]: { xPercent: null, yPercent: null, scale: 1 } } },
      "正在还原…",
      "已还原到原始版式位置",
    );
  }

  const floating = override != null;
  const widthPx = homeFloatCardWidthPx(cardId, scale);

  return (
    <div
      ref={rootRef}
      className={
        floating
          ? `fixed z-[30] ${dragging ? "cursor-grabbing select-none" : ""} ${
              dragging || controlsOpen ? "z-[42]" : ""
            }`
          : `relative ${flowClassName} ${canDrag ? "cursor-grab select-none" : ""}`
      }
      style={
        floating
          ? {
              left: `${override.x}%`,
              top: `${override.y}%`,
              width: `min(${widthPx}px, calc(100vw - ${VIEWPORT_PAD_PX}px))`,
              touchAction: "none",
            }
          : undefined
      }
      onPointerDown={canDrag ? onPointerDown : undefined}
      onPointerMove={canDrag ? onPointerMove : undefined}
      onPointerUp={canDrag ? onPointerUp : undefined}
      onPointerCancel={canDrag ? onPointerUp : undefined}
      onClick={canDrag ? onActivate : undefined}
    >
      {children}

      {canDrag && controlsOpen ? (
        <HomeFloatZoomControls
          align="end"
          canZoomIn={scale < HOME_FLOAT_CARD_SCALE_MAX}
          canZoomOut={scale > HOME_FLOAT_CARD_SCALE_MIN}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onHide={onReset}
          hideLabel="还原位置"
        />
      ) : null}

      {canDrag ? (
        <p className="mt-1 hidden text-[10px] leading-4 text-[var(--muted)] sm:block">
          {saveHint ||
            (floating
              ? "按住卡片空白处拖动 · 点击空白处用＋－调大小"
              : "按住卡片拖到任意位置；点击空白处可调大小")}
        </p>
      ) : null}
    </div>
  );
}

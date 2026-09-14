"use client";

/**
 * 首页浮动件（时钟 / 颗秒标 / PNG 标）共用：
 * 站长拖位置写入装扮；点击弹出＋－逐步缩放，并可用「隐藏」收起。
 * 缩放只存在本机；隐藏：访客只藏本机，站长再写库以免刷新又出来。
 */

import { useEffect, useRef, useState } from "react";

export const HOME_FLOAT_SCALE_MIN = 0.6;
export const HOME_FLOAT_SCALE_MAX = 2.8;
export const HOME_FLOAT_SCALE_STEP = 0.2;
export const HOME_FLOAT_SCALE_DEFAULT = 1;
export const HOME_FLOAT_DRAG_THRESHOLD_PX = 8;
export const HOME_FLOAT_EDGE_PAD_PX = 8;

function clampBox(left: number, top: number, width: number, height: number) {
  const pad = HOME_FLOAT_EDGE_PAD_PX;
  const maxLeft = Math.max(pad, window.innerWidth - width - pad);
  const maxTop = Math.max(pad, window.innerHeight - height - pad);
  return {
    left: Math.min(maxLeft, Math.max(pad, left)),
    top: Math.min(maxTop, Math.max(pad, top)),
  };
}

function clampScale(value: number) {
  const stepped = Math.round(value / HOME_FLOAT_SCALE_STEP) * HOME_FLOAT_SCALE_STEP;
  return Math.min(
    HOME_FLOAT_SCALE_MAX,
    Math.max(HOME_FLOAT_SCALE_MIN, Math.round(stepped * 10) / 10),
  );
}

type PersistField = "homeClock" | "homeLogo";

type Args = {
  canDrag: boolean;
  xPercent: number | null;
  yPercent: number | null;
  persistField: PersistField;
  /** 拖位置时覆盖默认 PATCH 体，给 PNG 挂件改某一条 */
  buildPlacePatch?: (x: number, y: number) => Record<string, unknown>;
  /** 站长点隐藏时写库；不传则只藏本机 */
  buildHidePatch?: () => Record<string, unknown> | null;
};

export function useHomeFloatPlace({
  canDrag,
  xPercent,
  yPercent,
  persistField,
  buildPlacePatch,
  buildHidePatch,
}: Args) {
  const [placed, setPlaced] = useState<{ x: number; y: number } | null>(() =>
    xPercent == null || yPercent == null ? null : { x: xPercent, y: yPercent },
  );
  const [dragging, setDragging] = useState(false);
  const [scale, setScale] = useState(HOME_FLOAT_SCALE_DEFAULT);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [saveHint, setSaveHint] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const skipClickRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
    moved: boolean;
    lastX: number;
    lastY: number;
  } | null>(null);

  useEffect(() => {
    if (xPercent == null || yPercent == null) {
      setPlaced(null);
      return;
    }
    setPlaced({ x: xPercent, y: yPercent });
  }, [xPercent, yPercent]);

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

  async function persistPatch(body: Record<string, unknown>, busy: string, ok: string) {
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

  function onPointerDown(event: React.PointerEvent<HTMLElement>) {
    if (!canDrag || event.button !== 0) return;
    const box = rootRef.current?.getBoundingClientRect();
    if (!box) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origLeft: box.left,
      origTop: box.top,
      moved: false,
      lastX: placed?.x ?? 0,
      lastY: placed?.y ?? 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < HOME_FLOAT_DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    setDragging(true);
    const box = rootRef.current?.getBoundingClientRect();
    const width = box?.width || 120;
    const height = box?.height || 120;
    const next = clampBox(drag.origLeft + dx, drag.origTop + dy, width, height);
    const nextX = Math.round((next.left / window.innerWidth) * 1000) / 10;
    const nextY = Math.round((next.top / window.innerHeight) * 1000) / 10;
    drag.lastX = nextX;
    drag.lastY = nextY;
    setPlaced({ x: nextX, y: nextY });
  }

  function onPointerUp(event: React.PointerEvent<HTMLElement>) {
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
      const body = buildPlacePatch
        ? buildPlacePatch(drag.lastX, drag.lastY)
        : { [persistField]: { xPercent: drag.lastX, yPercent: drag.lastY } };
      void persistPatch(body, "正在保存位置…", "位置已保存，访客会看到这里");
    }
  }

  function onActivate() {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    setControlsOpen((prev) => !prev);
  }

  function zoomIn() {
    setScale((prev) => clampScale(prev + HOME_FLOAT_SCALE_STEP));
  }

  function zoomOut() {
    setScale((prev) => clampScale(prev - HOME_FLOAT_SCALE_STEP));
  }

  function onHide() {
    setHidden(true);
    setControlsOpen(false);
    if (!canDrag) return;
    const body = buildHidePatch ? buildHidePatch() : { [persistField]: { visible: false } };
    if (!body) return;
    void persistPatch(body, "正在隐藏…", "已隐藏，装扮里可再打开");
  }

  const customPlace = placed != null;
  const scaled = scale !== HOME_FLOAT_SCALE_DEFAULT;
  return {
    rootRef,
    placed,
    dragging,
    scale,
    scaled,
    controlsOpen,
    hidden,
    canZoomIn: scale < HOME_FLOAT_SCALE_MAX,
    canZoomOut: scale > HOME_FLOAT_SCALE_MIN,
    saveHint,
    customPlace,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onActivate,
    zoomIn,
    zoomOut,
    onHide,
  };
}

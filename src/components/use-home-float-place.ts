"use client";

/**
 * 首页浮动件（时钟 / 颗秒标）共用：站长拖位置写入装扮；点击只在本机放大缩小。
 */

import { useEffect, useRef, useState } from "react";

export const HOME_FLOAT_ZOOM = 1.88;
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

type PersistField = "homeClock" | "homeLogo";

type Args = {
  canDrag: boolean;
  xPercent: number | null;
  yPercent: number | null;
  persistField: PersistField;
};

export function useHomeFloatPlace({
  canDrag,
  xPercent,
  yPercent,
  persistField,
}: Args) {
  const [placed, setPlaced] = useState<{ x: number; y: number } | null>(() =>
    xPercent == null || yPercent == null ? null : { x: xPercent, y: yPercent },
  );
  const [dragging, setDragging] = useState(false);
  const [zoomed, setZoomed] = useState(false);
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

  async function persistPlace(nextX: number, nextY: number) {
    setSaveHint("正在保存位置…");
    try {
      const res = await fetch("/api/studio/decorate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [persistField]: { xPercent: nextX, yPercent: nextY },
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "保存失败");
      }
      setSaveHint("位置已保存，访客会看到这里");
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
      void persistPlace(drag.lastX, drag.lastY);
    }
  }

  function onActivate() {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    setZoomed((prev) => !prev);
  }

  const customPlace = placed != null;
  return {
    rootRef,
    placed,
    dragging,
    zoomed,
    saveHint,
    customPlace,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onActivate,
  };
}

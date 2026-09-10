"use client";

/**
 * 首页浮动件（时钟 / 颗秒标 / PNG 标）共用：
 * 站长拖位置、拉角改大小写入装扮；访客缩放只改本机。
 * 隐藏：访客只藏本机，站长再写库以免刷新又出来。
 * 指针跟在 window 上走，避免 setState 重绘把 element capture 丢掉。
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  clampHomeLogoScale,
  HOME_LOGO_BASE_SIZE_PX,
  HOME_LOGO_SCALE_DEFAULT,
  HOME_LOGO_SCALE_MAX,
  HOME_LOGO_SCALE_MIN,
  HOME_LOGO_SCALE_STEP,
} from "@andyyyds/shared/home-logo";

export const HOME_FLOAT_SCALE_MIN = HOME_LOGO_SCALE_MIN;
export const HOME_FLOAT_SCALE_MAX = HOME_LOGO_SCALE_MAX;
export const HOME_FLOAT_SCALE_STEP = HOME_LOGO_SCALE_STEP;
export const HOME_FLOAT_SCALE_DEFAULT = HOME_LOGO_SCALE_DEFAULT;
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

type Gesture = {
  mode: "move" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  origLeft: number;
  origTop: number;
  startScale: number;
  moved: boolean;
  lastX: number;
  lastY: number;
  lastScale: number;
};

type Args = {
  canDrag: boolean;
  xPercent: number | null;
  yPercent: number | null;
  persistField: PersistField;
  initialScale?: number;
  /** true 时站长改大小写库；时钟仍只改本机 */
  persistScale?: boolean;
  /** 拖位置时覆盖默认 PATCH 体，给 PNG 挂件改某一条 */
  buildPlacePatch?: (x: number, y: number) => Record<string, unknown>;
  buildScalePatch?: (scale: number) => Record<string, unknown>;
  /** 站长点隐藏时写库；不传则只藏本机 */
  buildHidePatch?: () => Record<string, unknown> | null;
};

export function useHomeFloatPlace({
  canDrag,
  xPercent,
  yPercent,
  persistField,
  initialScale,
  persistScale = false,
  buildPlacePatch,
  buildScalePatch,
  buildHidePatch,
}: Args) {
  const [placed, setPlaced] = useState<{ x: number; y: number } | null>(() =>
    xPercent == null || yPercent == null ? null : { x: xPercent, y: yPercent },
  );
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [scale, setScale] = useState(() =>
    clampHomeLogoScale(initialScale ?? HOME_LOGO_SCALE_DEFAULT),
  );
  const [controlsOpen, setControlsOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [saveHint, setSaveHint] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const skipClickRef = useRef(false);
  const gestureRef = useRef<Gesture | null>(null);
  const placedRef = useRef(placed);
  const scaleRef = useRef(scale);
  const optsRef = useRef({
    canDrag,
    persistField,
    persistScale,
    buildPlacePatch,
    buildScalePatch,
    buildHidePatch,
  });

  placedRef.current = placed;
  scaleRef.current = scale;
  optsRef.current = {
    canDrag,
    persistField,
    persistScale,
    buildPlacePatch,
    buildScalePatch,
    buildHidePatch,
  };

  useEffect(() => {
    if (xPercent == null || yPercent == null) {
      setPlaced(null);
      return;
    }
    setPlaced({ x: xPercent, y: yPercent });
  }, [xPercent, yPercent]);

  useEffect(() => {
    if (initialScale == null) return;
    setScale(clampHomeLogoScale(initialScale));
  }, [initialScale]);

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

  function persistScaleNow(nextScale: number) {
    const opts = optsRef.current;
    if (!opts.canDrag || !opts.persistScale) return;
    const body = opts.buildScalePatch
      ? opts.buildScalePatch(nextScale)
      : { [opts.persistField]: { scale: nextScale } };
    void persistPatch(body, "正在保存大小…", "大小已保存，访客会看到这个尺寸");
  }

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      if (!gesture.moved && Math.hypot(dx, dy) < HOME_FLOAT_DRAG_THRESHOLD_PX) {
        return;
      }
      gesture.moved = true;
      if (gesture.mode === "resize") {
        setResizing(true);
        const nextScale = clampHomeLogoScale(
          gesture.startScale + (dx + dy) / 2 / HOME_LOGO_BASE_SIZE_PX,
        );
        gesture.lastScale = nextScale;
        setScale(nextScale);
        return;
      }
      setDragging(true);
      const box = rootRef.current?.getBoundingClientRect();
      const width = box?.width || 120;
      const height = box?.height || 120;
      const next = clampBox(gesture.origLeft + dx, gesture.origTop + dy, width, height);
      const nextX = Math.round((next.left / window.innerWidth) * 1000) / 10;
      const nextY = Math.round((next.top / window.innerHeight) * 1000) / 10;
      gesture.lastX = nextX;
      gesture.lastY = nextY;
      setPlaced({ x: nextX, y: nextY });
    }

    function onUp(event: PointerEvent) {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      gestureRef.current = null;
      setDragging(false);
      setResizing(false);
      if (!gesture.moved) return;
      skipClickRef.current = true;
      const opts = optsRef.current;
      if (gesture.mode === "resize") {
        persistScaleNow(gesture.lastScale);
        return;
      }
      const body = opts.buildPlacePatch
        ? opts.buildPlacePatch(gesture.lastX, gesture.lastY)
        : {
            [opts.persistField]: {
              xPercent: gesture.lastX,
              yPercent: gesture.lastY,
            },
          };
      void persistPatch(body, "正在保存位置…", "位置已保存，访客会看到这里");
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  function beginGesture(
    event: ReactPointerEvent<HTMLElement>,
    mode: "move" | "resize",
  ) {
    if (!optsRef.current.canDrag || event.button !== 0) return;
    const box = rootRef.current?.getBoundingClientRect();
    if (!box) return;
    event.preventDefault();
    event.stopPropagation();
    const current = placedRef.current;
    gestureRef.current = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origLeft: box.left,
      origTop: box.top,
      startScale: scaleRef.current,
      moved: false,
      lastX: current?.x ?? 0,
      lastY: current?.y ?? 0,
      lastScale: scaleRef.current,
    };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    beginGesture(event, "move");
  }

  function onResizePointerDown(event: ReactPointerEvent<HTMLElement>) {
    beginGesture(event, "resize");
  }

  function onPointerMove() {
    /* 位移/缩放改由 window 监听，避免重绘丢 capture */
  }

  function onPointerUp() {
    /* 同上 */
  }

  function onActivate() {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    setControlsOpen((prev) => !prev);
  }

  function zoomIn() {
    const next = clampHomeLogoScale(scaleRef.current + HOME_LOGO_SCALE_STEP);
    setScale(next);
    persistScaleNow(next);
  }

  function zoomOut() {
    const next = clampHomeLogoScale(scaleRef.current - HOME_LOGO_SCALE_STEP);
    setScale(next);
    persistScaleNow(next);
  }

  function onHide() {
    setHidden(true);
    setControlsOpen(false);
    const opts = optsRef.current;
    if (!opts.canDrag) return;
    const body = opts.buildHidePatch
      ? opts.buildHidePatch()
      : { [opts.persistField]: { visible: false } };
    if (!body) return;
    void persistPatch(body, "正在隐藏…", "已隐藏，装扮里可再打开");
  }

  const customPlace = placed != null;
  const scaled = scale !== HOME_LOGO_SCALE_DEFAULT;
  return {
    rootRef,
    placed,
    dragging,
    resizing,
    scale,
    scaled,
    controlsOpen,
    hidden,
    canZoomIn: scale < HOME_LOGO_SCALE_MAX,
    canZoomOut: scale > HOME_LOGO_SCALE_MIN,
    saveHint,
    customPlace,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onResizePointerDown,
    onActivate,
    zoomIn,
    zoomOut,
    onHide,
  };
}

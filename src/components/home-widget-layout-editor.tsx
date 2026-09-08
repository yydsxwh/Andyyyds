"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";
import { HomePortalCardBody } from "@/components/home-portal-card-body";
import { SiteHomeClock } from "@/components/site-home-clock";
import { SiteHomeLogo } from "@/components/site-home-logo";
import type { HomeClockConfig } from "@andyyyds/shared/home-clock";
import type { HomeLogoConfig } from "@andyyyds/shared/home-logo";
import {
  HOME_WIDGET_CLOCK_ID,
  HOME_WIDGET_LOGO_ID,
  HOME_WIDGET_DEFAULT_CANVAS_MIN_HEIGHT_PX,
  HOME_WIDGET_MAX_H_PX,
  HOME_WIDGET_MAX_W_PCT,
  HOME_WIDGET_MAX_Y_PX,
  HOME_WIDGET_MIN_H_PX,
  HOME_WIDGET_MIN_W_PCT,
  clampHomeWidgetBox,
  defaultHomeWidgetBoxes,
  homeWidgetBoxStyle,
  homeWidgetNavId,
  mergeHomeWidgetBoxes,
  normalizeHomeWidgetLayout,
  resolveCanvasMinHeightPx,
  type HomeWidgetBox,
  type HomeWidgetLayoutConfig,
} from "@andyyyds/shared/home-widget-layout";
import type { PortalNavLink } from "@andyyyds/shared/portal";

type DragKind = "move" | "resize";

type DragState = {
  id: string;
  kind: DragKind;
  pointerId: number;
  startX: number;
  startY: number;
  orig: HomeWidgetBox;
};

type Props = {
  initial: HomeWidgetLayoutConfig;
  navItems: PortalNavLink[];
  clockConfig?: HomeClockConfig | null;
  logoConfig?: HomeLogoConfig | null;
};

function widgetLabel(id: string, navItems: PortalNavLink[]) {
  if (id === HOME_WIDGET_CLOCK_ID) return "首页时钟";
  if (id === HOME_WIDGET_LOGO_ID) return "颗秒标";
  const key = id.startsWith("nav:") ? id.slice(4) : id;
  return navItems.find((item) => item.key === key)?.label || key;
}

export function HomeWidgetLayoutEditor({
  initial,
  navItems,
  clockConfig,
  logoConfig,
}: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const itemsRef = useRef<Record<string, HomeWidgetBox>>({});
  const enabledRef = useRef(false);
  const navKeys = useMemo(
    () => navItems.map((item) => item.key),
    [navItems],
  );
  const [enabled, setEnabled] = useState(initial.enabled === true);
  const [items, setItems] = useState<Record<string, HomeWidgetBox>>(() =>
    mergeHomeWidgetBoxes(initial.items, navKeys),
  );
  const [canvasMinHeightPx, setCanvasMinHeightPx] = useState(() =>
    resolveCanvasMinHeightPx(initial.items, initial.canvasMinHeightPx),
  );
  const [selectedId, setSelectedId] = useState<string>(HOME_WIDGET_CLOCK_ID);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<SaveStatus>(null);

  itemsRef.current = items;
  enabledRef.current = enabled;

  const minHeight = resolveCanvasMinHeightPx(items, canvasMinHeightPx);
  const selected = items[selectedId];

  function applyBox(id: string, nextBox: HomeWidgetBox) {
    // 一改位置/尺寸就启用，避免摆好了却忘勾选、前台毫无变化
    setEnabled(true);
    setItems((prev) => ({ ...prev, [id]: nextBox }));
  }

  function patchBox(id: string, partial: Partial<HomeWidgetBox>) {
    const current = itemsRef.current[id];
    if (!current) return;
    applyBox(id, clampHomeWidgetBox({ ...current, ...partial }));
  }

  function resetDefaults() {
    const next = defaultHomeWidgetBoxes(navKeys);
    setItems(next);
    setCanvasMinHeightPx(HOME_WIDGET_DEFAULT_CANVAS_MIN_HEIGHT_PX);
    setSelectedId(HOME_WIDGET_CLOCK_ID);
    setFeedback({ kind: "ok", text: "已恢复默认摆放，记得点保存" });
  }

  function applyDrag(clientX: number, clientY: number) {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dxPct = ((clientX - drag.startX) / Math.max(rect.width, 1)) * 100;
    const dyPx = clientY - drag.startY;
    const next =
      drag.kind === "move"
        ? clampHomeWidgetBox({
            ...drag.orig,
            xPct: drag.orig.xPct + dxPct,
            yPx: drag.orig.yPx + dyPx,
          })
        : clampHomeWidgetBox({
            ...drag.orig,
            wPct: drag.orig.wPct + dxPct,
            hPx: drag.orig.hPx + dyPx,
          });
    applyBox(drag.id, next);
  }

  function onPointerDown(
    e: ReactPointerEvent<HTMLElement>,
    id: string,
    kind: DragKind,
  ) {
    // 窗口级 move/up：避免每次 setState 重绘把 pointer capture 丢掉
    e.preventDefault();
    e.stopPropagation();
    const box = itemsRef.current[id];
    if (!box) return;
    setSelectedId(id);
    setEnabled(true);
    dragRef.current = {
      id,
      kind,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...box },
    };
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      e.preventDefault();
      applyDrag(e.clientX, e.clientY);
    }
    function onUp(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      applyDrag(e.clientX, e.clientY);
      dragRef.current = null;
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

  async function save() {
    setSaving(true);
    setFeedback(null);
    const payload: HomeWidgetLayoutConfig = normalizeHomeWidgetLayout({
      enabled: enabledRef.current,
      canvasMinHeightPx: resolveCanvasMinHeightPx(
        itemsRef.current,
        canvasMinHeightPx,
      ),
      items: itemsRef.current,
    });
    const result = await postSave("/api/studio/decorate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homeWidgetLayout: payload }),
    });
    setSaving(false);
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "保存失败" });
      return;
    }
    const saved = (
      result.data.decorate as { homeWidgetLayout?: HomeWidgetLayoutConfig } | undefined
    )?.homeWidgetLayout;
    if (saved) {
      setEnabled(saved.enabled);
      setItems(mergeHomeWidgetBoxes(saved.items, navKeys));
      setCanvasMinHeightPx(saved.canvasMinHeightPx);
    }
    setFeedback({
      kind: "ok",
      text: payload.enabled
        ? "首页摆放已保存，前台按此位置与尺寸显示"
        : "已保存。尚未启用自由布局，前台仍是栅格卡片和顶栏时钟",
    });
    router.refresh();
  }

  const widgetIds = [
    HOME_WIDGET_LOGO_ID,
    HOME_WIDGET_CLOCK_ID,
    ...navKeys.map((key) => homeWidgetNavId(key)),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <label className="flex min-h-11 items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--brand)]"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>
            <span className="font-medium text-[var(--ink)]">启用自由布局</span>
            <span className="mt-0.5 block text-[var(--muted)]">
              勾选并保存后，首页时钟离开顶栏，和门户卡片一起按画布摆放。手机微信可拖、可拉角缩放。
            </span>
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary min-h-11 px-4 text-sm"
            onClick={resetDefaults}
          >
            恢复默认摆放
          </button>
          <button
            type="button"
            className="btn btn-primary min-h-11 px-4 text-sm"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "保存中…" : "保存首页摆放"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {widgetIds.map((id) => (
          <button
            key={id}
            type="button"
            className={`min-h-11 touch-manipulation rounded-full px-3 text-sm ${
              selectedId === id
                ? "bg-[var(--brand-soft)] font-medium text-[var(--brand)]"
                : "border border-[var(--line)] text-[var(--muted)]"
            }`}
            onClick={() => setSelectedId(id)}
          >
            {widgetLabel(id, navItems)}
          </button>
        ))}
      </div>

      {selected ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            label="左边距 %"
            value={selected.xPct}
            min={0}
            max={100 - HOME_WIDGET_MIN_W_PCT}
            step={0.5}
            onChange={(xPct) => patchBox(selectedId, { xPct })}
          />
          <NumberField
            label="上边距 px"
            value={selected.yPx}
            min={0}
            max={HOME_WIDGET_MAX_Y_PX}
            step={1}
            onChange={(yPx) => patchBox(selectedId, { yPx })}
          />
          <NumberField
            label="宽度 %"
            value={selected.wPct}
            min={HOME_WIDGET_MIN_W_PCT}
            max={HOME_WIDGET_MAX_W_PCT}
            step={0.5}
            onChange={(wPct) => patchBox(selectedId, { wPct })}
          />
          <NumberField
            label="高度 px"
            value={selected.hPx}
            min={HOME_WIDGET_MIN_H_PX}
            max={HOME_WIDGET_MAX_H_PX}
            step={1}
            onChange={(hPx) => patchBox(selectedId, { hPx })}
          />
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="text-[var(--muted)]">画布最小高度 px</span>
        <input
          type="range"
          className="mt-2 w-full accent-[var(--brand)]"
          min={200}
          max={1600}
          step={10}
          value={Math.min(1600, minHeight)}
          onChange={(e) => setCanvasMinHeightPx(Number(e.target.value))}
        />
        <span className="mt-1 block text-xs text-[var(--muted)]">{minHeight}px</span>
      </label>

      <div
        ref={canvasRef}
        className="relative select-none overflow-hidden rounded-[24px] border border-dashed border-[var(--line)] bg-[var(--bg-deep)]/40"
        style={{ minHeight }}
      >
        <p className="pointer-events-none absolute left-3 top-2 z-0 text-xs text-[var(--muted)]">
          按住顶条拖动；右下角方块拉大小
        </p>
        {widgetIds.map((id) => {
          const box = items[id];
          if (!box) return null;
          const selectedRing =
            selectedId === id
              ? "ring-2 ring-[var(--brand)] ring-offset-2"
              : "ring-1 ring-black/10";
          const nav = navItems.find((item) => homeWidgetNavId(item.key) === id);
          return (
            <div
              key={id}
              className={`absolute z-10 overflow-visible rounded-[28px] ${selectedRing}`}
              style={homeWidgetBoxStyle(box)}
            >
              <button
                type="button"
                aria-label={`${widgetLabel(id, navItems)}，拖动移动`}
                className="absolute inset-x-0 top-0 z-20 flex min-h-11 cursor-move touch-none items-center justify-center rounded-t-[28px] bg-[var(--brand)]/90 px-2 text-xs font-medium text-white"
                onPointerDown={(e) => onPointerDown(e, id, "move")}
              >
                拖动 · {widgetLabel(id, navItems)}
              </button>
              <div className="pointer-events-none h-full w-full pt-11">
                {id === HOME_WIDGET_CLOCK_ID ? (
                  <SiteHomeClock
                    forceVisible
                    fill
                    config={clockConfig}
                    className="h-full w-full"
                  />
                ) : id === HOME_WIDGET_LOGO_ID ? (
                  <SiteHomeLogo
                    forceVisible
                    fill
                    config={logoConfig}
                    className="h-full w-full"
                  />
                ) : (
                  <div className="surface-soft group h-full overflow-hidden rounded-b-[28px] p-4">
                    <HomePortalCardBody
                      label={nav?.label || id}
                      comingSoon={nav?.comingSoon}
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                aria-label={`${widgetLabel(id, navItems)}，拉角缩放`}
                className="absolute -bottom-1 -right-1 z-30 flex h-11 w-11 cursor-se-resize touch-none items-center justify-center"
                onPointerDown={(e) => onPointerDown(e, id, "resize")}
              >
                <span className="h-5 w-5 rounded-sm border-2 border-[var(--brand)] bg-white shadow" />
              </button>
            </div>
          );
        })}
      </div>

      <SaveFeedback status={feedback} />
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <input
        type="number"
        className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

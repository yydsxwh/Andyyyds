"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PRODUCT_TITLE_MAX } from "@/lib/media";
import { productDetailPath } from "@/lib/product-types";
import type { ComposeUiCopy } from "@/lib/ui-copy";

/** 超过该像素才算拖拽框选，避免误当成点击 */
const MARQUEE_THRESHOLD_PX = 6;

type Asset = {
  id: string;
  name: string;
  category: { name: string } | null;
};

type ProductTypeChoice = "COURSE" | "COLUMN" | "MATERIAL";

type Props = {
  assets: Asset[];
  initialSelectedIds: string[];
  /** 深链预选类型：如从「创建资料」入口带 ?type=MATERIAL */
  initialProductType?: ProductTypeChoice;
  copy: ComposeUiCopy;
};

type DragPayload =
  | { source: "catalog"; id: string }
  | { source: "selected"; id: string };

const DRAG_MIME = "application/x-yyds-compose-asset";

function normalizeProductType(
  value: ProductTypeChoice | undefined,
): ProductTypeChoice {
  if (value === "COLUMN" || value === "MATERIAL") return value;
  return "COURSE";
}

export function ComposeProductForm({
  assets,
  initialSelectedIds,
  initialProductType,
  copy,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [checked, setChecked] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(
    initialSelectedIds.filter((id) => assets.some((a) => a.id === id)),
  );
  const [productType, setProductType] = useState<ProductTypeChoice>(() =>
    normalizeProductType(initialProductType),
  );
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("99");
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [publish, setPublish] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOverSelected, setDragOverSelected] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  /** 左侧目录框选矩形（相对 list 可视区域） */
  const [marquee, setMarquee] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const catalogListRef = useRef<HTMLDivElement>(null);
  const cardElsRef = useRef<Map<string, HTMLElement>>(new Map());
  const marqueeSessionRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    active: boolean;
    additive: boolean;
    baseChecked: string[];
  } | null>(null);
  /** 刚做完框选时吞掉随后的 click，避免再 toggle 一次 */
  const suppressCardClickRef = useRef(false);

  const selectedAssets = useMemo(
    () =>
      selected
        .map((id) => assets.find((a) => a.id === id))
        .filter(Boolean) as Asset[],
    [selected, assets],
  );

  const catalogAssets = useMemo(
    () => assets.filter((a) => !selected.includes(a.id)),
    [assets, selected],
  );

  function toggleChecked(id: string) {
    setChecked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function registerCardEl(id: string, el: HTMLElement | null) {
    if (el) cardElsRef.current.set(id, el);
    else cardElsRef.current.delete(id);
  }

  /** box 为列表内容坐标（含 scrollTop/Left）；与卡片可视矩形做相交判断 */
  function idsIntersectingMarquee(
    list: HTMLDivElement,
    box: { left: number; top: number; width: number; height: number },
  ) {
    const listRect = list.getBoundingClientRect();
    const abs = {
      left: listRect.left + box.left - list.scrollLeft,
      top: listRect.top + box.top - list.scrollTop,
      right: listRect.left + box.left - list.scrollLeft + box.width,
      bottom: listRect.top + box.top - list.scrollTop + box.height,
    };
    const hit: string[] = [];
    for (const [id, el] of cardElsRef.current) {
      const r = el.getBoundingClientRect();
      const overlap =
        r.left < abs.right &&
        r.right > abs.left &&
        r.top < abs.bottom &&
        r.bottom > abs.top;
      if (overlap) hit.push(id);
    }
    return hit;
  }

  function onCatalogPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // 触控留给整卡点选与列表滚动；框选仅鼠标左键
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("[data-drag-handle]")) return;
    if (target?.closest("input, button, a")) return;

    const list = catalogListRef.current;
    if (!list) return;
    const rect = list.getBoundingClientRect();
    marqueeSessionRef.current = {
      pointerId: e.pointerId,
      originX: e.clientX - rect.left + list.scrollLeft,
      originY: e.clientY - rect.top + list.scrollTop,
      active: false,
      // Shift 追加勾选，否则框选结果替换当前勾选
      additive: e.shiftKey,
      baseChecked: [...checked],
    };
    try {
      list.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  function onCatalogPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const session = marqueeSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;
    const list = catalogListRef.current;
    if (!list) return;

    const rect = list.getBoundingClientRect();
    const x = e.clientX - rect.left + list.scrollLeft;
    const y = e.clientY - rect.top + list.scrollTop;
    const dx = x - session.originX;
    const dy = y - session.originY;
    if (
      !session.active &&
      Math.hypot(dx, dy) < MARQUEE_THRESHOLD_PX
    ) {
      return;
    }
    session.active = true;
    suppressCardClickRef.current = true;

    // 内容坐标：绝对定位子元素会随列表滚动，需用 scroll 后的坐标系
    const box = {
      left: Math.min(session.originX, x),
      top: Math.min(session.originY, y),
      width: Math.abs(dx),
      height: Math.abs(dy),
    };
    setMarquee(box);

    const hit = idsIntersectingMarquee(list, box);
    if (session.additive) {
      setChecked([...new Set([...session.baseChecked, ...hit])]);
    } else {
      setChecked(hit);
    }
  }

  function endCatalogMarquee(e: React.PointerEvent<HTMLDivElement>) {
    const session = marqueeSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;
    marqueeSessionRef.current = null;
    setMarquee(null);
    const list = catalogListRef.current;
    try {
      list?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (session.active) {
      // 下一帧再允许卡片 click，避免 pointerup 后的 click 反选
      window.setTimeout(() => {
        suppressCardClickRef.current = false;
      }, 0);
    }
  }

  function onCatalogCardClick(id: string) {
    if (suppressCardClickRef.current) return;
    toggleChecked(id);
  }

  function addToSelected(ids: string[]) {
    const unique = ids.filter(
      (id) => assets.some((a) => a.id === id) && !selected.includes(id),
    );
    if (unique.length === 0) return;
    setSelected((prev) => [...prev, ...unique]);
    setChecked((prev) => prev.filter((id) => !unique.includes(id)));
  }

  function addChecked() {
    addToSelected(checked);
  }

  function removeSelected(id: string) {
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  function clearSelected() {
    setSelected([]);
  }

  function reorderSelected(fromId: string, toIndex: number) {
    setSelected((prev) => {
      const from = prev.indexOf(fromId);
      if (from < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      const clamped = Math.max(0, Math.min(toIndex, next.length));
      next.splice(clamped, 0, item);
      return next;
    });
  }

  function parseDragPayload(e: React.DragEvent): DragPayload | null {
    const raw =
      e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData("text/plain");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DragPayload;
    } catch {
      return null;
    }
  }

  function setDragData(e: React.DragEvent, payload: DragPayload) {
    const raw = JSON.stringify(payload);
    e.dataTransfer.setData(DRAG_MIME, raw);
    e.dataTransfer.setData("text/plain", raw);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDropToSelected(e: React.DragEvent, atIndex?: number) {
    e.preventDefault();
    setDragOverSelected(false);
    setDragOverIndex(null);
    const payload = parseDragPayload(e);
    if (!payload) return;

    if (payload.source === "catalog") {
      const ids =
        checked.includes(payload.id) && checked.length > 1
          ? checked
          : [payload.id];
      if (typeof atIndex === "number") {
        const fresh = ids.filter(
          (id) => assets.some((a) => a.id === id) && !selected.includes(id),
        );
        if (fresh.length === 0) return;
        setSelected((prev) => {
          const next = [...prev];
          next.splice(atIndex, 0, ...fresh);
          return next;
        });
        setChecked((prev) => prev.filter((id) => !fresh.includes(id)));
      } else {
        addToSelected(ids);
      }
      return;
    }

    if (payload.source === "selected" && typeof atIndex === "number") {
      reorderSelected(payload.id, atIndex);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (selected.length === 0) {
      setError("请至少选择 1 个素材");
      setStep(1);
      return;
    }
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    if (trimmedTitle.length < 2) {
      setError("标题至少需要 2 个字");
      return;
    }
    if (trimmedDesc.length < 2) {
      setError("产品介绍至少需要 2 个字");
      return;
    }
    if (Number.isNaN(Number(price)) || Number(price) < 0) {
      setError("请填写有效价格");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/studio/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType,
          title: trimmedTitle,
          subtitle,
          description: trimmedDesc,
          price: Number(price),
          publish,
          groupByCategory,
          assetIds: selected,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        slug?: string;
      };
      if (!res.ok) {
        setError(data.error || "创建失败");
        return;
      }
      if (!data.slug) {
        setError("创建成功但未返回链接，请到课程列表查看");
        return;
      }
      router.push(productDetailPath(data.slug, productType));
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StepPill active={step === 1} done={step > 1} n={1} label="选择素材" />
        <span className="text-[var(--muted)]">→</span>
        <StepPill active={step === 2} done={false} n={2} label="填写产品信息" />
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="surface space-y-4 rounded-[28px] p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">从素材中心选择</h2>
                <span className="text-xs text-[var(--muted)]">
                  已勾选 {checked.length} 个
                </span>
              </div>
              <p className="text-sm text-[var(--muted)]">
                点击整张卡片即可勾选；按住鼠标左键拖动可框选多个。右侧把手可拖到导入区；手机上点卡片即可。
              </p>
              <div
                ref={catalogListRef}
                className="relative max-h-[480px] space-y-2 overflow-y-auto pr-1 select-none"
                onPointerDown={onCatalogPointerDown}
                onPointerMove={onCatalogPointerMove}
                onPointerUp={endCatalogMarquee}
                onPointerCancel={endCatalogMarquee}
              >
                {catalogAssets.map((asset) => {
                  const isChecked = checked.includes(asset.id);
                  return (
                    <div
                      key={asset.id}
                      ref={(el) => registerCardEl(asset.id, el)}
                      role="checkbox"
                      aria-checked={isChecked}
                      tabIndex={0}
                      onClick={() => onCatalogCardClick(asset.id)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          onCatalogCardClick(asset.id);
                        }
                      }}
                      className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 ${
                        isChecked
                          ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                          : "border-[var(--line)] bg-white/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="pointer-events-none mt-1"
                        checked={isChecked}
                        readOnly
                        tabIndex={-1}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-medium leading-snug">
                          {asset.name}
                        </span>
                        <span className="mt-1 block text-xs text-[var(--muted)]">
                          {asset.category?.name || "未分类"} · 点卡片勾选
                        </span>
                      </span>
                      {/* 拖拽把手与框选分离，避免整卡 draggable 抢鼠标 */}
                      <span
                        data-drag-handle
                        draggable
                        title="拖到右侧导入"
                        aria-label={`拖拽导入 ${asset.name}`}
                        onClick={(e) => e.stopPropagation()}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDragData(e, { source: "catalog", id: asset.id });
                        }}
                        className="mt-0.5 inline-flex min-h-10 min-w-10 shrink-0 cursor-grab items-center justify-center rounded-xl border border-[var(--line)] bg-white/90 text-xs text-[var(--muted)] active:cursor-grabbing"
                      >
                        拖
                      </span>
                    </div>
                  );
                })}
                {marquee ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute z-10 rounded-md border border-[var(--brand)] bg-[var(--brand-soft)]/50"
                    style={{
                      left: marquee.left,
                      top: marquee.top,
                      width: marquee.width,
                      height: marquee.height,
                    }}
                  />
                ) : null}
              </div>
              {assets.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  素材库为空，请先去素材中心上传。
                </p>
              ) : catalogAssets.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  可选素材已全部加入右侧列表。
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={checked.length === 0}
                  onClick={addChecked}
                >
                  加入已选（{checked.length}）
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={checked.length === 0}
                  onClick={() => setChecked([])}
                >
                  清除勾选
                </button>
              </div>
            </div>

            <div
              className={`surface space-y-4 rounded-[28px] p-6 transition ${
                dragOverSelected
                  ? "ring-2 ring-[var(--brand)] ring-offset-2"
                  : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverSelected(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverSelected(false);
                  setDragOverIndex(null);
                }
              }}
              onDrop={(e) => onDropToSelected(e, selected.length)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">已选素材 / 导入区</h2>
                <span className="text-xs text-[var(--muted)]">
                  {selected.length} 个 · 可拖拽排序
                </span>
              </div>
              <p className="text-sm text-[var(--muted)]">
                把左侧素材拖到这里导入；在列表内上下拖动可调整课时顺序。
              </p>

              {selectedAssets.length === 0 ? (
                <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-[var(--line)] bg-white/50 px-4 py-8 text-center text-sm text-[var(--muted)]">
                  拖拽素材到此处，或点选/框选后点「加入已选」
                </div>
              ) : (
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {selectedAssets.map((asset, index) => (
                    <div
                      key={asset.id}
                      draggable
                      onDragStart={(e) => {
                        setDragData(e, { source: "selected", id: asset.id });
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverIndex(index);
                      }}
                      onDrop={(e) => {
                        e.stopPropagation();
                        onDropToSelected(e, index);
                      }}
                      className={`flex cursor-grab items-center gap-2 rounded-xl border bg-[var(--bg)] px-3 py-2.5 text-sm active:cursor-grabbing ${
                        dragOverIndex === index
                          ? "border-[var(--brand)]"
                          : "border-transparent"
                      }`}
                    >
                      <span className="w-5 shrink-0 text-[var(--muted)]">
                        {index + 1}.
                      </span>
                      <span className="min-w-0 flex-1 break-words">
                        <span className="block font-medium">{asset.name}</span>
                        <span className="text-xs text-[var(--muted)]">
                          {asset.category?.name || "未分类"}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary px-2 py-1 text-xs"
                        onClick={() => removeSelected(asset.id)}
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {selectedAssets.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={clearSelected}
                >
                  清空已选
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              {selected.length > 0
                ? `已准备 ${selected.length} 个素材，确认后填写产品信息`
                : "请至少导入 1 个素材后再继续"}
            </p>
            <button
              type="button"
              className="btn btn-accent"
              disabled={selected.length === 0}
              onClick={() => {
                setError("");
                setStep(2);
              }}
            >
              下一步：填写产品信息
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="surface space-y-4 rounded-[28px] p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">已选素材摘要</h2>
              <button
                type="button"
                className="btn btn-secondary px-3 py-1.5 text-xs"
                onClick={() => {
                  setError("");
                  setStep(1);
                }}
              >
                返回修改素材
              </button>
            </div>
            <ol className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {selectedAssets.map((asset, index) => (
                <li
                  key={asset.id}
                  className="rounded-xl bg-[var(--bg)] px-3 py-2 text-sm"
                >
                  <span className="text-[var(--muted)]">{index + 1}. </span>
                  <span className="break-words font-medium">{asset.name}</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    {asset.category?.name || "未分类"}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="surface space-y-4 rounded-[28px] p-6">
            <h2 className="text-lg font-semibold">{copy.step2Title}</h2>
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                <button
                  type="button"
                  className={`btn min-h-11 flex-1 ${productType === "COURSE" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setProductType("COURSE")}
                >
                  {copy.courseTypeLabel}
                </button>
                <button
                  type="button"
                  className={`btn min-h-11 flex-1 ${productType === "COLUMN" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setProductType("COLUMN")}
                >
                  {copy.columnTypeLabel}
                </button>
                <button
                  type="button"
                  className={`btn min-h-11 flex-1 ${productType === "MATERIAL" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setProductType("MATERIAL")}
                >
                  资料
                </button>
              </div>
              <span className="group relative shrink-0">
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] bg-white/80 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:border-[var(--brand)] focus-visible:text-[var(--brand)] focus-visible:outline-none"
                  aria-label="单课、专栏与资料的区别"
                  aria-describedby="product-type-help"
                >
                  ?
                </button>
                <span
                  id="product-type-help"
                  role="tooltip"
                  className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border border-[var(--line)] bg-white px-3 py-2.5 text-left text-xs leading-relaxed text-[var(--ink)] opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  <span className="block">
                    <span className="font-medium text-[var(--brand)]">单课</span>
                    ：独立一门可售课程，素材组成章节/课时后直接上架。
                  </span>
                  <span className="mt-1.5 block">
                    <span className="font-medium text-[var(--brand)]">专栏</span>
                    ：做成系列/合集产品，前台展示为「专栏」，适合多内容打包或按分类分章售卖。
                  </span>
                  <span className="mt-1.5 block">
                    <span className="font-medium text-[var(--brand)]">资料</span>
                    ：文档/图片/音视频等打包售卖，出现在「资料广场」，支持优惠券与分销分享。
                  </span>
                </span>
              </span>
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--muted)]">
                {copy.titleLabel}
              </label>
              <input
                className="field"
                value={title}
                maxLength={PRODUCT_TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  productType === "MATERIAL"
                    ? "例如：考研真题资料包"
                    : productType === "COLUMN"
                      ? copy.titlePlaceholderColumn
                      : copy.titlePlaceholderCourse
                }
                required
              />
              <div className="mt-1 text-right text-xs text-[var(--muted)]">
                {title.length}/{PRODUCT_TITLE_MAX}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--muted)]">
                {copy.subtitleLabel}
              </label>
              <input
                className="field"
                value={subtitle}
                maxLength={200}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder={copy.subtitlePlaceholder}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--muted)]">
                {copy.descriptionLabel}
              </label>
              <textarea
                className="field min-h-32"
                value={description}
                minLength={2}
                maxLength={5000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={copy.descriptionPlaceholder}
                required
              />
              <div className="mt-1 text-right text-xs text-[var(--muted)]">
                {description.trim().length}/5000（至少 2 个字）
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">
                {copy.priceLabel}
              </label>
              <div className="relative">
                <input
                  className="field pr-12"
                  type="number"
                  min="0"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={copy.pricePlaceholder}
                  required
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">
                  元
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">{copy.priceHint}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={groupByCategory}
                onChange={(e) => setGroupByCategory(e.target.checked)}
              />
              {copy.groupByCategoryLabel}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => setPublish(e.target.checked)}
              />
              {copy.publishLabel}
            </label>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn btn-secondary sm:w-auto"
                onClick={() => {
                  setError("");
                  setStep(1);
                }}
              >
                上一步
              </button>
              <button
                className="btn btn-accent flex-1"
                disabled={loading || selected.length === 0}
                type="submit"
              >
                {loading
                  ? "创建中..."
                  : `${
                      productType === "MATERIAL"
                        ? "创建资料并上架"
                        : productType === "COLUMN"
                          ? copy.submitLabelColumn
                          : copy.submitLabelCourse
                    }（${selected.length} 个素材）`}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function StepPill({
  active,
  done,
  n,
  label,
}: {
  active: boolean;
  done: boolean;
  n: number;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${
        active
          ? "bg-[var(--brand)] text-white"
          : done
            ? "bg-[var(--brand-soft)] text-[var(--brand)]"
            : "bg-[var(--bg)] text-[var(--muted)]"
      }`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
        {done ? "✓" : n}
      </span>
      {label}
    </span>
  );
}

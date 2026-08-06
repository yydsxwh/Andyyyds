"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PRODUCT_TITLE_MAX } from "@/lib/media";
import type { ComposeUiCopy } from "@/lib/ui-copy";

type Asset = {
  id: string;
  name: string;
  category: { name: string } | null;
};

type Props = {
  assets: Asset[];
  initialSelectedIds: string[];
  copy: ComposeUiCopy;
};

type DragPayload =
  | { source: "catalog"; id: string }
  | { source: "selected"; id: string };

const DRAG_MIME = "application/x-yyds-compose-asset";

export function ComposeProductForm({
  assets,
  initialSelectedIds,
  copy,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [checked, setChecked] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(
    initialSelectedIds.filter((id) => assets.some((a) => a.id === id)),
  );
  const [productType, setProductType] = useState<"COURSE" | "COLUMN">("COURSE");
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
      router.push(`/courses/${data.slug}`);
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
                勾选多个素材后点「加入已选」，或用鼠标按住拖到右侧导入区。
              </p>
              <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                {catalogAssets.map((asset) => {
                  const isChecked = checked.includes(asset.id);
                  return (
                    <div
                      key={asset.id}
                      draggable
                      onDragStart={(e) => {
                        setDragData(e, { source: "catalog", id: asset.id });
                      }}
                      className={`flex cursor-grab items-start gap-3 rounded-2xl border px-3 py-3 active:cursor-grabbing ${
                        isChecked
                          ? "border-[var(--brand)] bg-[rgba(15,107,92,0.06)]"
                          : "border-[var(--line)] bg-white/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={isChecked}
                        onChange={() => toggleChecked(asset.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`选择 ${asset.name}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-medium leading-snug">
                          {asset.name}
                        </span>
                        <span className="mt-1 block text-xs text-[var(--muted)]">
                          {asset.category?.name || "未分类"} · 拖拽可导入
                        </span>
                      </span>
                    </div>
                  );
                })}
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
                  拖拽素材到此处，或勾选后点「加入已选」
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
              <div className="flex min-w-0 flex-1 gap-2">
                <button
                  type="button"
                  className={`btn flex-1 ${productType === "COURSE" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setProductType("COURSE")}
                >
                  {copy.courseTypeLabel}
                </button>
                <button
                  type="button"
                  className={`btn flex-1 ${productType === "COLUMN" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setProductType("COLUMN")}
                >
                  {copy.columnTypeLabel}
                </button>
              </div>
              <span className="group relative shrink-0">
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] bg-white/80 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:border-[var(--brand)] focus-visible:text-[var(--brand)] focus-visible:outline-none"
                  aria-label="单课与专栏的区别"
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
                  productType === "COLUMN"
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
                  : `${productType === "COLUMN" ? copy.submitLabelColumn : copy.submitLabelCourse}（${selected.length} 个素材）`}
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
            ? "bg-[rgba(15,107,92,0.12)] text-[var(--brand)]"
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

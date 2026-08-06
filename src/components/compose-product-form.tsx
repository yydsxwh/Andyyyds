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

export function ComposeProductForm({
  assets,
  initialSelectedIds,
  copy,
}: Props) {
  const router = useRouter();
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

  const selectedAssets = useMemo(
    () =>
      selected
        .map((id) => assets.find((a) => a.id === id))
        .filter(Boolean) as Asset[],
    [selected, assets],
  );

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function move(id: string, direction: -1 | 1) {
    setSelected((prev) => {
      const index = prev.indexOf(id);
      if (index < 0) return prev;
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (selected.length === 0) {
      setError("请至少选择 1 个素材");
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
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="surface space-y-4 rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">1. 多选并排列素材</h2>
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {assets.map((asset) => {
            const checked = selected.includes(asset.id);
            return (
              <label
                key={asset.id}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 ${
                  checked
                    ? "border-[var(--brand)] bg-[rgba(15,107,92,0.06)]"
                    : "border-[var(--line)] bg-white/60"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  onChange={() => toggle(asset.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium leading-snug">{asset.name}</span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {asset.category?.name || "未分类"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {assets.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">素材库为空，请先去素材中心上传。</p>
        ) : null}

        {selectedAssets.length > 0 ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
            <div className="mb-2 text-sm font-medium">已选顺序（可上下调整）</div>
            <div className="space-y-2">
              {selectedAssets.map((asset, index) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-2 rounded-xl bg-[var(--bg)] px-3 py-2 text-sm"
                >
                  <span className="text-[var(--muted)]">{index + 1}.</span>
                  <span className="min-w-0 flex-1 break-words">{asset.name}</span>
                  <button className="btn btn-secondary px-2 py-1 text-xs" type="button" onClick={() => move(asset.id, -1)}>
                    上
                  </button>
                  <button className="btn btn-secondary px-2 py-1 text-xs" type="button" onClick={() => move(asset.id, 1)}>
                    下
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="surface space-y-4 rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">{copy.step2Title}</h2>
        <div className="flex gap-2">
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
        <div>
          <label className="mb-1 block text-sm text-[var(--muted)]">{copy.titleLabel}</label>
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
          <label className="mb-1 block text-sm text-[var(--muted)]">{copy.subtitleLabel}</label>
          <input
            className="field"
            value={subtitle}
            maxLength={200}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder={copy.subtitlePlaceholder}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-[var(--muted)]">{copy.descriptionLabel}</label>
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
        <button
          className="btn btn-accent w-full"
          disabled={loading || selected.length === 0}
          type="submit"
        >
          {loading
            ? "创建中..."
            : `${productType === "COLUMN" ? copy.submitLabelColumn : copy.submitLabelCourse}（${selected.length} 个素材）`}
        </button>
      </div>
    </form>
  );
}

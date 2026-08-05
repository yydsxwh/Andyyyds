"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PRODUCT_TITLE_MAX } from "@/lib/media";

type Asset = {
  id: string;
  name: string;
  category: { name: string } | null;
};

type Props = {
  assets: Asset[];
  initialSelectedIds: string[];
};

export function ComposeProductForm({ assets, initialSelectedIds }: Props) {
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
    setLoading(true);
    setError("");
    const res = await fetch("/api/studio/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productType,
        title,
        subtitle,
        description,
        price: Number(price),
        publish,
        groupByCategory,
        assetIds: selected,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "创建失败");
      return;
    }
    router.push(`/courses/${data.slug}`);
    router.refresh();
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
        <h2 className="text-lg font-semibold">2. 做成可售产品</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className={`btn flex-1 ${productType === "COURSE" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProductType("COURSE")}
          >
            单课
          </button>
          <button
            type="button"
            className={`btn flex-1 ${productType === "COLUMN" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProductType("COLUMN")}
          >
            专栏
          </button>
        </div>
        <div>
          <input
            className="field"
            value={title}
            maxLength={PRODUCT_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={productType === "COLUMN" ? "专栏标题" : "课程标题"}
            required
          />
          <div className="mt-1 text-right text-xs text-[var(--muted)]">
            {title.length}/{PRODUCT_TITLE_MAX}
          </div>
        </div>
        <input
          className="field"
          value={subtitle}
          maxLength={200}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="一句话卖点（可选）"
        />
        <textarea
          className="field min-h-32"
          value={description}
          maxLength={5000}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="产品介绍：适合谁、能解决什么、包含哪些内容"
          required
        />
        <input
          className="field"
          type="number"
          min="0"
          step="1"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="售价（元）"
          required
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={groupByCategory}
            onChange={(e) => setGroupByCategory(e.target.checked)}
          />
          按素材分类自动分章（适合专栏）
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
          />
          创建后立即上架售卖
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          className="btn btn-accent w-full"
          disabled={loading || selected.length === 0}
          type="submit"
        >
          {loading
            ? "创建中..."
            : `生成可售${productType === "COLUMN" ? "专栏" : "课程"}（${selected.length} 个素材）`}
        </button>
      </div>
    </form>
  );
}

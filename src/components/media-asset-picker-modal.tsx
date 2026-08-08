"use client";

import { useEffect, useMemo, useState } from "react";
import { MEDIA_KIND_LABEL, isMediaKind, type MediaKind } from "@/lib/media";

export type PickerMediaAsset = {
  id: string;
  name: string;
  fileUrl: string;
  durationSec: number;
  type?: string;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  fileName?: string;
  description?: string;
};

type Category = {
  id: string;
  name: string;
  _count?: { assets: number };
};

type Props = {
  open: boolean;
  selectedId?: string | null;
  initialAssets?: PickerMediaAsset[];
  onClose: () => void;
  onSelect: (asset: PickerMediaAsset) => void;
  onClear?: () => void;
  /** 仅展示某类素材；封面选图时传 IMAGE */
  mediaKind?: MediaKind | "all";
  title?: string;
  description?: string;
};

function formatDuration(sec: number) {
  if (!sec || sec < 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MediaAssetPickerModal({
  open,
  selectedId,
  initialAssets = [],
  onClose,
  onSelect,
  onClear,
  mediaKind = "all",
  title = "从素材中心选择",
  description = "选择视频素材绑定到当前课时，可随时重新选择",
}: Props) {
  const [assets, setAssets] = useState<PickerMediaAsset[]>(initialAssets);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError("");
    setLoading(true);
    setActiveCategory("all");
    setQuery("");
    if (initialAssets.length > 0) setAssets(initialAssets);

    const mediaQuery =
      mediaKind && mediaKind !== "all"
        ? `?type=${encodeURIComponent(mediaKind)}`
        : "";
    Promise.all([
      fetch(`/api/studio/media${mediaQuery}`).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "加载素材失败");
        return (data.assets || []) as PickerMediaAsset[];
      }),
      fetch("/api/studio/media-categories").then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "加载分类失败");
        return (data.categories || []) as Category[];
      }),
    ])
      .then(([nextAssets, nextCategories]) => {
        if (cancelled) return;
        setAssets(nextAssets);
        setCategories(nextCategories);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message || "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Only refetch when the modal opens; initialAssets is a seed for first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open-gated load
  }, [open, mediaKind]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((asset) => {
      const byCategory =
        activeCategory === "all"
          ? true
          : activeCategory === "uncategorized"
            ? !asset.categoryId
            : asset.categoryId === activeCategory;
      const byQuery =
        !q ||
        asset.name.toLowerCase().includes(q) ||
        (asset.description || "").toLowerCase().includes(q) ||
        (asset.fileName || "").toLowerCase().includes(q);
      return byCategory && byQuery;
    });
  }, [assets, activeCategory, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-picker-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--bg)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2 id="media-picker-title" className="text-lg font-semibold">
              {title}
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">{description}</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-[var(--line)] px-3 py-1 text-sm"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="space-y-3 border-b border-[var(--line)] px-5 py-3">
          <input
            className="field w-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索名称 / 备注 / 文件名"
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm ${
                activeCategory === "all"
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--line)]"
              }`}
              onClick={() => setActiveCategory("all")}
            >
              全部 ({assets.length})
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm ${
                activeCategory === "uncategorized"
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--line)]"
              }`}
              onClick={() => setActiveCategory("uncategorized")}
            >
              未分类
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`rounded-full px-3 py-1.5 text-sm ${
                  activeCategory === c.id
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--line)]"
                }`}
                onClick={() => setActiveCategory(c.id)}
              >
                {c.name}
                {typeof c._count?.assets === "number"
                  ? ` (${c._count.assets})`
                  : ""}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-[var(--muted)]">
              加载素材中…
            </p>
          ) : error ? (
            <p className="py-6 text-center text-sm text-red-700">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--muted)]">
              暂无匹配素材，请先去素材中心上传
            </p>
          ) : (
            filtered.map((asset) => {
              const active = asset.id === selectedId;
              const duration = formatDuration(asset.durationSec || 0);
              const mediaKind: MediaKind = isMediaKind(asset.type || "")
                ? (asset.type as MediaKind)
                : "OTHER";
              return (
                <button
                  key={asset.id}
                  type="button"
                  className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                      : "border-[var(--line)] bg-white/70 hover:border-[var(--brand)]"
                  }`}
                  onClick={() => onSelect(asset)}
                >
                  {asset.type === "IMAGE" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.fileUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-xl object-cover"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="break-words font-medium leading-snug">
                        {asset.name}
                      </span>
                      <span className="rounded-full border border-[var(--line)] bg-white/80 px-2 py-0.5 text-[11px] text-[var(--muted)]">
                        {MEDIA_KIND_LABEL[mediaKind]}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-[var(--muted)]">
                      {asset.category?.name || "未分类"}
                      {duration ? ` · ${duration}` : ""}
                      {asset.fileName ? ` · ${asset.fileName}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-[var(--brand)]">
                    {active ? "已选" : "选择"}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] px-5 py-3">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!selectedId || !onClear}
            onClick={onClear}
          >
            清除绑定
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

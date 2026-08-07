"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StudioProductDeleteButton } from "@/components/studio-product-delete-button";
import {
  isMeetupProductType,
  meetupActivityEditPath,
  productDetailPath,
  productTypeLabel,
  type ProductType,
} from "@/lib/product-types";
import { formatPrice } from "@/lib/utils";

export type AdminProductRow = {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  coverUrl: string;
  price: number;
  status: string;
  productType: string;
  sortOrder: number;
  isPinned: boolean;
  isFeatured: boolean;
  teacherName: string;
  categoryName: string;
  enrollmentCount: number;
  orderCount: number;
  updatedAt: string;
};

const FILTERS: { key: "all" | ProductType; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "COURSE", label: "单课" },
  { key: "COLUMN", label: "专栏" },
  { key: "MATERIAL", label: "资料" },
  { key: "PRODUCT", label: "商城" },
];

const DND_MIME = "application/x-yyds-product-index";

type Props = {
  initialProducts: AdminProductRow[];
};

/**
 * 站长产品管理面板：拖拽调序、置顶/精华开关、上下架；编辑链到已有课程编辑页。
 * 触控可用：手柄区域足够大；微信内同样可点开关与保存。
 */
export function AdminProductsPanel({ initialProducts }: Props) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [filter, setFilter] = useState<"all" | ProductType>("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dirtyOrder, setDirtyOrder] = useState(false);

  const visible = useMemo(() => {
    if (filter === "all") return products;
    return products.filter((p) => p.productType === filter);
  }, [products, filter]);

  function moveItem(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    // 拖拽只在当前筛选列表内换位，再按全量列表写回 sortOrder
    const visibleIds = new Set(visible.map((p) => p.id));
    const fromId = visible[from]?.id;
    const toId = visible[to]?.id;
    if (!fromId || !toId) return;

    const nextVisible = visible.slice();
    const [item] = nextVisible.splice(from, 1);
    nextVisible.splice(to, 0, item);

    const nextAll: AdminProductRow[] = [];
    let vi = 0;
    for (const p of products) {
      if (visibleIds.has(p.id)) {
        nextAll.push(nextVisible[vi]!);
        vi += 1;
      } else {
        nextAll.push(p);
      }
    }
    setProducts(nextAll);
    setDirtyOrder(true);
    setMessage("次序已调整，请点「保存次序」生效到前台。");
  }

  async function saveOrder() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/studio/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: products.map((p) => p.id) }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage(data.error || "保存次序失败");
        return;
      }
      setDirtyOrder(false);
      setMessage("展示次序已保存，前台将按置顶优先 + 此次序展示。");
      router.refresh();
    } catch {
      setMessage("网络异常，保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function patchItem(
    id: string,
    patch: Partial<
      Pick<AdminProductRow, "isPinned" | "isFeatured" | "status">
    >,
  ) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const prev = products;
    setProducts((list) =>
      list.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
    try {
      const res = await fetch("/api/studio/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ id, ...patch }] }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setProducts(prev);
        setMessage(data.error || "更新失败");
        return;
      }
      setMessage("已更新");
      router.refresh();
    } catch {
      setProducts(prev);
      setMessage("网络异常，更新失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" aria-label="按产品类型筛选">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`min-h-10 rounded-full px-3 py-2 text-sm ${
                filter === f.key
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--line)] bg-white/70 text-[var(--muted)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/studio/courses/compose"
            className="btn btn-primary inline-flex min-h-11 items-center justify-center px-4 text-sm"
          >
            新增产品
          </Link>
          <button
            type="button"
            disabled={busy || !dirtyOrder}
            onClick={() => void saveOrder()}
            className="btn inline-flex min-h-11 items-center justify-center border border-[var(--line)] bg-white px-4 text-sm disabled:opacity-50"
          >
            {busy ? "保存中…" : "保存次序"}
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--muted)]">
        拖拽左侧手柄调整展示次序（置顶产品仍会排在非置顶之前）。精华仅作前台角标。
        有报名/订单时建议「下架」保留履约数据；硬删除会移除订单与报名且不可恢复。
      </p>

      {message ? (
        <p className="rounded-2xl border border-[var(--line)] bg-white/70 px-3 py-2 text-sm text-[var(--ink)]">
          {message}
        </p>
      ) : null}

      <div className="space-y-3">
        {visible.map((product, index) => (
          <div
            key={product.id}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverIndex(index);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverIndex((cur) => (cur === index ? null : cur));
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverIndex(null);
              const from = Number.parseInt(e.dataTransfer.getData(DND_MIME), 10);
              if (Number.isFinite(from)) moveItem(from, index);
            }}
            className={`rounded-[22px] border bg-white/70 p-3 sm:p-4 ${
              dragOverIndex === index
                ? "border-[var(--brand)] ring-1 ring-[var(--brand)]"
                : "border-[var(--line)]"
            }`}
          >
            <div className="flex gap-3">
              <button
                type="button"
                draggable
                className="flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-xl border border-[var(--line)] bg-white text-[var(--muted)] active:cursor-grabbing"
                aria-label={`拖拽调整「${product.title}」顺序`}
                title="按住拖动调整顺序"
                onDragStart={(e) => {
                  e.dataTransfer.setData(DND_MIME, String(index));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setDragOverIndex(null)}
              >
                <span aria-hidden className="select-none text-base leading-none">
                  ⋮⋮
                </span>
              </button>

              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs text-[var(--brand)]">
                        {productTypeLabel(product.productType)}
                      </span>
                      {product.isPinned ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          置顶
                        </span>
                      ) : null}
                      {product.isFeatured ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">
                          精华
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          product.status === "PUBLISHED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {product.status === "PUBLISHED" ? "已上架" : "已下架"}
                      </span>
                    </div>
                    <div className="mt-1 truncate font-medium">{product.title}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {formatPrice(product.price)} · {product.teacherName}
                      {product.categoryName ? ` · ${product.categoryName}` : ""}{" "}
                      · 报名 {product.enrollmentCount} · 订单 {product.orderCount}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={product.isPinned}
                      disabled={busy}
                      onChange={(e) =>
                        void patchItem(product.id, { isPinned: e.target.checked })
                      }
                    />
                    置顶
                  </label>
                  <label className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={product.isFeatured}
                      disabled={busy}
                      onChange={(e) =>
                        void patchItem(product.id, {
                          isFeatured: e.target.checked,
                        })
                      }
                    />
                    精华
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void patchItem(product.id, {
                        status:
                          product.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                      })
                    }
                    className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white px-3 text-sm disabled:opacity-50"
                  >
                    {product.status === "PUBLISHED" ? "下架" : "上架"}
                  </button>
                  <Link
                    href={
                      isMeetupProductType(product.productType)
                        ? meetupActivityEditPath(product.slug)
                        : product.productType === "PRODUCT"
                          ? "/studio/shop"
                          : `/studio/courses/${product.id}/edit`
                    }
                    className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white px-3 text-sm font-medium text-[var(--brand)]"
                  >
                    {isMeetupProductType(product.productType)
                      ? "编辑活动"
                      : "编辑"}
                  </Link>
                  <Link
                    href={productDetailPath(product.slug, product.productType)}
                    className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white px-3 text-sm text-[var(--muted)]"
                  >
                    前台
                  </Link>
                  <StudioProductDeleteButton
                    productId={product.id}
                    title={product.title}
                    productType={product.productType}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--muted)]">
            暂无产品。可先{" "}
            <Link href="/studio/courses/compose" className="text-[var(--brand)]">
              新增产品
            </Link>
            。
          </p>
        ) : null}
      </div>
    </div>
  );
}

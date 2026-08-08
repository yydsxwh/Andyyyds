"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ImageGalleryField,
  ImageUrlField,
} from "@/components/image-url-field";
import type { ShopSpecsConfig } from "@/lib/shop";
import { formatPrice } from "@/lib/utils";

export type StudioShopProduct = {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  coverUrl: string;
  gallery: string[];
  specs: ShopSpecsConfig;
  price: number;
  originalPrice: number;
  status: string;
  studentCount: number;
  categoryId: string | null;
  categoryName: string;
  orderCount: number;
  updatedAt: string;
};

type CategoryOption = { id: string; name: string };

type Props = {
  initialProducts: StudioShopProduct[];
  categories: CategoryOption[];
};

function centsToYuanInput(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

const emptyForm = {
  title: "",
  subtitle: "",
  description: "",
  price: "9.9",
  originalPrice: "",
  coverUrl: "",
  galleryText: "",
  specsText: "",
  categoryId: "",
  publish: true,
};

/**
 * 站长商城商品管理：创建/编辑/上下架。
 * 规格用「规格名:值1,值2」多行文本，降低上手成本。
 */
export function StudioShopPanel({ initialProducts, categories }: Props) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  const sorted = useMemo(
    () =>
      [...products].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [products],
  );

  function parseSpecsText(text: string): ShopSpecsConfig {
    const options = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [namePart, valuesPart] = line.split(":");
        const name = (namePart || "").trim();
        const values = (valuesPart || "")
          .split(/[,，]/)
          .map((v) => v.trim())
          .filter(Boolean);
        return { name, values };
      })
      .filter((o) => o.name && o.values.length > 0);
    return { options };
  }

  function specsToText(specs: ShopSpecsConfig) {
    return (specs.options || [])
      .map((o) => `${o.name}:${o.values.join(",")}`)
      .join("\n");
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage("");
  }

  function startEdit(p: StudioShopProduct) {
    setEditingId(p.id);
    setForm({
      title: p.title,
      subtitle: p.subtitle,
      description: p.description,
      price: centsToYuanInput(p.price),
      originalPrice:
        p.originalPrice > p.price ? centsToYuanInput(p.originalPrice) : "",
      coverUrl: p.coverUrl,
      galleryText: (p.gallery || []).join("\n"),
      specsText: specsToText(p.specs),
      categoryId: p.categoryId || "",
      publish: p.status === "PUBLISHED",
    });
    setShowForm(true);
    setMessage("");
  }

  async function save() {
    if (!form.title.trim()) {
      setMessage("请填写标题");
      return;
    }
    setBusy(true);
    setMessage("");
    const gallery = form.galleryText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      description: form.description.trim() || "商城商品",
      price: form.price,
      originalPrice: form.originalPrice || undefined,
      coverUrl: form.coverUrl.trim() || gallery[0] || undefined,
      gallery,
      specs: parseSpecsText(form.specsText),
      categoryId: form.categoryId || null,
      publish: form.publish,
      status: form.publish ? ("PUBLISHED" as const) : ("DRAFT" as const),
    };

    try {
      const res = await fetch("/api/studio/shop-products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId ? { id: editingId, ...payload } : payload,
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "保存失败");
        return;
      }
      setMessage(editingId ? "已更新" : "已创建");
      setShowForm(false);
      router.refresh();
      // 重新拉列表
      const listRes = await fetch("/api/studio/shop-products");
      if (listRes.ok) {
        const listData = await listRes.json();
        setProducts(listData.products || []);
      }
    } catch {
      setMessage("网络异常");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(p: StudioShopProduct) {
    setBusy(true);
    try {
      const next = p.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
      const res = await fetch("/api/studio/shop-products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, status: next }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || "操作失败");
        return;
      }
      setProducts((prev) =>
        prev.map((row) =>
          row.id === p.id ? { ...row, status: next } : row,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: StudioShopProduct) {
    if (!confirm(`确定删除「${p.title}」？`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/studio/shop-products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || "删除失败");
        return;
      }
      setProducts((prev) => prev.filter((row) => row.id !== p.id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">
          商城商品走独立上架；下单采集字段在「内容管理 → 下单信息采集」配置必填/选填。
        </p>
        <button
          type="button"
          className="btn btn-primary min-h-11"
          onClick={startCreate}
        >
          新建商品
        </button>
      </div>

      {message ? (
        <p className="text-sm text-[var(--brand)]">{message}</p>
      ) : null}

      {showForm ? (
        <div className="surface space-y-4 rounded-[28px] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">
            {editingId ? "编辑商品" : "新建商品"}
          </h2>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">标题</span>
            <input
              className="field mt-1 w-full"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">副标题</span>
            <input
              className="field mt-1 w-full"
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">详情描述</span>
            <textarea
              className="field mt-1 w-full"
              rows={5}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[var(--muted)]">售价（元）</span>
              <input
                className="field mt-1 w-full"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">划线价（元，选填）</span>
              <input
                className="field mt-1 w-full"
                value={form.originalPrice}
                onChange={(e) =>
                  setForm({ ...form, originalPrice: e.target.value })
                }
              />
            </label>
          </div>
          <ImageUrlField
            label="封面图"
            value={form.coverUrl}
            onChange={(coverUrl) => setForm({ ...form, coverUrl })}
            showPresets
            hint="可上传；不填时可用图集首图。"
          />
          <ImageGalleryField
            label="商品图集"
            valueText={form.galleryText}
            onChangeText={(galleryText) => setForm({ ...form, galleryText })}
          />
          <label className="block text-sm">
            <span className="text-[var(--muted)]">
              规格（每行：规格名:值1,值2）
            </span>
            <textarea
              className="field mt-1 w-full"
              rows={3}
              placeholder={"颜色:红,蓝\n尺码:S,M,L"}
              value={form.specsText}
              onChange={(e) => setForm({ ...form, specsText: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">分类</span>
            <select
              className="field mt-1 w-full"
              value={form.categoryId}
              onChange={(e) =>
                setForm({ ...form, categoryId: e.target.value })
              }
            >
              <option value="">未分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.publish}
              onChange={(e) => setForm({ ...form, publish: e.target.checked })}
            />
            立即上架
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary min-h-11"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? "保存中…" : "保存"}
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11"
              onClick={() => setShowForm(false)}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {sorted.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-12 text-center text-sm text-[var(--muted)]">
            还没有商城商品，点击「新建商品」开始上架。
          </p>
        ) : (
          sorted.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-3 rounded-[24px] border border-[var(--line)] bg-[var(--card)] p-4 sm:flex-row sm:items-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.coverUrl}
                alt=""
                className="h-20 w-20 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.title}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  {formatPrice(p.price)} · 已售 {p.studentCount} · 订单{" "}
                  {p.orderCount} ·{" "}
                  {p.status === "PUBLISHED" ? "已上架" : "草稿"}
                  {p.categoryName ? ` · ${p.categoryName}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/shop/${p.slug}`}
                  className="rounded-full border border-[var(--line)] px-3 py-2 text-xs"
                  target="_blank"
                >
                  前台
                </Link>
                <button
                  type="button"
                  className="rounded-full border border-[var(--line)] px-3 py-2 text-xs"
                  disabled={busy}
                  onClick={() => startEdit(p)}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="rounded-full border border-[var(--line)] px-3 py-2 text-xs"
                  disabled={busy}
                  onClick={() => void toggleStatus(p)}
                >
                  {p.status === "PUBLISHED" ? "下架" : "上架"}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-red-200 px-3 py-2 text-xs text-red-700"
                  disabled={busy}
                  onClick={() => void remove(p)}
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

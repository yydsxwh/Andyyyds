"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  activeOrderFormFields,
  validateOrderFormAnswers,
  type OrderFormAnswers,
  type OrderFormConfig,
} from "@/lib/order-form";
import { formatPrice } from "@/lib/utils";
import { OrderFormFields } from "@/components/order-form-fields";

type CartItem = {
  id: string;
  courseId: string;
  quantity: number;
  specLabel: string;
  selected: boolean;
  title: string;
  slug: string;
  coverUrl: string;
  price: number;
  originalPrice: number;
  status: string;
  isFree: boolean;
  available: boolean;
};

type Props = {
  orderForm: OrderFormConfig;
  loggedIn: boolean;
};

export function ShopCartClient({ orderForm, loggedIn }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [formAnswers, setFormAnswers] = useState<OrderFormAnswers>({});

  const fields = activeOrderFormFields(orderForm);

  async function load() {
    if (!loggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/cart");
      if (res.status === 401) {
        setItems([]);
        return;
      }
      const data = await res.json();
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [loggedIn]);

  const selected = useMemo(
    () => items.filter((i) => i.selected && i.available),
    [items],
  );
  const selectedTotal = selected.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0,
  );
  const allSelected =
    items.filter((i) => i.available).length > 0 &&
    items.filter((i) => i.available).every((i) => i.selected);

  async function patchItem(id: string, patch: Partial<{ quantity: number; selected: boolean }>) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "更新失败");
        return;
      }
      setItems(data.items || []);
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok) setItems(data.items || []);
    } finally {
      setBusy(false);
    }
  }

  async function toggleAll(next: boolean) {
    setBusy(true);
    try {
      for (const item of items.filter((i) => i.available)) {
        await fetch("/api/cart", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, selected: next }),
        });
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function settle() {
    if (selected.length === 0) {
      setMessage("请先勾选商品");
      return;
    }
    if (fields.length > 0) {
      const check = validateOrderFormAnswers(orderForm, formAnswers);
      if (!check.ok) {
        setMessage(check.error);
        return;
      }
    }
    setBusy(true);
    setMessage("");
    try {
      // 现有订单模型 1 单一商品：逐件下单；第一笔进支付页，其余留待支付列表
      let firstOrderId = "";
      const createdIds: string[] = [];
      for (const item of selected) {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId: item.courseId,
            quantity: item.quantity,
            specLabel: item.specLabel,
            formAnswers,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage(data.error || `「${item.title}」下单失败`);
          setBusy(false);
          return;
        }
        if (data.orderId) {
          createdIds.push(data.orderId);
          if (!firstOrderId) firstOrderId = data.orderId;
        }
      }
      // 结算成功后移除已勾选项
      await fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected.map((i) => i.id) }),
      });

      if (firstOrderId) {
        router.push(`/checkout/${firstOrderId}`);
        return;
      }
      router.push("/orders");
    } catch {
      setMessage("结算失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  if (!loggedIn) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-16 text-center">
        <p className="text-[var(--muted)]">登录后同步购物车</p>
        <Link href="/login?next=/cart" className="btn btn-primary mt-4 inline-flex min-h-11">
          去登录
        </Link>
      </div>
    );
  }

  if (loading) {
    return <p className="py-16 text-center text-[var(--muted)]">加载中…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-16 text-center">
        <p className="text-[var(--muted)]">购物车是空的</p>
        <Link href="/shop" className="btn btn-primary mt-4 inline-flex min-h-11">
          去逛逛
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--card)] p-3"
          >
            <label className="flex items-center">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={item.selected}
                disabled={!item.available || busy}
                onChange={(e) =>
                  void patchItem(item.id, { selected: e.target.checked })
                }
              />
            </label>
            <Link href={`/shop/${item.slug}`} className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.coverUrl}
                alt=""
                className="h-20 w-20 rounded-lg object-cover"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={`/shop/${item.slug}`}
                className="line-clamp-2 text-sm font-medium"
              >
                {item.title}
              </Link>
              {item.specLabel ? (
                <p className="mt-1 text-xs text-[var(--muted)]">{item.specLabel}</p>
              ) : null}
              {!item.available ? (
                <p className="mt-1 text-xs text-red-600">商品已下架</p>
              ) : null}
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="font-semibold text-[var(--fire)]">
                  {item.isFree ? "免费" : formatPrice(item.price)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded border border-[var(--line)]"
                    disabled={busy || item.quantity <= 1}
                    onClick={() =>
                      void patchItem(item.id, {
                        quantity: Math.max(1, item.quantity - 1),
                      })
                    }
                  >
                    −
                  </button>
                  <span className="w-7 text-center text-sm">{item.quantity}</span>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded border border-[var(--line)]"
                    disabled={busy}
                    onClick={() =>
                      void patchItem(item.id, {
                        quantity: Math.min(99, item.quantity + 1),
                      })
                    }
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="ml-1 min-h-9 px-2 text-xs text-red-600"
                    disabled={busy}
                    onClick={() => void removeItem(item.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {message ? (
        <p className="mt-3 text-sm text-red-600">{message}</p>
      ) : null}

      {checkoutOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
          <button
            type="button"
            className="flex-1"
            aria-label="关闭"
            onClick={() => setCheckoutOpen(false)}
          />
          <div className="mx-auto w-full max-w-lg rounded-t-2xl bg-[var(--card)] p-4 pb-8">
            <h2 className="text-lg font-semibold">确认结算</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              已选 {selected.length} 件，合计{" "}
              <span className="font-semibold text-[var(--fire)]">
                {formatPrice(selectedTotal)}
              </span>
            </p>
            {fields.length > 0 ? (
              <div className="mt-4">
                <OrderFormFields
                  config={orderForm}
                  values={formAnswers}
                  onChange={setFormAnswers}
                  disabled={busy}
                />
              </div>
            ) : null}
            {message ? (
              <p className="mt-3 text-sm text-red-600">{message}</p>
            ) : null}
            <button
              type="button"
              className="btn btn-primary mt-4 min-h-12 w-full !bg-[var(--fire)]"
              disabled={busy}
              onClick={() => void settle()}
            >
              {busy ? "提交中…" : "提交订单"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-12 z-30 border-t border-[var(--line)] bg-[var(--card)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-3 py-2">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={allSelected}
              disabled={busy}
              onChange={(e) => void toggleAll(e.target.checked)}
            />
            全选
          </label>
          <div className="min-w-0 flex-1 text-right text-sm">
            合计{" "}
            <span className="text-lg font-semibold text-[var(--fire)]">
              {formatPrice(selectedTotal)}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-primary min-h-11 px-5 !bg-[var(--fire)]"
            disabled={busy || selected.length === 0}
            onClick={() => {
              setMessage("");
              setCheckoutOpen(true);
            }}
          >
            结算({selected.length})
          </button>
        </div>
      </div>
    </div>
  );
}

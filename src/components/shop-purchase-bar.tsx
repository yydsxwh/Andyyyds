"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  activeOrderFormFields,
  validateOrderFormAnswers,
  type OrderFormAnswers,
  type OrderFormConfig,
} from "@/lib/order-form";
import type { ShopSpecsConfig } from "@/lib/shop";
import { formatPrice } from "@/lib/utils";
import { OrderFormFields } from "@/components/order-form-fields";

type Props = {
  courseId: string;
  slug: string;
  price: number;
  isFree: boolean;
  specs: ShopSpecsConfig;
  orderForm: OrderFormConfig;
  /** 营销面隐藏售价（结账页仍显示应付） */
  hidePriceDisplay?: boolean;
};

/**
 * 详情底栏：选规格 → 加入购物车 / 立即购买。
 * 立即购买会先校验下单采集必填项，再创建订单跳转支付。
 */
export function ShopPurchaseBar({
  courseId,
  slug,
  price,
  isFree,
  specs,
  orderForm,
  hidePriceDisplay = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<"cart" | "buy" | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [specSelected, setSpecSelected] = useState<Record<string, string>>({});
  const [formAnswers, setFormAnswers] = useState<OrderFormAnswers>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const fields = activeOrderFormFields(orderForm);
  const lineTotal = price * quantity;

  const canSubmitSpecs = useMemo(() => {
    return specs.options.every((opt) => Boolean(specSelected[opt.name]));
  }, [specs.options, specSelected]);

  function openSheet(mode: "cart" | "buy") {
    setMessage("");
    setOpen(mode);
  }

  async function addToCart() {
    if (!canSubmitSpecs) {
      setMessage("请先选择规格");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          quantity,
          specSelected,
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        router.push(`/login?next=/shop/${encodeURIComponent(slug)}`);
        return;
      }
      if (!res.ok) {
        setMessage(data.error || "加购失败");
        return;
      }
      setOpen(null);
      setMessage("已加入购物车");
    } catch {
      setMessage("网络异常");
    } finally {
      setLoading(false);
    }
  }

  async function buyNow() {
    if (!canSubmitSpecs) {
      setMessage("请先选择规格");
      return;
    }
    if (fields.length > 0) {
      const check = validateOrderFormAnswers(orderForm, formAnswers);
      if (!check.ok) {
        setMessage(check.error);
        return;
      }
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          quantity,
          specSelected,
          formAnswers,
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        router.push(`/login?next=/shop/${encodeURIComponent(slug)}`);
        return;
      }
      if (!res.ok) {
        setMessage(data.error || "下单失败");
        return;
      }
      // 免费 / 优惠券抵扣至 0 元：已开通，无需进支付页
      if (data.enrolled || data.zeroPay) {
        router.push(`/orders`);
        router.refresh();
        return;
      }
      if (data.orderId) {
        router.push(`/checkout/${data.orderId}`);
        return;
      }
      router.push(`/orders`);
    } catch {
      setMessage("网络异常");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {message && !open ? (
        <div className="fixed inset-x-0 bottom-14 z-30 mx-auto max-w-lg px-4">
          <p className="rounded-xl bg-[var(--ink)]/90 px-3 py-2 text-center text-sm text-white">
            {message}
          </p>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-12 z-30 border-t border-[var(--line)] bg-[var(--card)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-3 py-2">
          <Link
            href="/cart"
            className="flex min-h-11 min-w-11 flex-col items-center justify-center text-[10px] text-[var(--muted)]"
          >
            购物车
          </Link>
          <button
            type="button"
            className="btn min-h-11 flex-1 border border-[var(--fire)] bg-[var(--fire)]/10 text-[var(--fire)]"
            onClick={() => openSheet("cart")}
          >
            加入购物车
          </button>
          <button
            type="button"
            className="btn btn-primary min-h-11 flex-1 !bg-[var(--fire)]"
            onClick={() => openSheet("buy")}
          >
            {isFree ? "免费领取" : "立即购买"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
          <button
            type="button"
            className="flex-1"
            aria-label="关闭"
            onClick={() => setOpen(null)}
          />
          <div className="mx-auto w-full max-w-lg rounded-t-2xl bg-[var(--card)] p-4 pb-8 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                {hidePriceDisplay ? (
                  <div className="text-lg font-semibold text-[var(--ink)]">
                    {open === "cart" ? "加入购物车" : "确认购买"}
                  </div>
                ) : (
                  <>
                    <div className="text-lg font-semibold text-[var(--fire)]">
                      {isFree ? "免费" : formatPrice(lineTotal)}
                    </div>
                    {!isFree && quantity > 1 ? (
                      <div className="text-xs text-[var(--muted)]">
                        单价 {formatPrice(price)} × {quantity}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
              <button
                type="button"
                className="min-h-11 px-3 text-sm text-[var(--muted)]"
                onClick={() => setOpen(null)}
              >
                关闭
              </button>
            </div>

            {specs.options.length > 0 ? (
              <div className="space-y-3">
                {specs.options.map((opt) => (
                  <div key={opt.name}>
                    <div className="mb-2 text-sm font-medium">{opt.name}</div>
                    <div className="flex flex-wrap gap-2">
                      {opt.values.map((v) => {
                        const active = specSelected[opt.name] === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            className={`min-h-10 rounded-lg border px-3 text-sm ${
                              active
                                ? "border-[var(--fire)] bg-[var(--fire)]/10 text-[var(--fire)]"
                                : "border-[var(--line)]"
                            }`}
                            onClick={() =>
                              setSpecSelected((prev) => ({
                                ...prev,
                                [opt.name]: v,
                              }))
                            }
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm">数量</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--line)] text-lg"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <span className="w-8 text-center text-sm">{quantity}</span>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--line)] text-lg"
                  onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                >
                  +
                </button>
              </div>
            </div>

            {open === "buy" && fields.length > 0 ? (
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <OrderFormFields
                  config={orderForm}
                  values={formAnswers}
                  onChange={setFormAnswers}
                  disabled={loading}
                />
              </div>
            ) : null}

            {message ? (
              <p className="mt-3 text-sm text-red-600">{message}</p>
            ) : null}

            <button
              type="button"
              className="btn btn-primary mt-4 min-h-12 w-full !bg-[var(--fire)]"
              disabled={loading}
              onClick={() => (open === "cart" ? addToCart() : buyNow())}
            >
              {loading
                ? "处理中…"
                : open === "cart"
                  ? "确定加入购物车"
                  : isFree
                    ? "确认领取"
                    : "确认购买"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

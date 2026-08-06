"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OrderFormFields } from "@/components/order-form-fields";
import {
  activeOrderFormFields,
  validateOrderFormAnswers,
  type OrderFormAnswers,
  type OrderFormConfig,
} from "@/lib/order-form";

type Props = {
  courseId: string;
  price: number;
  isFree: boolean;
  enrolled: boolean;
  slug: string;
  orderForm: OrderFormConfig;
};

export function PurchasePanel({
  courseId,
  price,
  isFree,
  enrolled,
  slug,
  orderForm,
}: Props) {
  const router = useRouter();
  const [couponCode, setCouponCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [formAnswers, setFormAnswers] = useState<OrderFormAnswers>({});
  const fields = activeOrderFormFields(orderForm);

  async function buy() {
    if (fields.length > 0) {
      const check = validateOrderFormAnswers(orderForm, formAnswers);
      if (!check.ok) {
        setMessage(check.error);
        return;
      }
    }

    setLoading(true);
    setMessage("");
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
        couponCode: couponCode || undefined,
        formAnswers: fields.length > 0 ? formAnswers : undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error || "下单失败");
      if (res.status === 401) router.push("/login");
      return;
    }

    if (data.enrolled) {
      router.push(`/learn/${slug}`);
      router.refresh();
      return;
    }

    router.push(`/checkout/${data.orderId}`);
  }

  if (enrolled) {
    return (
      <div className="surface rounded-[28px] p-6">
        <p className="text-sm text-[var(--muted)]">你已拥有本课程</p>
        <button
          className="btn btn-primary mt-4 w-full"
          onClick={() => router.push(`/learn/${slug}`)}
          type="button"
        >
          进入学习
        </button>
      </div>
    );
  }

  return (
    <div className="surface rounded-[28px] p-6">
      <div className="text-3xl font-semibold text-[var(--brand)]">
        {isFree || price <= 0
          ? "免费领取"
          : `¥${(price / 100).toFixed(price % 100 === 0 ? 0 : 2)}`}
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        支持微信支付购买；支付成功后立即开通学习。可使用优惠券。
      </p>
      {fields.length > 0 ? (
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <OrderFormFields
            config={orderForm}
            values={formAnswers}
            onChange={setFormAnswers}
            disabled={loading}
          />
        </div>
      ) : null}
      {!isFree && price > 0 ? (
        <input
          className="field mt-4"
          placeholder="优惠券码，如 YYDS20"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
        />
      ) : null}
      <button
        className="btn btn-accent mt-4 w-full"
        disabled={loading}
        onClick={buy}
        type="button"
      >
        {loading
          ? "处理中..."
          : isFree || price <= 0
            ? "免费加入"
            : "立即购买"}
      </button>
      {message ? <p className="mt-3 text-sm text-red-700">{message}</p> : null}
    </div>
  );
}

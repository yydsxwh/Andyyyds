"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  courseId: string;
  price: number;
  isFree: boolean;
  enrolled: boolean;
  slug: string;
};

export function PurchasePanel({ courseId, price, isFree, enrolled, slug }: Props) {
  const router = useRouter();
  const [couponCode, setCouponCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function buy() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, couponCode: couponCode || undefined }),
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
        {isFree || price <= 0 ? "免费领取" : `¥${(price / 100).toFixed(price % 100 === 0 ? 0 : 2)}`}
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        支持优惠券与邀请码分销结算（演示环境为模拟支付）
      </p>
      {!isFree && price > 0 ? (
        <input
          className="field mt-4"
          placeholder="优惠券码，如 YYDS20"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
        />
      ) : null}
      <button className="btn btn-accent mt-4 w-full" disabled={loading} onClick={buy} type="button">
        {loading ? "处理中..." : isFree || price <= 0 ? "免费加入" : "立即购买"}
      </button>
      {message ? <p className="mt-3 text-sm text-red-700">{message}</p> : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PayButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/orders/${orderId}/pay`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "支付失败");
      return;
    }
    router.push(`/learn/${data.slug}`);
    router.refresh();
  }

  return (
    <div>
      <button className="btn btn-accent w-full" disabled={loading} onClick={pay} type="button">
        {loading ? "支付中..." : "确认模拟支付"}
      </button>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

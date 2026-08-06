"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { formatPrice } from "@/lib/utils";

type Props = {
  orderId: string;
  amount: number;
  channels: {
    mode: string;
    wechat: boolean;
    alipay: boolean;
    mockOnly: boolean;
  };
  /** 发起支付前钩子（如下单信息采集未完成则返回 false） */
  beforePay?: () => Promise<boolean>;
};

export function CheckoutPay({ orderId, amount, channels, beforePay }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [statusText, setStatusText] = useState("请选择支付方式");
  const [active, setActive] = useState<"WECHAT" | "ALIPAY" | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const goLearn = useCallback(
    (slug: string) => {
      stopPolling();
      router.push(`/learn/${slug}`);
      router.refresh();
    },
    [router, stopPolling],
  );

  const pollStatus = useCallback(async () => {
    const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return;
    if (data.status === "PAID" && data.slug) {
      setStatusText("支付成功，正在进入课程…");
      goLearn(data.slug);
    }
  }, [goLearn, orderId]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollingRef.current = setInterval(() => {
      void pollStatus();
    }, 2000);
  }, [pollStatus, stopPolling]);

  async function startWechatPay() {
    setActive("WECHAT");
    setLoading(true);
    setError("");
    if (beforePay) {
      const ok = await beforePay();
      if (!ok) {
        setLoading(false);
        setError("请先完成上方必填信息");
        setStatusText("请先填写信息");
        return;
      }
    }
    setStatusText("正在生成微信支付二维码…");
    const res = await fetch(`/api/orders/${orderId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "WECHAT" }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "发起微信支付失败");
      setStatusText("发起失败");
      return;
    }
    if (data.mode === "paid" || data.status === "PAID" || data.mode === "mock") {
      goLearn(data.slug);
      return;
    }
    if (!data.codeUrl) {
      setError("未获取到支付二维码");
      return;
    }
    const url = await QRCode.toDataURL(data.codeUrl, {
      width: 240,
      margin: 2,
      color: { dark: "#1c2430", light: "#fffdf8" },
    });
    setQrDataUrl(url);
    setStatusText("请使用微信扫一扫完成支付");
    startPolling();
  }

  async function startAlipay() {
    setActive("ALIPAY");
    setLoading(true);
    setError("");
    if (beforePay) {
      const ok = await beforePay();
      if (!ok) {
        setLoading(false);
        setError("请先完成上方必填信息");
        setStatusText("请先填写信息");
        return;
      }
    }
    setStatusText("正在跳转支付宝…");
    const res = await fetch(`/api/orders/${orderId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "ALIPAY" }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "发起支付宝失败");
      setStatusText("发起失败");
      return;
    }
    if (data.payUrl) {
      startPolling();
      window.location.href = data.payUrl;
      return;
    }
    setError("未获取到支付宝支付链接");
  }

  async function mockPay() {
    setLoading(true);
    setError("");
    if (beforePay) {
      const ok = await beforePay();
      if (!ok) {
        setLoading(false);
        setError("请先完成上方必填信息");
        return;
      }
    }
    const res = await fetch(`/api/orders/${orderId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "MOCK" }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "支付失败");
      return;
    }
    goLearn(data.slug);
  }

  useEffect(() => {
    if (channels.mockOnly) return;
    if (channels.wechat && !channels.alipay) {
      void startWechatPay();
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (channels.mockOnly) {
    return (
      <div>
        <p className="mb-4 text-sm text-[var(--muted)]">
          当前为模拟支付。请在站长后台「系统设置」填写并启用微信/支付宝后，即可收款。
        </p>
        <button
          className="btn btn-accent w-full"
          disabled={loading}
          onClick={mockPay}
          type="button"
        >
          {loading ? "支付中..." : "确认模拟支付"}
        </button>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {channels.wechat ? (
          <button
            type="button"
            className={`btn ${active === "WECHAT" ? "btn-primary" : "btn-secondary"}`}
            disabled={loading}
            onClick={() => void startWechatPay()}
          >
            微信支付
          </button>
        ) : null}
        {channels.alipay ? (
          <button
            type="button"
            className={`btn ${active === "ALIPAY" ? "btn-primary" : "btn-secondary"}`}
            disabled={loading}
            onClick={() => void startAlipay()}
          >
            支付宝
          </button>
        ) : null}
      </div>

      {channels.wechat && active !== "ALIPAY" ? (
        <div className="rounded-[24px] border border-[var(--line)] bg-white/70 p-5 text-center">
          <div className="text-sm font-medium text-[var(--brand)]">微信支付</div>
          <div className="mt-1 text-2xl font-semibold">{formatPrice(amount)}</div>
          <p className="mt-2 text-sm text-[var(--muted)]">{statusText}</p>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="微信支付二维码"
              className="mx-auto mt-4 rounded-2xl border border-[var(--line)]"
              width={240}
              height={240}
            />
          ) : (
            <div className="mx-auto mt-4 flex h-[240px] w-[240px] items-center justify-center rounded-2xl border border-dashed border-[var(--line)] text-sm text-[var(--muted)]">
              {loading ? "生成中…" : "点击上方微信支付"}
            </div>
          )}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

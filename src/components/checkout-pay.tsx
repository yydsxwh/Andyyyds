"use client";

/**
 * 结账页支付面板（核心前端）
 *
 * 流程概览：
 * 1. 调 /api/orders/:id/pay
 * 2. 按返回 mode 分支：授权跳转 / JSAPI 调起 / H5 跳转 / 展示二维码 / 支付宝跳转
 * 3. 轮询订单状态，PAID 后进入学习页
 *
 * 改 UI 时尽量别打乱 mode 分支顺序；支付规则在服务端 pay route。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { formatPrice } from "@andyyyds/shared/utils";
import {
  isMobileBrowser,
  isWeChatBrowser,
  preferWechatTradeType,
  type WechatPayTradeType,
} from "@andyyyds/shared/wechat-env";

type JsapiPayParams = {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
};

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

declare global {
  interface Window {
    WeixinJSBridge?: {
      invoke: (
        api: string,
        params: Record<string, string>,
        cb: (res: { err_msg?: string }) => void,
      ) => void;
    };
  }
}

/** 调用微信内置 WeixinJSBridge 拉起收银台 */
function invokeWeixinPay(payParams: JsapiPayParams): Promise<"ok" | "cancel" | "fail"> {
  return new Promise((resolve) => {
    const run = () => {
      if (!window.WeixinJSBridge) {
        resolve("fail");
        return;
      }
      window.WeixinJSBridge.invoke(
        "getBrandWCPayRequest",
        {
          appId: payParams.appId,
          timeStamp: payParams.timeStamp,
          nonceStr: payParams.nonceStr,
          package: payParams.package,
          signType: payParams.signType,
          paySign: payParams.paySign,
        },
        (res) => {
          const msg = res.err_msg || "";
          if (msg === "get_brand_wcpay_request:ok") resolve("ok");
          else if (msg === "get_brand_wcpay_request:cancel") resolve("cancel");
          else resolve("fail");
        },
      );
    };
    if (typeof window !== "undefined" && window.WeixinJSBridge) {
      run();
    } else if (typeof document !== "undefined") {
      document.addEventListener("WeixinJSBridgeReady", run, false);
      setTimeout(() => {
        if (window.WeixinJSBridge) run();
      }, 800);
    } else {
      resolve("fail");
    }
  });
}

export function CheckoutPay({ orderId, amount, channels, beforePay }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [statusText, setStatusText] = useState("请选择支付方式");
  const [active, setActive] = useState<"WECHAT" | "ALIPAY" | null>(null);
  const [inWeChat, setInWeChat] = useState(false);
  const [onMobile, setOnMobile] = useState(false);
  const [tradeHint, setTradeHint] = useState("");
  const [showQrFallback, setShowQrFallback] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const goAfterPay = useCallback(
    (slug: string, productType?: string) => {
      stopPolling();
      // 约搭报名成功回活动详情；专栏回详情选子课；其余进学习页
      if (productType === "MEETUP") {
        router.push(`/meetup/${slug}`);
      } else if (productType === "COLUMN") {
        router.push(`/courses/${slug}`);
      } else if (productType === "PRODUCT") {
        router.push(`/orders`);
      } else {
        router.push(`/learn/${slug}`);
      }
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
      goAfterPay(data.slug, data.productType);
    }
  }, [goAfterPay, orderId]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollingRef.current = setInterval(() => {
      void pollStatus();
    }, 2000);
  }, [pollStatus, stopPolling]);

  async function showQr(codeUrl: string, hint?: string) {
    const url = await QRCode.toDataURL(codeUrl, {
      width: 240,
      margin: 2,
      color: { dark: "#1c2430", light: "#fffdf8" },
    });
    setQrDataUrl(url);
    setShowQrFallback(true);
    setTradeHint(
      hint ||
        (isWeChatBrowser()
          ? "请长按识别二维码完成支付"
          : "请使用微信扫一扫完成支付"),
    );
    setStatusText(
      isWeChatBrowser()
        ? "请长按下方二维码完成支付"
        : "请使用微信扫一扫完成支付",
    );
    startPolling();
  }

  /**
   * 发起微信支付。
   * forceNative=true 时强制扫码（用户点「改用扫码支付」）。
   */
  async function startWechatPay(options?: { forceNative?: boolean }) {
    setActive("WECHAT");
    setLoading(true);
    setError("");
    setTradeHint("");
    if (!options?.forceNative) {
      setQrDataUrl("");
    }
    if (beforePay) {
      const ok = await beforePay();
      if (!ok) {
        setLoading(false);
        setError("请先完成上方必填信息");
        setStatusText("请先填写信息");
        return;
      }
    }

    const mobile = isMobileBrowser();
    const wechat = isWeChatBrowser();
    const tradeType: WechatPayTradeType = options?.forceNative
      ? "native"
      : preferWechatTradeType();
    const allowNativeFallback = Boolean(options?.forceNative) || (!mobile && !wechat);

    setStatusText(
      tradeType === "jsapi"
        ? "正在调起微信支付…"
        : tradeType === "h5"
          ? "正在跳转微信支付…"
          : "正在生成微信支付二维码…",
    );

    const res = await fetch(`/api/orders/${orderId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "WECHAT",
        tradeType,
        allowNativeFallback,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok && !data.codeUrl) {
      setError(data.error || "发起微信支付失败");
      setStatusText("发起失败");
      if (data.needAppSecret) {
        setTradeHint(
          "站长需在「系统设置」填写公众号 AppSecret，并配置网页授权域名后，微信内即可直接支付。",
        );
      }
      return;
    }

    if (data.mode === "paid" || data.status === "PAID" || data.mode === "mock") {
      goAfterPay(data.slug, data.productType);
      return;
    }

    if (data.mode === "wechat_need_oauth" && data.oauthUrl) {
      setStatusText("正在授权微信账号以便直接支付…");
      window.location.href = data.oauthUrl as string;
      return;
    }

    if (data.mode === "wechat_jsapi" && data.payParams) {
      setStatusText("请在微信中完成支付");
      startPolling();
      const result = await invokeWeixinPay(data.payParams as JsapiPayParams);
      if (result === "ok") {
        setStatusText("支付成功，正在确认…");
        void pollStatus();
      } else if (result === "cancel") {
        setStatusText("已取消支付，可重新点击微信支付");
        setError("");
      } else {
        setError("调起微信支付失败，请重试或改用扫码支付");
        setStatusText("调起失败");
        setShowQrFallback(true);
      }
      return;
    }

    if (data.mode === "wechat_h5" && data.mwebUrl) {
      setStatusText("正在跳转微信支付…");
      startPolling();
      window.location.href = data.mwebUrl as string;
      return;
    }

    if (data.codeUrl) {
      await showQr(
        data.codeUrl as string,
        typeof data.hint === "string" ? data.hint : undefined,
      );
      if (data.error) setError(data.error as string);
      return;
    }

    setError(data.error || "未获取到支付信息");
    setStatusText("发起失败");
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
    goAfterPay(data.slug, data.productType);
  }

  useEffect(() => {
    const wechat = isWeChatBrowser();
    const mobile = isMobileBrowser();
    setInWeChat(wechat);
    setOnMobile(mobile);
    if (channels.mockOnly) return;

    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("wechat_oauth");
    if (oauth === "error") {
      setError(
        decodeURIComponent(params.get("msg") || "微信授权失败，请重试直接支付"),
      );
      setStatusText("授权失败");
      setShowQrFallback(true);
    } else if (oauth === "denied") {
      setError("未完成微信授权，无法直接支付。可重试或使用扫码支付。");
      setShowQrFallback(true);
    }

    if (!startedRef.current) {
      if (channels.wechat && !channels.alipay) {
        startedRef.current = true;
        void startWechatPay();
      } else if (channels.alipay && !channels.wechat) {
        startedRef.current = true;
        void startAlipay();
      }
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
          className="btn btn-accent w-full min-h-12"
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
            className={`btn min-h-11 flex-1 sm:flex-none ${active === "WECHAT" ? "btn-primary" : "btn-secondary"}`}
            disabled={loading}
            onClick={() => void startWechatPay()}
          >
            {inWeChat || onMobile ? "微信支付" : "微信支付"}
          </button>
        ) : null}
        {channels.alipay ? (
          <button
            type="button"
            className={`btn min-h-11 flex-1 sm:flex-none ${active === "ALIPAY" ? "btn-primary" : "btn-secondary"}`}
            disabled={loading}
            onClick={() => void startAlipay()}
          >
            支付宝
          </button>
        ) : null}
      </div>

      {channels.wechat && channels.alipay && !active ? (
        <p className="text-sm text-[var(--muted)]">请选择微信支付或支付宝完成付款</p>
      ) : null}

      {channels.alipay && active === "ALIPAY" ? (
        <div className="rounded-[24px] border border-[var(--line)] bg-white/70 p-4 text-center sm:p-5">
          <div className="text-sm font-medium text-[var(--brand)]">支付宝</div>
          <div className="mt-1 text-2xl font-semibold">{formatPrice(amount)}</div>
          <p className="mt-2 text-sm text-[var(--muted)]">{statusText}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            将跳转支付宝完成支付；支付完成后自动返回本站。
          </p>
        </div>
      ) : null}

      {channels.wechat && active !== "ALIPAY" ? (
        <div className="rounded-[24px] border border-[var(--line)] bg-white/70 p-4 text-center sm:p-5">
          <div className="text-sm font-medium text-[var(--brand)]">微信支付</div>
          <div className="mt-1 text-2xl font-semibold">{formatPrice(amount)}</div>
          <p className="mt-2 text-sm text-[var(--muted)]">{statusText}</p>
          {tradeHint ? (
            <p className="mt-1 text-xs text-[var(--muted)]">{tradeHint}</p>
          ) : null}
          {inWeChat || onMobile ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              {inWeChat
                ? "将直接调起微信支付，无需扫码。"
                : "将跳转微信完成支付，无需扫码。"}
            </p>
          ) : (
            <p className="mt-2 text-xs text-[var(--muted)]">
              电脑端请使用微信扫一扫下方二维码。
            </p>
          )}

          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="微信支付二维码"
              className="mx-auto mt-4 max-w-full rounded-2xl border border-[var(--line)]"
              width={240}
              height={240}
            />
          ) : !(inWeChat || onMobile) ? (
            <div className="mx-auto mt-4 flex h-[200px] w-full max-w-[240px] items-center justify-center rounded-2xl border border-dashed border-[var(--line)] text-sm text-[var(--muted)] sm:h-[240px]">
              {loading ? "处理中…" : "点击上方微信支付"}
            </div>
          ) : (
            <div className="mx-auto mt-4 flex min-h-[88px] w-full items-center justify-center rounded-2xl border border-dashed border-[var(--line)] px-3 text-sm text-[var(--muted)]">
              {loading ? "正在调起支付…" : "点击「微信支付」即可直接付款"}
            </div>
          )}

          {(inWeChat || onMobile) && showQrFallback ? (
            <button
              type="button"
              className="btn btn-secondary mt-4 w-full min-h-11 text-sm"
              disabled={loading}
              onClick={() => void startWechatPay({ forceNative: true })}
            >
              改用扫码支付
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

"use client";

/**
 * 识图页内嵌微信支付。不跳到 /checkout，避免内存里的上传队列被清掉。
 * 微信内优先 JSAPI；没有 openid 时不跳授权页，改扫码/长按，保证还留在本页。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { formatPrice } from "@andyyyds/shared/utils";
import {
  isMobileBrowser,
  isWeChatBrowser,
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

type Channels = {
  mode: string;
  wechat: boolean;
  alipay: boolean;
  mockOnly: boolean;
};

type Props = {
  orderId: string;
  amount: number;
  channels: Channels;
  onPaid: () => void;
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

export function MathcodeWechatPay({ orderId, amount, channels, onPaid }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [statusText, setStatusText] = useState("请使用微信支付");
  const [inWeChat, setInWeChat] = useState(false);
  const [onMobile, setOnMobile] = useState(false);
  const [tradeHint, setTradeHint] = useState("");
  const [showQrFallback, setShowQrFallback] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const finishPaid = useCallback(() => {
    stopPolling();
    setStatusText("支付成功");
    onPaidRef.current();
  }, [stopPolling]);

  const pollStatus = useCallback(async () => {
    const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return;
    if (data.status === "PAID") {
      finishPaid();
    }
  }, [finishPaid, orderId]);

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

  async function startWechatPay(options?: { forceNative?: boolean }) {
    setLoading(true);
    setError("");
    setTradeHint("");
    if (!options?.forceNative) setQrDataUrl("");

    const wechat = isWeChatBrowser();
    const tradeType: WechatPayTradeType = options?.forceNative
      ? "native"
      : wechat
        ? "jsapi"
        : "native";

    setStatusText(
      tradeType === "jsapi" ? "正在调起微信支付…" : "正在生成微信支付二维码…",
    );

    const res = await fetch(`/api/orders/${orderId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "WECHAT",
        tradeType,
        // 识图必须留在本页：授权/H5 失败时落到扫码
        allowNativeFallback: true,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.mode === "paid" || data.status === "PAID" || data.mode === "mock") {
      finishPaid();
      return;
    }

    // 没有 openid 时不要跳走授权，否则上传队列会丢
    if (data.mode === "wechat_need_oauth" && !options?.forceNative) {
      setTradeHint("当前微信未绑定，改用长按识别二维码，支付后仍留在本页。");
      await startWechatPay({ forceNative: true });
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
        setError("调起微信支付失败，请改用扫码支付");
        setStatusText("调起失败");
        setShowQrFallback(true);
      }
      return;
    }

    if (data.mode === "wechat_h5" && data.mwebUrl) {
      // 跳 H5 会离开本页；优先给扫码，并提示可另开微信
      setShowQrFallback(true);
      setStatusText("手机浏览器可跳转微信，也可改用扫码留在本页");
      setTradeHint("跳转支付后请回到本页；若页面被刷新，文件需要重新上传。");
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
    setLoading(true);
    setError("");
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
    finishPaid();
  }

  useEffect(() => {
    setInWeChat(isWeChatBrowser());
    setOnMobile(isMobileBrowser());
    if (!startedRef.current && (channels.wechat || channels.mockOnly)) {
      startedRef.current = true;
      if (channels.mockOnly) return;
      void startWechatPay();
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (channels.mockOnly) {
    return (
      <div>
        <p className="mb-4 text-sm text-[var(--muted)]">
          当前为模拟支付，确认后立即到账页数。
        </p>
        <button
          className="btn btn-accent w-full min-h-12"
          disabled={loading}
          onClick={() => void mockPay()}
          type="button"
        >
          {loading ? "支付中..." : `确认模拟支付 ${formatPrice(amount)}`}
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
            className="btn btn-primary min-h-11 flex-1"
            disabled={loading}
            onClick={() => void startWechatPay()}
          >
            微信支付
          </button>
        ) : null}
        {channels.alipay ? (
          <button
            type="button"
            className="btn btn-secondary min-h-11 flex-1"
            disabled={loading}
            onClick={() => void startAlipay()}
          >
            支付宝
          </button>
        ) : null}
      </div>

      <div className="rounded-[24px] border border-[var(--line)] bg-white/70 p-4 text-center sm:p-5">
        <div className="text-sm font-medium text-[var(--brand)]">应付</div>
        <div className="mt-1 text-2xl font-semibold">{formatPrice(amount)}</div>
        <p className="mt-2 text-sm text-[var(--muted)]">{statusText}</p>
        {tradeHint ? (
          <p className="mt-1 text-xs text-[var(--muted)]">{tradeHint}</p>
        ) : null}
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt="微信支付二维码"
            className="mx-auto mt-4 max-w-full rounded-2xl border border-[var(--line)]"
            width={240}
            height={240}
          />
        ) : (
          <div className="mx-auto mt-4 flex min-h-[88px] w-full items-center justify-center rounded-2xl border border-dashed border-[var(--line)] px-3 text-sm text-[var(--muted)]">
            {loading ? "正在调起支付…" : inWeChat || onMobile ? "点击微信支付即可付款" : "点击微信支付生成二维码"}
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
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

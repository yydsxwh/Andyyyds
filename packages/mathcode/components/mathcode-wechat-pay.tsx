"use client";

/**
 * 识图页内嵌微信支付。不跳到 /checkout，避免内存里的上传队列被清掉。
 * 微信内：没有 openid 就走网页授权（回本页 payOrder），有参数后必须等用户再点一次才调起。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { formatPrice } from "@andyyyds/shared/utils";
import {
  isMobileBrowser,
  isWeChatBrowser,
  preferWechatTradeType,
  type WechatPayTradeType,
} from "@andyyyds/shared/wechat-env";
import {
  invokeWeixinJsapiPay,
  type WechatJsapiBrowserParams,
} from "@andyyyds/shared/wechat-jsapi-client";

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

const PAY_RESUME_KEY = "yyds-mathcode-pay-resume";

export function rememberMathcodePayResume(orderId: string, amount: number) {
  try {
    sessionStorage.setItem(PAY_RESUME_KEY, JSON.stringify({ orderId, amount }));
  } catch {
    // 隐私模式写不了就只靠 URL 上的 payOrder
  }
}

export function readMathcodePayResume(): { orderId: string; amount: number } | null {
  try {
    const raw = sessionStorage.getItem(PAY_RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { orderId?: string; amount?: number };
    if (!parsed.orderId) return null;
    return { orderId: parsed.orderId, amount: Number(parsed.amount) || 0 };
  } catch {
    return null;
  }
}

export function clearMathcodePayResume() {
  try {
    sessionStorage.removeItem(PAY_RESUME_KEY);
  } catch {
    // ignore
  }
}

export function MathcodeWechatPay({ orderId, amount, channels, onPaid }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [statusText, setStatusText] = useState("请点击微信支付");
  const [inWeChat, setInWeChat] = useState(false);
  const [onMobile, setOnMobile] = useState(false);
  const [tradeHint, setTradeHint] = useState("");
  const [showQrFallback, setShowQrFallback] = useState(false);
  const [pendingJsapi, setPendingJsapi] = useState<WechatJsapiBrowserParams | null>(
    null,
  );
  const pendingJsapiRef = useRef<WechatJsapiBrowserParams | null>(null);
  const pendingH5Ref = useRef("");
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
    clearMathcodePayResume();
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

  async function startWechatPay(options?: {
    forceNative?: boolean;
    fromClick?: boolean;
  }) {
    const fromClick = Boolean(options?.fromClick);
    setLoading(true);
    setError("");
    setTradeHint("");
    if (!options?.forceNative) setQrDataUrl("");

    if (fromClick && !options?.forceNative && pendingJsapiRef.current) {
      setStatusText("请在微信中完成支付");
      setLoading(false);
      startPolling();
      const result = await invokeWeixinJsapiPay(pendingJsapiRef.current);
      if (result === "ok") {
        setStatusText("支付成功，正在确认…");
        void pollStatus();
      } else if (result === "cancel") {
        setStatusText("已取消支付，可重新点击微信支付");
      } else {
        setError("调起微信支付失败，请再点一次或改用扫码支付");
        setStatusText("调起失败");
        setShowQrFallback(true);
      }
      return;
    }

    if (fromClick && !options?.forceNative && pendingH5Ref.current) {
      setStatusText("正在跳转微信支付…");
      setLoading(false);
      startPolling();
      window.location.href = pendingH5Ref.current;
      return;
    }

    const tradeType: WechatPayTradeType = options?.forceNative
      ? "native"
      : preferWechatTradeType();
    const allowNativeFallback = Boolean(options?.forceNative);

    setStatusText(
      tradeType === "jsapi"
        ? fromClick
          ? "正在调起微信支付…"
          : "正在准备微信支付…"
        : tradeType === "h5"
          ? "正在准备跳转微信支付…"
          : "正在生成微信支付二维码…",
    );

    rememberMathcodePayResume(orderId, amount);

    const res = await fetch(`/api/orders/${orderId}/pay`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "WECHAT",
        tradeType,
        allowNativeFallback,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.mode === "paid" || data.status === "PAID" || data.mode === "mock") {
      finishPaid();
      return;
    }

    if (data.mode === "wechat_need_oauth" && data.oauthUrl) {
      setStatusText("正在授权微信以便直接付款…");
      window.location.href = data.oauthUrl as string;
      return;
    }

    if (data.mode === "wechat_jsapi" && data.payParams) {
      const payParams = data.payParams as WechatJsapiBrowserParams;
      pendingJsapiRef.current = payParams;
      setPendingJsapi(payParams);
      startPolling();
      if (!fromClick) {
        setStatusText("请点击「微信支付」完成付款");
        setTradeHint("微信内必须再点一次按钮才会弹出付款。");
        return;
      }
      setStatusText("请在微信中完成支付");
      const result = await invokeWeixinJsapiPay(payParams);
      if (result === "ok") {
        setStatusText("支付成功，正在确认…");
        void pollStatus();
      } else if (result === "cancel") {
        setStatusText("已取消支付，可重新点击微信支付");
      } else {
        setError("调起微信支付失败，请再点一次或改用扫码支付");
        setStatusText("调起失败");
        setShowQrFallback(true);
      }
      return;
    }

    if (data.mode === "wechat_h5" && data.mwebUrl) {
      pendingH5Ref.current = data.mwebUrl as string;
      if (!fromClick) {
        setStatusText("请点击「微信支付」跳转付款");
        return;
      }
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
    setLoading(true);
    setError("");
    setStatusText("正在跳转支付宝…");
    const res = await fetch(`/api/orders/${orderId}/pay`, {
      method: "POST",
      credentials: "same-origin",
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
      credentials: "same-origin",
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
      // 只预取参数 / 必要时去授权，不在这里 invoke
      void startWechatPay({ fromClick: false });
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
            onClick={() => void startWechatPay({ fromClick: true })}
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
        {inWeChat ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            {pendingJsapi
              ? "请再点一次「微信支付」，才会弹出付款。"
              : "点「微信支付」后如需授权，授权回来再点一次即可付款。"}
          </p>
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
            {loading
              ? "正在准备支付…"
              : inWeChat || onMobile
                ? "点击微信支付即可付款"
                : "点击微信支付生成二维码"}
          </div>
        )}
        {(inWeChat || onMobile) && showQrFallback ? (
          <button
            type="button"
            className="btn btn-secondary mt-4 w-full min-h-11 text-sm"
            disabled={loading}
            onClick={() =>
              void startWechatPay({ forceNative: true, fromClick: true })
            }
          >
            改用扫码支付
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

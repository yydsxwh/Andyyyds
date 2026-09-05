/**
 * 微信内 JSAPI 调起（浏览器端）。
 * 必须在用户点击后再 invoke；useEffect 里自动调起经常被微信直接丢掉。
 */

export type WechatJsapiBrowserParams = {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
};

const BRIDGE_WAIT_MS = 2500;

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

export function invokeWeixinJsapiPay(
  payParams: WechatJsapiBrowserParams,
): Promise<"ok" | "cancel" | "fail"> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: "ok" | "cancel" | "fail") => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const run = () => {
      if (typeof window === "undefined" || !window.WeixinJSBridge) {
        finish("fail");
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
          if (msg === "get_brand_wcpay_request:ok") finish("ok");
          else if (msg === "get_brand_wcpay_request:cancel") finish("cancel");
          else finish("fail");
        },
      );
    };

    if (typeof window !== "undefined" && window.WeixinJSBridge) {
      run();
      return;
    }
    if (typeof document === "undefined") {
      finish("fail");
      return;
    }
    document.addEventListener("WeixinJSBridgeReady", run, { once: true });
    window.setTimeout(() => {
      if (window.WeixinJSBridge) run();
      else finish("fail");
    }, BRIDGE_WAIT_MS);
  });
}

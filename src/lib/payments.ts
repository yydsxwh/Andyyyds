import { getSiteSettings } from "./site-settings";

export type PaymentMode = "mock" | "wechat" | "alipay" | "both";

export type PaymentChannels = {
  mode: PaymentMode;
  wechat: boolean;
  alipay: boolean;
  mockOnly: boolean;
};

function envWechatReady() {
  return Boolean(
    process.env.WECHAT_APP_ID &&
      process.env.WECHAT_MCH_ID &&
      process.env.WECHAT_API_V3_KEY &&
      process.env.WECHAT_MCH_SERIAL_NO &&
      (process.env.WECHAT_MCH_PRIVATE_KEY || process.env.WECHAT_MCH_PRIVATE_KEY_PATH),
  );
}

function envAlipayReady() {
  return Boolean(
    process.env.ALIPAY_APP_ID &&
      process.env.ALIPAY_PRIVATE_KEY &&
      process.env.ALIPAY_PUBLIC_KEY,
  );
}

export async function getPublicSiteUrl() {
  const settings = await getSiteSettings();
  const fromDb = settings.siteUrl?.trim();
  if (fromDb) return fromDb.replace(/\/$/, "");
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://www.yydsxwh.com"
  ).replace(/\/$/, "");
}

export async function getPaymentChannels(): Promise<PaymentChannels> {
  const settings = await getSiteSettings();
  const wechatReady =
    Boolean(
      settings.wechatAppId &&
        settings.wechatMchId &&
        settings.wechatApiV3Key &&
        settings.wechatMchSerialNo &&
        settings.wechatMchPrivateKey,
    ) || envWechatReady();
  const alipayReady =
    Boolean(
      settings.alipayAppId &&
        settings.alipayPrivateKey &&
        settings.alipayPublicKey,
    ) || envAlipayReady();

  const modeSetting = (settings.paymentMode || "auto").toLowerCase();
  const envMode = (process.env.PAYMENT_MODE || "").toLowerCase();

  if (modeSetting === "mock" || envMode === "mock") {
    return { mode: "mock", wechat: false, alipay: false, mockOnly: true };
  }

  let wechat = settings.wechatEnabled && wechatReady;
  let alipay = settings.alipayEnabled && alipayReady;

  if (modeSetting === "wechat" || envMode === "wechat") {
    wechat = wechatReady;
    alipay = false;
  } else if (modeSetting === "alipay" || envMode === "alipay") {
    wechat = false;
    alipay = alipayReady;
  } else if (modeSetting === "both") {
    wechat = wechatReady && settings.wechatEnabled;
    alipay = alipayReady && settings.alipayEnabled;
  }

  if (!wechat && !alipay) {
    return { mode: "mock", wechat: false, alipay: false, mockOnly: true };
  }
  if (wechat && alipay) {
    return { mode: "both", wechat: true, alipay: true, mockOnly: false };
  }
  if (wechat) {
    return { mode: "wechat", wechat: true, alipay: false, mockOnly: false };
  }
  return { mode: "alipay", wechat: false, alipay: true, mockOnly: false };
}

/** @deprecated 使用 getPaymentChannels；保留兼容旧调用 */
export async function getPaymentMode(): Promise<PaymentMode> {
  const channels = await getPaymentChannels();
  return channels.mode;
}

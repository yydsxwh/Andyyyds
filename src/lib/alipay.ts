import crypto from "crypto";
import { getPublicSiteUrl } from "./payments";
import { getSiteSettings } from "./site-settings";

export type AlipayConfig = {
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  gateway: string;
};

function normalizePem(key: string, type: "PRIVATE" | "PUBLIC") {
  const cleaned = key
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN[\w\s]+-----/g, "")
    .replace(/-----END[\w\s]+-----/g, "")
    .replace(/\s+/g, "");
  const lines = cleaned.match(/.{1,64}/g) || [];
  if (type === "PRIVATE") {
    return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
  }
  return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----`;
}

export async function getAlipayConfig(): Promise<AlipayConfig> {
  const settings = await getSiteSettings();
  const appId = settings.alipayAppId || process.env.ALIPAY_APP_ID || "";
  const privateKeyRaw =
    settings.alipayPrivateKey || process.env.ALIPAY_PRIVATE_KEY || "";
  const publicKeyRaw =
    settings.alipayPublicKey || process.env.ALIPAY_PUBLIC_KEY || "";
  const gatewayMode =
    settings.alipayGateway || process.env.ALIPAY_GATEWAY || "production";

  if (!appId || !privateKeyRaw || !publicKeyRaw) {
    throw new Error("支付宝参数不完整，请在「系统设置」中填写");
  }

  const gateway =
    gatewayMode === "sandbox"
      ? "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
      : "https://openapi.alipay.com/gateway.do";

  return {
    appId,
    privateKey: normalizePem(privateKeyRaw, "PRIVATE"),
    alipayPublicKey: normalizePem(publicKeyRaw, "PUBLIC"),
    gateway,
  };
}

function signParams(params: Record<string, string>, privateKey: string) {
  const content = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "" && k !== "sign")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(content, "utf8");
  signer.end();
  return signer.sign(privateKey, "base64");
}

export function verifyAlipayNotify(
  params: Record<string, string>,
  alipayPublicKey: string,
) {
  const sign = params.sign;
  const signType = params.sign_type || "RSA2";
  if (!sign || signType !== "RSA2") return false;
  const content = Object.keys(params)
    .filter(
      (k) =>
        params[k] !== undefined &&
        params[k] !== "" &&
        k !== "sign" &&
        k !== "sign_type",
    )
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(content, "utf8");
  verifier.end();
  return verifier.verify(alipayPublicKey, sign, "base64");
}

/** 电脑网站支付：返回可跳转的网关 URL */
export async function createAlipayPagePay(input: {
  orderNo: string;
  subject: string;
  amountCents: number;
}) {
  const cfg = await getAlipayConfig();
  const siteUrl = await getPublicSiteUrl();
  const amountYuan = (input.amountCents / 100).toFixed(2);
  const bizContent = JSON.stringify({
    out_trade_no: input.orderNo,
    product_code: "FAST_INSTANT_TRADE_PAY",
    total_amount: amountYuan,
    subject: input.subject.slice(0, 256),
  });

  const params: Record<string, string> = {
    app_id: cfg.appId,
    method: "alipay.trade.page.pay",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: new Date()
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d+Z$/, "")
      .replace(/-/g, "-"),
    version: "1.0",
    notify_url: `${siteUrl}/api/payments/alipay/notify`,
    return_url: `${siteUrl}/checkout/return`,
    biz_content: bizContent,
  };

  // 用本地时间更贴近支付宝要求
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  params.timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  params.sign = signParams(params, cfg.privateKey);
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return { payUrl: `${cfg.gateway}?${qs}`, notifyUrl: params.notify_url };
}

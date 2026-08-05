import crypto from "crypto";
import fs from "fs";
import { getPublicSiteUrl } from "./payments";
import { getSiteSettings } from "./site-settings";

type WechatConfig = {
  appId: string;
  mchId: string;
  apiV3Key: string;
  serialNo: string;
  privateKey: string;
};

function readEnvPrivateKey() {
  const inline = process.env.WECHAT_MCH_PRIVATE_KEY;
  if (inline) {
    return inline.replace(/\\n/g, "\n");
  }
  const keyPath = process.env.WECHAT_MCH_PRIVATE_KEY_PATH;
  if (keyPath && fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, "utf8");
  }
  return "";
}

export async function getWechatConfig(): Promise<WechatConfig> {
  const settings = await getSiteSettings();
  const appId = settings.wechatAppId || process.env.WECHAT_APP_ID || "";
  const mchId = settings.wechatMchId || process.env.WECHAT_MCH_ID || "";
  const apiV3Key = settings.wechatApiV3Key || process.env.WECHAT_API_V3_KEY || "";
  const serialNo =
    settings.wechatMchSerialNo || process.env.WECHAT_MCH_SERIAL_NO || "";
  const privateKey =
    (settings.wechatMchPrivateKey || "").replace(/\\n/g, "\n") ||
    readEnvPrivateKey();

  if (!appId || !mchId || !apiV3Key || !serialNo || !privateKey) {
    throw new Error(
      "微信商户参数不完整，请在「系统设置」中填写，或配置环境变量",
    );
  }
  if (apiV3Key.length !== 32) {
    throw new Error("微信 APIv3 密钥应为 32 位");
  }
  return { appId, mchId, apiV3Key, serialNo, privateKey };
}

function nonceStr(len = 32) {
  return crypto.randomBytes(len).toString("hex").slice(0, len);
}

function signMessage(message: string, privateKey: string) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(message);
  signer.end();
  return signer.sign(privateKey, "base64");
}

function authorizationHeader(
  method: string,
  canonicalUrl: string,
  body: string,
  cfg: WechatConfig,
) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = nonceStr(32);
  const message = `${method}\n${canonicalUrl}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = signMessage(message, cfg.privateKey);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${cfg.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${cfg.serialNo}"`;
}

async function wechatRequest<T>(
  method: "GET" | "POST",
  path: string,
  bodyObj?: unknown,
): Promise<T> {
  const cfg = await getWechatConfig();
  const body = bodyObj ? JSON.stringify(bodyObj) : "";
  const auth = authorizationHeader(method, path, body, cfg);
  const res = await fetch(`https://api.mch.weixin.qq.com${path}`, {
    method,
    headers: {
      Authorization: auth,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "yyds-course-platform",
    },
    body: method === "POST" ? body : undefined,
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`微信接口返回非 JSON: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg =
      (typeof data.message === "string" && data.message) ||
      (typeof data.code === "string" && data.code) ||
      `HTTP ${res.status}`;
    throw new Error(`微信支付失败: ${msg}`);
  }
  return data as T;
}

export async function createNativePayment(input: {
  orderNo: string;
  description: string;
  amountCents: number;
}) {
  const cfg = await getWechatConfig();
  const notifyUrl = `${await getPublicSiteUrl()}/api/payments/wechat/notify`;
  const data = await wechatRequest<{ code_url?: string }>(
    "POST",
    "/v3/pay/transactions/native",
    {
      appid: cfg.appId,
      mchid: cfg.mchId,
      description: input.description.slice(0, 127),
      out_trade_no: input.orderNo,
      notify_url: notifyUrl,
      amount: {
        total: input.amountCents,
        currency: "CNY",
      },
    },
  );
  if (!data.code_url) {
    throw new Error("微信未返回付款码 code_url");
  }
  return { codeUrl: data.code_url, notifyUrl };
}

export async function queryNativePaymentByOrderNo(orderNo: string) {
  const cfg = await getWechatConfig();
  const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderNo)}?mchid=${encodeURIComponent(cfg.mchId)}`;
  return wechatRequest<{
    trade_state?: string;
    transaction_id?: string;
    out_trade_no?: string;
    amount?: { total?: number };
  }>("GET", path);
}

export async function decryptWechatResource(resource: {
  ciphertext: string;
  associated_data?: string;
  nonce: string;
}) {
  const cfg = await getWechatConfig();
  const key = Buffer.from(cfg.apiV3Key, "utf8");
  const buf = Buffer.from(resource.ciphertext, "base64");
  const authTag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(resource.nonce, "utf8"),
  );
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
  }
  decipher.setAuthTag(authTag);
  const decoded = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decoded.toString("utf8")) as {
    out_trade_no?: string;
    transaction_id?: string;
    trade_state?: string;
    amount?: { total?: number };
  };
}

export type WechatNotifyBody = {
  id?: string;
  create_time?: string;
  resource_type?: string;
  event_type?: string;
  summary?: string;
  resource?: {
    algorithm?: string;
    ciphertext: string;
    associated_data?: string;
    nonce: string;
    original_type?: string;
  };
};

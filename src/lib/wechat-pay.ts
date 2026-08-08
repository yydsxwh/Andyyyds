/**
 * 微信支付 API v3 封装（核心）
 *
 * 三种下单形态（同一商户订单号 out_trade_no 不能混用不同形态重复下单）：
 * - Native：电脑扫码，返回 code_url
 * - JSAPI：微信内直接调起，需要用户 openid（靠公众号网页授权拿到）
 * - H5：手机浏览器跳转微信收银台，需商户开通 H5 权限
 *
 * 配置来源优先「系统设置」数据库字段，环境变量作兜底。
 * 改密钥 / AppID 后一般无需改本文件，只要后台填对即可。
 */

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

export type WechatJsapiPayParams = {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: "RSA";
  paySign: string;
};

/** 从环境变量读商户私钥：支持全文，或指向 pem 文件路径 */
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

/** 组装商户下单所需配置；缺项直接抛中文错误给前台/日志 */
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

/** 公众号网页授权（换 openid）所需的 AppID + AppSecret */
export async function getWechatOAuthConfig(): Promise<{
  appId: string;
  appSecret: string;
} | null> {
  const settings = await getSiteSettings();
  const appId = settings.wechatAppId || process.env.WECHAT_APP_ID || "";
  const appSecret =
    settings.wechatAppSecret || process.env.WECHAT_APP_SECRET || "";
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export async function isWechatOAuthConfigured() {
  return Boolean(await getWechatOAuthConfig());
}

/**
 * 开放平台「网站应用」扫码登录凭证（与公众号分开）。
 * 须在微信开放平台创建网站应用并配置授权回调域后，填 AppID/Secret 才生效。
 */
export async function getWechatWebOAuthConfig(): Promise<{
  appId: string;
  appSecret: string;
} | null> {
  const settings = await getSiteSettings();
  const appId =
    settings.wechatWebAppId || process.env.WECHAT_WEB_APP_ID || "";
  const appSecret =
    settings.wechatWebAppSecret || process.env.WECHAT_WEB_APP_SECRET || "";
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export async function isWechatWebOAuthConfigured() {
  return Boolean(await getWechatWebOAuthConfig());
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

/**
 * 调用微信支付 API v3（自动带商户签名 Authorization）。
 * path 形如 /v3/pay/transactions/jsapi
 */
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
      "Accept-Language": "zh-CN",
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

async function buildNotifyUrl() {
  const siteUrl = await getPublicSiteUrl();
  const notifyUrl = `${siteUrl}/api/payments/wechat/notify`;
  if (!/^https?:\/\/[^\s/?#]+/i.test(notifyUrl)) {
    throw new Error(
      `支付回调地址无效（${notifyUrl}）。请在系统设置把「站点公网地址」设为 https://www.yydsxwh.com`,
    );
  }
  return notifyUrl;
}

/** Native 扫码下单：返回 codeUrl，前端画成二维码 */
export async function createNativePayment(input: {
  orderNo: string;
  description: string;
  amountCents: number;
}) {
  const cfg = await getWechatConfig();
  const notifyUrl = await buildNotifyUrl();
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

/** 微信内浏览器 JSAPI 支付（需用户 openid） */
export async function createJsapiPayment(input: {
  orderNo: string;
  description: string;
  amountCents: number;
  openid: string;
}) {
  const cfg = await getWechatConfig();
  const notifyUrl = await buildNotifyUrl();
  if (!input.openid) {
    throw new Error("缺少微信 openid，无法发起 JSAPI 支付");
  }
  const data = await wechatRequest<{ prepay_id?: string }>(
    "POST",
    "/v3/pay/transactions/jsapi",
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
      payer: {
        openid: input.openid,
      },
    },
  );
  if (!data.prepay_id) {
    throw new Error("微信未返回 prepay_id");
  }
  return {
    prepayId: data.prepay_id,
    payParams: buildJsapiPayParams(data.prepay_id, cfg),
    notifyUrl,
  };
}

/**
 * 把 prepay_id 签成前端 WeixinJSBridge.invoke 需要的字段。
 * 签名串格式是微信规定的，不要改换行与字段顺序。
 */
export function buildJsapiPayParams(
  prepayId: string,
  cfg: WechatConfig,
): WechatJsapiPayParams {
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonce = nonceStr(32);
  const pkg = `prepay_id=${prepayId}`;
  const message = `${cfg.appId}\n${timeStamp}\n${nonce}\n${pkg}\n`;
  const paySign = signMessage(message, cfg.privateKey);
  return {
    appId: cfg.appId,
    timeStamp,
    nonceStr: nonce,
    package: pkg,
    signType: "RSA",
    paySign,
  };
}

/** 手机浏览器 H5 支付（非微信内置浏览器） */
export async function createH5Payment(input: {
  orderNo: string;
  description: string;
  amountCents: number;
  clientIp: string;
  appName?: string;
}) {
  const cfg = await getWechatConfig();
  const notifyUrl = await buildNotifyUrl();
  const siteUrl = await getPublicSiteUrl();
  const clientIp = (input.clientIp || "127.0.0.1").split(",")[0].trim();
  const data = await wechatRequest<{ h5_url?: string }>(
    "POST",
    "/v3/pay/transactions/h5",
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
      scene_info: {
        payer_client_ip: clientIp || "127.0.0.1",
        h5_info: {
          type: "Wap",
          app_name: (input.appName || "歪歪艾斯课程").slice(0, 64),
          app_url: siteUrl,
        },
      },
    },
  );
  if (!data.h5_url) {
    throw new Error("微信未返回 H5 支付链接 h5_url");
  }
  return { mwebUrl: data.h5_url, notifyUrl };
}

/**
 * 用 OAuth code 换 openid / access_token。
 * channel=oa 用公众号凭证；channel=web 用开放平台网站应用凭证（扫码登录）。
 * 两套 openid 不同，勿混用。
 */
export async function exchangeWechatOAuthCode(
  code: string,
  channel: "oa" | "web" = "oa",
) {
  const oauth =
    channel === "web"
      ? await getWechatWebOAuthConfig()
      : await getWechatOAuthConfig();
  if (!oauth) {
    throw new Error(
      channel === "web"
        ? "未配置开放平台网站应用 AppSecret，无法完成扫码登录"
        : "未配置微信 AppSecret，无法完成网页授权",
    );
  }
  const url = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
  url.searchParams.set("appid", oauth.appId);
  url.searchParams.set("secret", oauth.appSecret);
  url.searchParams.set("code", code);
  url.searchParams.set("grant_type", "authorization_code");
  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = (await res.json()) as {
    access_token?: string;
    openid?: string;
    /** 应用已绑定开放平台账号时才有，用于跨公众号/网站应用识别同一人 */
    unionid?: string;
    scope?: string;
    errcode?: number;
    errmsg?: string;
  };
  if (!data.openid) {
    throw new Error(
      data.errmsg || `微信授权失败${data.errcode ? ` (${data.errcode})` : ""}`,
    );
  }
  return {
    openid: data.openid,
    unionid: data.unionid || "",
    accessToken: data.access_token || "",
    scope: data.scope || "",
  };
}

/** snsapi_userinfo：拉取微信昵称与头像（须用户确认授权） */
export async function fetchWechatUserInfo(input: {
  accessToken: string;
  openid: string;
}): Promise<{ nickname: string; headimgurl: string }> {
  const token = input.accessToken.trim();
  const openid = input.openid.trim();
  if (!token || !openid) {
    return { nickname: "", headimgurl: "" };
  }
  const url = new URL("https://api.weixin.qq.com/sns/userinfo");
  url.searchParams.set("access_token", token);
  url.searchParams.set("openid", openid);
  url.searchParams.set("lang", "zh_CN");
  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = (await res.json()) as {
    nickname?: string;
    headimgurl?: string;
    errcode?: number;
    errmsg?: string;
  };
  if (data.errcode) {
    throw new Error(
      data.errmsg || `获取微信资料失败 (${data.errcode})`,
    );
  }
  return {
    nickname: (data.nickname || "").trim().slice(0, 40),
    // 微信头像多为 http，统一成 https 便于站点展示
    headimgurl: (data.headimgurl || "")
      .trim()
      .replace(/^http:\/\//i, "https://"),
  };
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

/**
 * 解密支付结果通知里的 resource（AEAD_AES_256_GCM）。
 * apiV3Key 必须与商户平台设置的 32 位密钥一致。
 */
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

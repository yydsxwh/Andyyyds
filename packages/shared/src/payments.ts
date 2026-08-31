/**
 * 支付渠道与站点公网地址（核心）
 *
 * 职责：
 * 1. 算出当前前台可用哪些支付方式（微信 / 支付宝 / 仅模拟）
 * 2. 规范化站点公网 URL，供微信/支付宝回调地址拼接
 *
 * 改需求时注意：
 * - 「启用开关」在系统设置；「参数是否齐全」才算真正可用
 * - 两者都没有时会落到 mockOnly，结账页走模拟支付
 */

import { getSiteSettings } from "./site-settings";

export type PaymentMode = "mock" | "wechat" | "alipay" | "both";

export type PaymentChannels = {
  mode: PaymentMode;
  wechat: boolean;
  alipay: boolean;
  /** true 表示只能点「模拟支付」，用于未配真实收款时调试 */
  mockOnly: boolean;
};

/** 环境变量里是否凑齐微信商户必填项（可作为数据库配置的兜底） */
function envWechatReady() {
  return Boolean(
    process.env.WECHAT_APP_ID &&
      process.env.WECHAT_MCH_ID &&
      process.env.WECHAT_API_V3_KEY &&
      process.env.WECHAT_MCH_SERIAL_NO &&
      (process.env.WECHAT_MCH_PRIVATE_KEY || process.env.WECHAT_MCH_PRIVATE_KEY_PATH),
  );
}

/** 环境变量里是否凑齐支付宝必填项 */
function envAlipayReady() {
  return Boolean(
    process.env.ALIPAY_APP_ID &&
      process.env.ALIPAY_PRIVATE_KEY &&
      process.env.ALIPAY_PUBLIC_KEY,
  );
}

const DEFAULT_SITE_URL = "https://www.yydsxwh.com";

/**
 * 把后台填写的「站点公网地址」收成干净的 https://域名 形态。
 * 微信 notify_url 对格式很敏感：缺协议、多路径、空白都会导致下单失败。
 */
export function normalizePublicSiteUrl(raw: string | null | undefined): string {
  let value = (raw || "").trim().replace(/[\\\s\u3000]+/g, "");
  if (!value) return DEFAULT_SITE_URL;

  // 有人误把完整回调 URL 填进「站点地址」时，裁回站点根
  value = value.replace(
    /\/api\/payments\/(wechat|alipay)\/notify\/?$/i,
    "",
  );

  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value.replace(/^\/+/, "")}`;
  }

  try {
    const u = new URL(value);
    if (!u.hostname || !u.hostname.includes(".")) {
      return DEFAULT_SITE_URL;
    }
    // 只保留协议 + 主机（+非常规端口），不带业务路径
    const port =
      u.port && u.port !== "80" && u.port !== "443" ? `:${u.port}` : "";
    return `${u.protocol}//${u.hostname.toLowerCase()}${port}`;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/** 当前站点对外根地址：优先系统设置，其次环境变量，最后默认正式域名 */
export async function getPublicSiteUrl() {
  const settings = await getSiteSettings();
  const fromDb = settings.siteUrl?.trim();
  if (fromDb) return normalizePublicSiteUrl(fromDb);
  return normalizePublicSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      DEFAULT_SITE_URL,
  );
}

/**
 * 结账页用的支付通道开关。
 * 判定顺序：强制 mock → 设置/env 指定单通道 → auto（看启用+配置是否齐全）。
 */
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

  // 真实通道一个都不可用时，降级为模拟，避免前台完全无法测流程
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

/** @deprecated 请改用 getPaymentChannels；仅保留旧代码兼容 */
export async function getPaymentMode(): Promise<PaymentMode> {
  const channels = await getPaymentChannels();
  return channels.mode;
}

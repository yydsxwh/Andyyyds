/**
 * 微信 / 移动端环境探测（可在浏览器端使用，无密钥）
 *
 * 结账页据此选择微信支付形态：
 * - jsapi：微信内置浏览器，调起原生支付（需 openid）
 * - h5：普通手机浏览器，跳转微信 H5 收银台
 * - native：电脑端，展示二维码扫码
 *
 * Capacitor 壳内用 isCapacitorNative / isCapacitorAndroid 决定走微信 SDK 快捷登录。
 */

export type WechatPayTradeType = "native" | "jsapi" | "h5";

type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function getCapacitor(): CapacitorBridge | null {
  if (typeof window === "undefined") return null;
  const cap = (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;
  return cap || null;
}

/** 是否在 Capacitor 原生壳（Android / iOS App）中打开 */
export function isCapacitorNative(): boolean {
  const cap = getCapacitor();
  if (!cap) return false;
  try {
    if (typeof cap.isNativePlatform === "function") {
      return Boolean(cap.isNativePlatform());
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** 是否在 Android Capacitor App 中（微信移动应用 SDK 仅 Android 已接入） */
export function isCapacitorAndroid(): boolean {
  if (!isCapacitorNative()) return false;
  const cap = getCapacitor();
  try {
    const platform = (cap?.getPlatform?.() || "").toLowerCase();
    return platform === "android";
  } catch {
    return false;
  }
}

/** 是否在微信内置浏览器中打开 */
export function isWeChatBrowser(ua?: string): boolean {
  const value = ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return /MicroMessenger/i.test(value);
}

/** 是否像手机 / 平板浏览器（含微信） */
export function isMobileBrowser(ua?: string): boolean {
  const value = ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return /Android|webOS|iPhone|iPod|iPad|Mobile|BlackBerry|IEMobile|Opera Mini/i.test(
    value,
  );
}

/** 按 UA 推荐微信支付 tradeType；微信优先于「仅手机」判断 */
export function preferWechatTradeType(ua?: string): WechatPayTradeType {
  if (isWeChatBrowser(ua)) return "jsapi";
  if (isMobileBrowser(ua)) return "h5";
  return "native";
}

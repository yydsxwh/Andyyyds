/**
 * 微信 / 移动端环境探测（可在浏览器端使用，无密钥）
 *
 * 结账页据此选择微信支付形态：
 * - jsapi：微信内置浏览器，调起原生支付（需 openid）
 * - h5：普通手机浏览器，跳转微信 H5 收银台
 * - native：电脑端，展示二维码扫码
 */

export type WechatPayTradeType = "native" | "jsapi" | "h5";

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

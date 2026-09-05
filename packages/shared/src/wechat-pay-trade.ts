/**
 * 微信支付形态怎么定：客户端可以点名，服务端只在「误传扫码」时按 UA 改成 JSAPI/H5。
 *
 * 为什么不能无条件改写 native：
 * 用户点「改用扫码」或识图页要留在本页时，必须真的下 Native 单。
 * 若微信 UA 一律改成 JSAPI，没 openid / 调起失败时就会既弹不出收银台，也出不了码。
 */

import {
  isMobileBrowser,
  isWeChatBrowser,
  type WechatPayTradeType,
} from "./wechat-env";

export function resolveWechatPayTradeType(input: {
  requested: WechatPayTradeType;
  /** true=用户明确要扫码，不要再改写成 JSAPI/H5 */
  allowNativeFallback: boolean;
  ua: string;
}): WechatPayTradeType {
  if (input.requested === "native" && input.allowNativeFallback) {
    return "native";
  }
  if (input.requested === "native") {
    if (isWeChatBrowser(input.ua)) return "jsapi";
    if (isMobileBrowser(input.ua)) return "h5";
  }
  return input.requested;
}

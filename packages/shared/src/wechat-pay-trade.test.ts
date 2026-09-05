import assert from "node:assert/strict";
import { resolveWechatPayTradeType } from "./wechat-pay-trade";

const wechatUa =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50";
const mobileUa =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const desktopUa =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

{
  const trade = resolveWechatPayTradeType({
    requested: "native",
    allowNativeFallback: false,
    ua: wechatUa,
  });
  assert.equal(trade, "jsapi");
}

{
  const trade = resolveWechatPayTradeType({
    requested: "native",
    allowNativeFallback: false,
    ua: mobileUa,
  });
  assert.equal(trade, "h5");
}

{
  const trade = resolveWechatPayTradeType({
    requested: "native",
    allowNativeFallback: true,
    ua: wechatUa,
  });
  assert.equal(trade, "native");
}

{
  const trade = resolveWechatPayTradeType({
    requested: "jsapi",
    allowNativeFallback: false,
    ua: wechatUa,
  });
  assert.equal(trade, "jsapi");
}

{
  const trade = resolveWechatPayTradeType({
    requested: "native",
    allowNativeFallback: false,
    ua: desktopUa,
  });
  assert.equal(trade, "native");
}

console.log("wechat-pay-trade tests ok");

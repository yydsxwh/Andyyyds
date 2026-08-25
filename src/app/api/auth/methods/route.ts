/**
 * GET /api/auth/methods
 * 登录页探测可用登录方式（不暴露密钥）。
 * wechat = 公众号网页授权（微信内）；wechatQr = 开放平台扫码（站外浏览器）；
 * wechatMobile = Android App 开放平台移动应用 SDK（仅返回公开 AppID）。
 */

import { NextResponse } from "next/server";
import { getSiteSettings, publicSiteSettings } from "@/lib/site-settings";
import {
  getWechatMobileOAuthConfig,
  isWechatMobileOAuthConfigured,
  isWechatOAuthConfigured,
  isWechatWebOAuthConfigured,
} from "@/lib/wechat-pay";

export async function GET() {
  const row = await getSiteSettings();
  const pub = publicSiteSettings(row);
  const mobileConfigured = Boolean(
    pub.wechatMobileOauthConfigured || (await isWechatMobileOAuthConfigured()),
  );
  // AppID 对客户端公开（SDK 调起需要）；Secret 永不下发
  const mobileConfig = mobileConfigured
    ? await getWechatMobileOAuthConfig()
    : null;
  return NextResponse.json({
    email: true,
    wechat: Boolean(
      pub.wechatOauthConfigured || (await isWechatOAuthConfigured()),
    ),
    wechatQr: Boolean(
      pub.wechatWebOauthConfigured || (await isWechatWebOAuthConfigured()),
    ),
    wechatMobile: mobileConfigured,
    wechatMobileAppId: mobileConfig?.appId || pub.wechatMobileAppId || "",
    phone: Boolean(pub.smsLoginReady),
    smsTestMode: Boolean(pub.smsEnabled && pub.smsTestMode),
  });
}

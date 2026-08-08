/**
 * GET /api/auth/methods
 * 登录页探测可用登录方式（不暴露密钥）。
 * wechat = 公众号网页授权（微信内）；wechatQr = 开放平台扫码（站外浏览器）。
 */

import { NextResponse } from "next/server";
import { getSiteSettings, publicSiteSettings } from "@/lib/site-settings";
import {
  isWechatOAuthConfigured,
  isWechatWebOAuthConfigured,
} from "@/lib/wechat-pay";

export async function GET() {
  const row = await getSiteSettings();
  const pub = publicSiteSettings(row);
  return NextResponse.json({
    email: true,
    wechat: Boolean(
      pub.wechatOauthConfigured || (await isWechatOAuthConfigured()),
    ),
    wechatQr: Boolean(
      pub.wechatWebOauthConfigured || (await isWechatWebOAuthConfigured()),
    ),
    phone: Boolean(pub.smsLoginReady),
    smsTestMode: Boolean(pub.smsEnabled && pub.smsTestMode),
  });
}

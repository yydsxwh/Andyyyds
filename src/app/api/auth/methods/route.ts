/**
 * GET /api/auth/methods
 * 登录页探测可用登录方式（不暴露密钥）。
 */

import { NextResponse } from "next/server";
import { getSiteSettings, publicSiteSettings } from "@/lib/site-settings";
import { isWechatOAuthConfigured } from "@/lib/wechat-pay";

export async function GET() {
  const row = await getSiteSettings();
  const pub = publicSiteSettings(row);
  return NextResponse.json({
    email: true,
    wechat: Boolean(pub.wechatOauthConfigured || (await isWechatOAuthConfigured())),
    phone: Boolean(pub.smsLoginReady),
    smsTestMode: Boolean(pub.smsEnabled && pub.smsTestMode),
  });
}

/**
 * 主站探活。
 *
 * 只回答「这个 Node 进程还在」。不查数据库、不读密钥、不请求账号中心或 Platform。
 * 数据库或某个产品页面故障时，反代仍能把「进程死了」和「业务出错」分开。
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    service: "main-site",
    status: "ok",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
}

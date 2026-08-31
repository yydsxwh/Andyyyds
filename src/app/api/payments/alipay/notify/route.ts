/**
 * POST /api/payments/alipay/notify
 *
 * 支付宝异步通知（form-urlencoded）。验签通过且交易成功后履约。
 * 成功必须返回纯文本 "success"。
 */

import { NextResponse } from "next/server";
import { getAlipayConfig, verifyAlipayNotify } from "@andyyyds/shared/alipay";
import { prisma } from "@andyyyds/shared/db";
import { fulfillPaidOrder } from "@andyyyds/shared/orders";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const params: Record<string, string> = {};
    form.forEach((value, key) => {
      params[key] = String(value);
    });

    const cfg = await getAlipayConfig();
    if (!verifyAlipayNotify(params, cfg.alipayPublicKey)) {
      return new NextResponse("fail", { status: 400 });
    }

    if (params.trade_status !== "TRADE_SUCCESS" && params.trade_status !== "TRADE_FINISHED") {
      return new NextResponse("success");
    }

    const orderNo = params.out_trade_no;
    if (!orderNo) return new NextResponse("fail", { status: 400 });

    const order = await prisma.order.findUnique({ where: { orderNo } });
    if (!order) return new NextResponse("fail", { status: 404 });

    const total = Math.round(Number(params.total_amount || 0) * 100);
    if (total && total !== order.amount) {
      return new NextResponse("fail", { status: 400 });
    }

    await fulfillPaidOrder({
      orderId: order.id,
      payChannel: "ALIPAY",
      providerTradeNo: params.trade_no || "",
    });

    return new NextResponse("success");
  } catch (error) {
    console.error("[alipay-notify]", error);
    return new NextResponse("fail", { status: 500 });
  }
}

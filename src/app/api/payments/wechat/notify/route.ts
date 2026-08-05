import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fulfillPaidOrder } from "@/lib/orders";
import {
  decryptWechatResource,
  type WechatNotifyBody,
} from "@/lib/wechat-pay";

export const runtime = "nodejs";

function ok() {
  return NextResponse.json({ code: "SUCCESS", message: "成功" });
}

function fail(message: string, status = 500) {
  return NextResponse.json({ code: "FAIL", message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as WechatNotifyBody;
    if (!body.resource?.ciphertext || !body.resource.nonce) {
      return fail("缺少加密资源", 400);
    }

    const payload = await decryptWechatResource({
      ciphertext: body.resource.ciphertext,
      associated_data: body.resource.associated_data,
      nonce: body.resource.nonce,
    });

    if (payload.trade_state && payload.trade_state !== "SUCCESS") {
      return ok();
    }

    const orderNo = payload.out_trade_no;
    if (!orderNo) {
      return fail("缺少商户订单号", 400);
    }

    const order = await prisma.order.findUnique({ where: { orderNo } });
    if (!order) {
      return fail("订单不存在", 404);
    }

    if (
      typeof payload.amount?.total === "number" &&
      payload.amount.total !== order.amount
    ) {
      return fail("金额不匹配", 400);
    }

    await fulfillPaidOrder({
      orderId: order.id,
      payChannel: "WECHAT",
      providerTradeNo: payload.transaction_id || "",
    });

    return ok();
  } catch (error) {
    const message = error instanceof Error ? error.message : "处理失败";
    console.error("[wechat-notify]", message);
    return fail(message, 500);
  }
}

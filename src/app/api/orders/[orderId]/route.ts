import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fulfillPaidOrder } from "@/lib/orders";
import { getPaymentChannels } from "@/lib/payments";
import { queryNativePaymentByOrderNo } from "@/lib/wechat-pay";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { orderId } = await params;
  let order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { course: { select: { slug: true, title: true } } },
  });

  if (!order || order.userId !== session.id) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }

  const channels = await getPaymentChannels();
  if (
    order.status === "PENDING" &&
    order.payChannel === "WECHAT" &&
    channels.wechat
  ) {
    try {
      const wx = await queryNativePaymentByOrderNo(order.orderNo);
      if (wx.trade_state === "SUCCESS") {
        order = await fulfillPaidOrder({
          orderId: order.id,
          payChannel: "WECHAT",
          providerTradeNo: wx.transaction_id || "",
        });
      }
    } catch {
      // ignore poll errors
    }
  }

  return NextResponse.json({
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    amount: order.amount,
    payChannel: order.payChannel,
    codeUrl: order.codeUrl,
    slug: order.course.slug,
    title: order.course.title,
    paidAt: order.paidAt,
  });
}

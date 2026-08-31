import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import {
  stringifyStoredAnswers,
  validateOrderFormAnswers,
} from "@andyyyds/shared/order-form";
import { fulfillPaidOrder } from "@andyyyds/shared/orders";
import { getPaymentChannels } from "@andyyyds/shared/payments";
import { getOrderFormConfig } from "@andyyyds/shared/site-settings";
import { queryNativePaymentByOrderNo } from "@andyyyds/shared/wechat-pay";

const patchSchema = z.object({
  formAnswers: z.record(z.string(), z.string()),
});

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
    include: {
      course: { select: { slug: true, title: true, productType: true } },
    },
  });

  if (!order || order.userId !== session.id) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }

  const channels = await getPaymentChannels();
  const wechatPending =
    order.payChannel === "WECHAT" ||
    order.payChannel.startsWith("WECHAT_");
  if (order.status === "PENDING" && wechatPending && channels.wechat) {
    try {
      const wx = await queryNativePaymentByOrderNo(order.orderNo);
      if (wx.trade_state === "SUCCESS") {
        order = await fulfillPaidOrder({
          orderId: order.id,
          payChannel: order.payChannel || "WECHAT",
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
    productType: order.course.productType,
    paidAt: order.paidAt,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { orderId } = await params;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== session.id) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }
  if (order.status !== "PENDING") {
    return NextResponse.json({ error: "订单状态不可修改" }, { status: 400 });
  }

  try {
    const body = patchSchema.parse(await req.json());
    const orderForm = await getOrderFormConfig();
    const check = validateOrderFormAnswers(orderForm, body.formAnswers);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { formAnswersJson: stringifyStoredAnswers(check.stored) },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "保存失败" }, { status: 400 });
  }
}

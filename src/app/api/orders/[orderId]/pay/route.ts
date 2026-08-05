import { NextResponse } from "next/server";
import { z } from "zod";
import { createAlipayPagePay } from "@/lib/alipay";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fulfillPaidOrder } from "@/lib/orders";
import { getPaymentChannels } from "@/lib/payments";
import { createNativePayment } from "@/lib/wechat-pay";

const bodySchema = z
  .object({
    channel: z.enum(["WECHAT", "ALIPAY", "MOCK"]).optional(),
  })
  .optional();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { course: true },
  });

  if (!order || order.userId !== session.id) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }
  if (order.status === "PAID") {
    return NextResponse.json({
      mode: "paid",
      slug: order.course.slug,
      status: "PAID",
    });
  }

  let channel: "WECHAT" | "ALIPAY" | "MOCK" = "WECHAT";
  try {
    const parsed = bodySchema.parse(await req.json().catch(() => ({})));
    channel = parsed?.channel || "WECHAT";
  } catch {
    channel = "WECHAT";
  }

  const channels = await getPaymentChannels();

  if (channel === "MOCK" || channels.mockOnly) {
    if (!channels.mockOnly && channel === "MOCK") {
      return NextResponse.json(
        { error: "线上已启用真实支付，请使用微信或支付宝" },
        { status: 400 },
      );
    }
    const paid = await fulfillPaidOrder({
      orderId: order.id,
      payChannel: "MOCK",
    });
    return NextResponse.json({
      mode: "mock",
      status: "PAID",
      slug: paid.course.slug,
    });
  }

  try {
    if (channel === "WECHAT") {
      if (!channels.wechat) {
        return NextResponse.json({ error: "未启用微信支付" }, { status: 400 });
      }
      if (order.codeUrl && order.payChannel === "WECHAT") {
        return NextResponse.json({
          mode: "wechat",
          status: order.status,
          orderNo: order.orderNo,
          codeUrl: order.codeUrl,
          amount: order.amount,
          slug: order.course.slug,
        });
      }
      const { codeUrl } = await createNativePayment({
        orderNo: order.orderNo,
        description: order.course.title,
        amountCents: order.amount,
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { payChannel: "WECHAT", codeUrl },
      });
      return NextResponse.json({
        mode: "wechat",
        status: "PENDING",
        orderNo: order.orderNo,
        codeUrl,
        amount: order.amount,
        slug: order.course.slug,
      });
    }

    if (channel === "ALIPAY") {
      if (!channels.alipay) {
        return NextResponse.json({ error: "未启用支付宝支付" }, { status: 400 });
      }
      const { payUrl } = await createAlipayPagePay({
        orderNo: order.orderNo,
        subject: order.course.title,
        amountCents: order.amount,
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { payChannel: "ALIPAY", codeUrl: payUrl },
      });
      return NextResponse.json({
        mode: "alipay",
        status: "PENDING",
        orderNo: order.orderNo,
        payUrl,
        amount: order.amount,
        slug: order.course.slug,
      });
    }

    return NextResponse.json({ error: "不支持的支付方式" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "发起支付失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

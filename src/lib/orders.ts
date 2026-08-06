/**
 * 订单履约（支付成功后的统一入口）
 *
 * 无论来自：微信回调 / 支付宝回调 / 模拟支付 / 主动查单，
 * 都应调用 fulfillPaidOrder，保证：
 * - 幂等（已支付再调一次不重复开通）
 * - 写 PAID、开通 enrollment、优惠券核销、分销佣金
 *
 * 改需求时：加「发短信 / 发邮件」等副作用，优先放在本函数事务成功之后。
 */

import { prisma } from "./db";
import { createCommissionsForOrder } from "./distribution";

type FulfillInput = {
  orderId: string;
  /** 记录到订单上的渠道标记，如 WECHAT_JSAPI / ALIPAY_WAP */
  payChannel?: string;
  /** 微信/支付宝侧交易号，便于对账 */
  providerTradeNo?: string;
};

/**
 * 将订单标记为已支付并开通学习权限（幂等：已支付直接返回）。
 */
export async function fulfillPaidOrder(input: FulfillInput) {
  const existing = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { course: true },
  });
  if (!existing) {
    throw new Error("ORDER_NOT_FOUND");
  }
  // 已支付：直接返回，避免重复加学员数、重复分佣
  if (existing.status === "PAID") {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    // 事务内再读一次，防止并发回调双写
    const current = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!current) throw new Error("ORDER_NOT_FOUND");
    if (current.status === "PAID") {
      return tx.order.findUniqueOrThrow({
        where: { id: input.orderId },
        include: { course: true },
      });
    }

    const paid = await tx.order.update({
      where: { id: input.orderId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        ...(input.payChannel ? { payChannel: input.payChannel } : {}),
        ...(input.providerTradeNo
          ? { providerTradeNo: input.providerTradeNo }
          : {}),
      },
      include: { course: true },
    });

    // 优惠券：用量 +1，并记一条核销记录
    if (paid.couponId) {
      await tx.coupon.update({
        where: { id: paid.couponId },
        data: { usedCount: { increment: 1 } },
      });
      const redeemed = await tx.couponRedemption.findUnique({
        where: {
          couponId_userId: { couponId: paid.couponId, userId: paid.userId },
        },
      });
      if (!redeemed) {
        await tx.couponRedemption.create({
          data: { couponId: paid.couponId, userId: paid.userId },
        });
      }
    }

    // 开通学习权限（enrollment）；已有则不重复加 studentCount
    const enrollment = await tx.enrollment.findUnique({
      where: {
        userId_courseId: { userId: paid.userId, courseId: paid.courseId },
      },
    });
    if (!enrollment) {
      await tx.enrollment.create({
        data: { userId: paid.userId, courseId: paid.courseId },
      });
      await tx.course.update({
        where: { id: paid.courseId },
        data: { studentCount: { increment: 1 } },
      });
    }

    // 三级分销结算（内部会看分销开关与比例）
    await createCommissionsForOrder(tx, {
      id: paid.id,
      userId: paid.userId,
      amount: paid.amount,
    });

    return paid;
  });
}

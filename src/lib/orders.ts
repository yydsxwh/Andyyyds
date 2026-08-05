import { prisma } from "./db";
import { createCommissionsForOrder } from "./distribution";

type FulfillInput = {
  orderId: string;
  payChannel?: string;
  providerTradeNo?: string;
};

/**
 * 将订单标记为已支付并开通学习权限（幂等：已支付直接返回）。
 * 支付回调与主动查单都应走这里。
 */
export async function fulfillPaidOrder(input: FulfillInput) {
  const existing = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { course: true },
  });
  if (!existing) {
    throw new Error("ORDER_NOT_FOUND");
  }
  if (existing.status === "PAID") {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
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

    await createCommissionsForOrder(tx, {
      id: paid.id,
      userId: paid.userId,
      amount: paid.amount,
    });

    return paid;
  });
}

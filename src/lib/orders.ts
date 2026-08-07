/**
 * 订单履约（支付成功后的统一入口）
 *
 * 无论来自：微信回调 / 支付宝回调 / 模拟支付 / 主动查单，
 * 都应调用 fulfillPaidOrder，保证：
 * - 幂等（已支付再调一次不重复开通）
 * - 写 PAID、开通 enrollment、优惠券核销、平台/商家/代理分成、三级分销
 * - 专栏套餐：同时开通所含每门单课
 *
 * 改需求时：加「发短信 / 发邮件」等副作用，优先放在本函数事务成功之后。
 */

import { grantProductAccess } from "./course-bundle";
import { prisma } from "./db";
import { settlePaidOrderSplit } from "./platform-settlement";

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
  // 已支付：仍补开 enrollment（含专栏子课；历史异常订单可能 PAID 却未报名）
  if (existing.status === "PAID") {
    await grantProductAccess(prisma, {
      userId: existing.userId,
      productId: existing.courseId,
    });
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    // 事务内再读一次，防止并发回调双写
    const current = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!current) throw new Error("ORDER_NOT_FOUND");
    if (current.status === "PAID") {
      await grantProductAccess(tx, {
        userId: current.userId,
        productId: current.courseId,
      });
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

    // 开通本商品 + 专栏所含单课
    await grantProductAccess(tx, {
      userId: paid.userId,
      productId: paid.courseId,
    });

    // 商城销量占位：支付成功后累加「已售」
    if (paid.course.productType === "PRODUCT") {
      await tx.course.update({
        where: { id: paid.courseId },
        data: { studentCount: { increment: Math.max(1, paid.quantity || 1) } },
      });
    }

    // 平台抽成 / 商家实得 / 推荐人&代理分成 + 三级分销
    await settlePaidOrderSplit(tx, {
      id: paid.id,
      userId: paid.userId,
      amount: paid.amount,
      courseId: paid.courseId,
      referralCode: paid.referralCode,
    });

    return tx.order.findUniqueOrThrow({
      where: { id: paid.id },
      include: { course: true },
    });
  });
}

/**
 * GET /api/coupons/available?courseId= —— 当前用户对该课可用的优惠券列表
 * 用于购买页点选；最终仍以 POST /api/orders 服务端校验为准。
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import {
  calcCouponDiscount,
  couponAppliesToProduct,
  formatCouponBenefit,
  validateCouponForOrder,
} from "@andyyyds/shared/coupons";
import { prisma } from "@andyyyds/shared/db";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const courseId = new URL(req.url).searchParams.get("courseId") || "";
  if (!courseId) {
    return NextResponse.json({ error: "缺少课程" }, { status: 400 });
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.status !== "PUBLISHED" || course.price <= 0) {
    return NextResponse.json({ coupons: [] });
  }

  const now = new Date();
  // 全站券 + 明确绑定本商品的指定券；在内存再滤一遍以兼容旧数据
  const coupons = await prisma.coupon.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        {
          OR: [
            { productScope: "ALL" },
            { products: { some: { courseId } } },
          ],
        },
      ],
    },
    include: {
      products: { select: { courseId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const redeemed = await prisma.couponRedemption.findMany({
    where: {
      userId: session.id,
      couponId: { in: coupons.map((c) => c.id) },
    },
    select: { couponId: true },
  });
  const redeemedSet = new Set(redeemed.map((r) => r.couponId));

  const available = coupons
    .map((c) => ({
      ...c,
      productIds: c.products.map((p) => p.courseId),
    }))
    .filter((c) => !redeemedSet.has(c.id))
    .filter((c) => couponAppliesToProduct(c, courseId))
    .filter((c) => !validateCouponForOrder(c, course.price, now, courseId))
    .map((c) => {
      const discount = calcCouponDiscount(course.price, c);
      return {
        id: c.id,
        code: c.code,
        title: c.title,
        type: c.type,
        benefit: formatCouponBenefit(c),
        discountCents: discount,
        minAmount: c.minAmount,
        expiresAt: c.expiresAt?.toISOString() ?? null,
      };
    })
    // 减免多的排前面，方便点选
    .sort((a, b) => b.discountCents - a.discountCents);

  return NextResponse.json({ coupons: available, coursePrice: course.price });
}

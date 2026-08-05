import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { makeOrderNo } from "@/lib/utils";

const schema = z.object({
  courseId: z.string().min(1),
  couponCode: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());
    const course = await prisma.course.findUnique({ where: { id: body.courseId } });
    if (!course || course.status !== "PUBLISHED") {
      return NextResponse.json({ error: "课程不存在" }, { status: 404 });
    }

    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.id, courseId: course.id } },
    });
    if (existing) {
      return NextResponse.json({ enrolled: true, slug: course.slug });
    }

    if (course.isFree || course.price <= 0) {
      await prisma.enrollment.create({
        data: { userId: session.id, courseId: course.id },
      });
      await prisma.course.update({
        where: { id: course.id },
        data: { studentCount: { increment: 1 } },
      });
      return NextResponse.json({ enrolled: true, slug: course.slug });
    }

    let discount = 0;
    let couponId: string | undefined;
    if (body.couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: body.couponCode.toUpperCase() },
      });
      if (
        !coupon ||
        !coupon.isActive ||
        (coupon.expiresAt && coupon.expiresAt < new Date()) ||
        coupon.usedCount >= coupon.maxUses ||
        course.price < coupon.minAmount
      ) {
        return NextResponse.json({ error: "优惠券不可用" }, { status: 400 });
      }
      const redeemed = await prisma.couponRedemption.findUnique({
        where: {
          couponId_userId: { couponId: coupon.id, userId: session.id },
        },
      });
      if (redeemed) {
        return NextResponse.json({ error: "该优惠券已使用过" }, { status: 400 });
      }
      discount = Math.min(coupon.discountCents, course.price);
      couponId = coupon.id;
    }

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    const amount = Math.max(course.price - discount, 0);

    const order = await prisma.order.create({
      data: {
        orderNo: makeOrderNo(),
        userId: session.id,
        courseId: course.id,
        amount,
        discount,
        couponId,
        referralCode: user?.referredById
          ? (
              await prisma.user.findUnique({ where: { id: user.referredById } })
            )?.referralCode
          : undefined,
        status: amount === 0 ? "PAID" : "PENDING",
        paidAt: amount === 0 ? new Date() : undefined,
      },
    });

    if (amount === 0) {
      if (couponId) {
        await prisma.$transaction([
          prisma.coupon.update({
            where: { id: couponId },
            data: { usedCount: { increment: 1 } },
          }),
          prisma.couponRedemption.create({
            data: { couponId, userId: session.id },
          }),
        ]);
      }
      await prisma.enrollment.create({
        data: { userId: session.id, courseId: course.id },
      });
      await prisma.course.update({
        where: { id: course.id },
        data: { studentCount: { increment: 1 } },
      });
      return NextResponse.json({ enrolled: true, slug: course.slug });
    }

    return NextResponse.json({ orderId: order.id });
  } catch {
    return NextResponse.json({ error: "下单失败" }, { status: 400 });
  }
}

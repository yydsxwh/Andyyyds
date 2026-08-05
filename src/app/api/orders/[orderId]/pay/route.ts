import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  _req: Request,
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
    return NextResponse.json({ slug: order.course.slug });
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date() },
    });

    if (order.couponId) {
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { increment: 1 } },
      });
      await tx.couponRedemption.create({
        data: { couponId: order.couponId, userId: session.id },
      });
    }

    const existing = await tx.enrollment.findUnique({
      where: {
        userId_courseId: { userId: session.id, courseId: order.courseId },
      },
    });
    if (!existing) {
      await tx.enrollment.create({
        data: { userId: session.id, courseId: order.courseId },
      });
      await tx.course.update({
        where: { id: order.courseId },
        data: { studentCount: { increment: 1 } },
      });
    }
  });

  return NextResponse.json({ slug: order.course.slug });
}

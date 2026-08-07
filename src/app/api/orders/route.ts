/**
 * POST /api/orders —— 创建订单并可选叠加优惠券。
 * 优惠在下单时写入 order.discount / order.amount；支付回调只履约不重算价。
 * 专栏套餐：免费/0 元直开时同步开通所含单课。
 * 商城 PRODUCT：允许复购（不因已有 enrollment 拦截）；支持 quantity / specLabel。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { grantProductAccess } from "@/lib/course-bundle";
import {
  calcCouponDiscount,
  normalizeCouponCode,
  validateCouponForOrder,
} from "@/lib/coupons";
import { prisma } from "@/lib/db";
import {
  stringifyStoredAnswers,
  validateOrderFormAnswers,
} from "@/lib/order-form";
import { buildSpecLabel, parseSpecs, SHOP_PRODUCT_TYPE } from "@/lib/shop";
import { getOrderFormConfig } from "@/lib/site-settings";
import { makeOrderNo } from "@/lib/utils";

const schema = z.object({
  courseId: z.string().min(1),
  couponCode: z.string().optional(),
  /** 也可直接传券 id（购买页点选可用券） */
  couponId: z.string().optional(),
  formAnswers: z.record(z.string(), z.string()).optional(),
  /** 购买数量；商城默认可 >1，课程仍建议 1 */
  quantity: z.number().int().min(1).max(99).optional(),
  /** 规格点选：规格名 → 值 */
  specSelected: z.record(z.string(), z.string()).optional(),
  /** 或直接传已拼好的规格文案（购物车结算） */
  specLabel: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());
    const course = await prisma.course.findUnique({
      where: { id: body.courseId },
    });
    if (!course || course.status !== "PUBLISHED") {
      return NextResponse.json({ error: "商品不存在" }, { status: 404 });
    }

    const isShopProduct = course.productType === SHOP_PRODUCT_TYPE;
    const quantity = body.quantity ?? 1;

    // 数字课/资料：已购则直接开通；商城商品允许复购（实体/服务可多次下单）
    if (!isShopProduct) {
      const existing = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: { userId: session.id, courseId: course.id },
        },
      });
      if (existing) {
        await grantProductAccess(prisma, {
          userId: session.id,
          productId: course.id,
        });
        return NextResponse.json({ enrolled: true, slug: course.slug });
      }
    }

    let specLabel = (body.specLabel || "").trim();
    if (!specLabel) {
      const specs = parseSpecs(course.specsJson);
      const built = buildSpecLabel(specs, body.specSelected);
      if (!built.ok) {
        return NextResponse.json({ error: built.error }, { status: 400 });
      }
      specLabel = built.label;
    } else if (isShopProduct) {
      // 购物车带来的快照：若商品仍配置规格，空快照视为未选
      const specs = parseSpecs(course.specsJson);
      if (specs.options.length > 0 && !specLabel) {
        return NextResponse.json({ error: "请选择规格" }, { status: 400 });
      }
    }

    const orderForm = await getOrderFormConfig();
    const answersCheck = validateOrderFormAnswers(orderForm, body.formAnswers);
    if (!answersCheck.ok) {
      return NextResponse.json({ error: answersCheck.error }, { status: 400 });
    }
    const formAnswersJson = stringifyStoredAnswers(answersCheck.stored);

    const linePrice = course.price * quantity;

    if (course.isFree || linePrice <= 0) {
      await prisma.$transaction(async (tx) => {
        await tx.order.create({
          data: {
            orderNo: makeOrderNo(),
            userId: session.id,
            courseId: course.id,
            quantity,
            specLabel,
            amount: 0,
            discount: 0,
            status: "PAID",
            payChannel: "FREE",
            formAnswersJson,
            paidAt: new Date(),
          },
        });
        await grantProductAccess(tx, {
          userId: session.id,
          productId: course.id,
        });
        // 商城销量：用 studentCount 作「已售」占位
        if (isShopProduct) {
          await tx.course.update({
            where: { id: course.id },
            data: { studentCount: { increment: quantity } },
          });
        }
      });
      return NextResponse.json({
        enrolled: true,
        slug: course.slug,
        productType: course.productType,
      });
    }

    let discount = 0;
    let couponId: string | undefined;

    const wantsCoupon = Boolean(
      body.couponCode?.trim() || body.couponId?.trim(),
    );
    if (wantsCoupon) {
      const couponInclude = {
        products: { select: { courseId: true } },
      } as const;
      const couponRow = body.couponId?.trim()
        ? await prisma.coupon.findUnique({
            where: { id: body.couponId.trim() },
            include: couponInclude,
          })
        : await prisma.coupon.findUnique({
            where: { code: normalizeCouponCode(body.couponCode || "") },
            include: couponInclude,
          });

      const coupon = couponRow
        ? {
            ...couponRow,
            productIds: couponRow.products.map((p) => p.courseId),
          }
        : null;

      // 券校验按「单价」门槛；减免按行小计再算
      const availability = validateCouponForOrder(
        coupon,
        linePrice,
        new Date(),
        course.id,
      );
      if (availability || !coupon) {
        return NextResponse.json(
          { error: availability || "优惠券不可用" },
          { status: 400 },
        );
      }

      const redeemed = await prisma.couponRedemption.findUnique({
        where: {
          couponId_userId: { couponId: coupon.id, userId: session.id },
        },
      });
      if (redeemed) {
        return NextResponse.json(
          { error: "该优惠券已使用过" },
          { status: 400 },
        );
      }

      discount = calcCouponDiscount(linePrice, coupon);
      couponId = coupon.id;
    }

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    const amount = Math.max(linePrice - discount, 0);

    // 券额 ≥ 应付原价时 amount=0：直接 PAID 并开通，无需走微信/支付宝
    const order = await prisma.order.create({
      data: {
        orderNo: makeOrderNo(),
        userId: session.id,
        courseId: course.id,
        quantity,
        specLabel,
        amount,
        discount,
        couponId,
        formAnswersJson,
        referralCode: user?.referredById
          ? (
              await prisma.user.findUnique({
                where: { id: user.referredById },
              })
            )?.referralCode
          : undefined,
        status: amount === 0 ? "PAID" : "PENDING",
        paidAt: amount === 0 ? new Date() : undefined,
        // 0 元券单与免费单区分渠道，便于订单列表识别
        payChannel: amount === 0 ? (couponId ? "COUPON" : "FREE") : undefined,
      },
    });

    if (amount === 0) {
      await prisma.$transaction(async (tx) => {
        if (couponId) {
          await tx.coupon.update({
            where: { id: couponId },
            data: { usedCount: { increment: 1 } },
          });
          await tx.couponRedemption.create({
            data: { couponId, userId: session.id },
          });
        }
        await grantProductAccess(tx, {
          userId: session.id,
          productId: course.id,
        });
        if (isShopProduct) {
          await tx.course.update({
            where: { id: course.id },
            data: { studentCount: { increment: quantity } },
          });
        }
      });
      return NextResponse.json({
        enrolled: true,
        zeroPay: true,
        slug: course.slug,
        productType: course.productType,
      });
    }

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      discount: order.discount,
      productType: course.productType,
    });
  } catch {
    return NextResponse.json({ error: "下单失败" }, { status: 400 });
  }
}

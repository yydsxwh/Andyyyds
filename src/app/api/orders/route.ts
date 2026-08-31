/**
 * POST /api/orders —— 创建订单并可选叠加优惠券。
 * 优惠在下单时写入 order.discount / order.amount；支付回调只履约不重算价。
 * 专栏套餐：免费/0 元直开时同步开通所含单课。
 * 商城 PRODUCT：允许复购（不因已有 enrollment 拦截）；支持 quantity / specLabel。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import { grantProductAccess } from "@andyyyds/courses/lib/course-bundle";
import {
  calcCouponDiscount,
  normalizeCouponCode,
  validateCouponForOrder,
} from "@andyyyds/shared/coupons";
import { prisma } from "@andyyyds/shared/db";
import { fromMeetupPeopleDb, MEETUP_PRODUCT_TYPE } from "@andyyyds/meetup/lib/meetup";
import { sumMeetupPartySize } from "@andyyyds/meetup/lib/meetup-service-contact";
import {
  stringifyStoredAnswers,
  validateOrderFormAnswers,
} from "@andyyyds/shared/order-form";
import { buildSpecLabel, parseSpecs, SHOP_PRODUCT_TYPE } from "@andyyyds/shared/shop";
import { getOrderFormConfig } from "@andyyyds/shared/site-settings";
import { makeOrderNo } from "@andyyyds/shared/utils";

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
  /** 分享链 ?ref= 带来的邀请码；优先于注册上级，便于约搭/课程分销归因 */
  referralCode: z.string().max(32).optional(),
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
    const isMeetupProduct = course.productType === MEETUP_PRODUCT_TYPE;
    // 约搭 quantity=占用名额；单账号上限 10，与详情步进器一致
    const quantity = isMeetupProduct
      ? Math.min(10, Math.max(1, body.quantity ?? 1))
      : (body.quantity ?? 1);

    // 约搭：下单前校验余位，避免付款后无法履约
    if (isMeetupProduct) {
      const meetup = await prisma.meetup.findFirst({
        where: { productCourseId: course.id },
        include: { joins: { select: { partySize: true } } },
      });
      if (!meetup || meetup.status === "CANCELLED") {
        return NextResponse.json({ error: "活动不可报名" }, { status: 400 });
      }
      if (meetup.status !== "OPEN") {
        return NextResponse.json(
          { error: meetup.status === "FULL" ? "已满员" : "报名已截止" },
          { status: 400 },
        );
      }
      const occupied = sumMeetupPartySize(meetup.joins);
      const maxPeople = fromMeetupPeopleDb(meetup.maxPeople);
      if (occupied + quantity > maxPeople) {
        return NextResponse.json(
          { error: "余位不足，请减少人数后再试" },
          { status: 400 },
        );
      }
    }

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

    // 分销归因：下单带的 ref 优先，否则用注册邀请上级的码（与结算 resolveReferrer 一致）
    const fromBody = (body.referralCode || "").trim().slice(0, 32);
    let referralCode: string | undefined = fromBody || undefined;
    if (!referralCode && user?.referredById) {
      const inviter = await prisma.user.findUnique({
        where: { id: user.referredById },
        select: { referralCode: true },
      });
      referralCode = inviter?.referralCode || undefined;
    }

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
        referralCode,
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

/**
 * GET/POST /api/studio/coupons —— 优惠券列表与创建
 * 权限：站长 / 入驻商家 / 加盟代理（canManageCoupons）
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  couponProductsInclude,
  serializeStudioCoupon,
} from "@andyyyds/shared/coupon-serialize";
import {
  isCouponProductScope,
  isCouponType,
  normalizeCouponCode,
  validateCouponProductScopeInput,
  validateCouponValueInput,
} from "@andyyyds/shared/coupons";
import { prisma } from "@andyyyds/shared/db";
import { canManageCoupons, canViewAllStudioData } from "@andyyyds/shared/roles";
import { requireStudioUser, studioErrorResponse } from "@andyyyds/shared/studio";

export async function GET() {
  try {
    const session = await requireStudioUser();
    if (!canManageCoupons(session.role)) {
      return NextResponse.json({ error: "无权管理优惠券" }, { status: 403 });
    }

    // 站长看全部；商家/代理暂看自己创建的（兼容旧券 createdById 为空时站长可见）
    const seeAll = canViewAllStudioData(session.role);
    const coupons = await prisma.coupon.findMany({
      where: seeAll ? undefined : { createdById: session.id },
      include: couponProductsInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({
      coupons: coupons.map(serializeStudioCoupon),
    });
  } catch (error) {
    const { status, error: message } = studioErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

const createSchema = z.object({
  code: z.string().min(2).max(32),
  title: z.string().min(1).max(80),
  type: z.string(),
  /** 定额：元（前端传元，后端转分） */
  discountYuan: z.number().optional(),
  /** 比例：1–99 */
  percentOff: z.number().int().optional(),
  minAmountYuan: z.number().optional(),
  maxUses: z.number().int().min(1).max(1_000_000).optional(),
  maxPerUser: z.number().int().min(1).max(100).optional(),
  startsAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  /** ALL | SELECTED */
  productScope: z.string().optional(),
  /** SELECTED 时的商品 id 列表（1 个=单品，多个=多选） */
  productIds: z.array(z.string()).optional(),
});

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error("DATE_INVALID");
  }
  return d;
}

export async function POST(req: Request) {
  try {
    const session = await requireStudioUser();
    if (!canManageCoupons(session.role)) {
      return NextResponse.json({ error: "无权管理优惠券" }, { status: 403 });
    }

    const body = createSchema.parse(await req.json());
    if (!isCouponType(body.type)) {
      return NextResponse.json({ error: "优惠类型无效" }, { status: 400 });
    }

    const productScope = body.productScope || "ALL";
    if (!isCouponProductScope(productScope)) {
      return NextResponse.json({ error: "商品适用范围无效" }, { status: 400 });
    }

    const productIds = Array.from(
      new Set((body.productIds || []).map((id) => id.trim()).filter(Boolean)),
    );
    const scopeErr = validateCouponProductScopeInput({
      productScope,
      productIds,
    });
    if (scopeErr) {
      return NextResponse.json({ error: scopeErr }, { status: 400 });
    }

    if (productScope === "SELECTED" && productIds.length > 0) {
      const seeAll = canViewAllStudioData(session.role);
      const ownedCount = await prisma.course.count({
        where: {
          id: { in: productIds },
          ...(seeAll ? {} : { teacherId: session.id }),
        },
      });
      if (ownedCount !== productIds.length) {
        return NextResponse.json(
          { error: "部分商品不存在或无权设置优惠券" },
          { status: 400 },
        );
      }
    }

    const discountCents =
      body.type === "FIXED"
        ? Math.round((body.discountYuan ?? 0) * 100)
        : 0;
    const percentOff = body.type === "PERCENT" ? (body.percentOff ?? 0) : 0;

    const valueErr = validateCouponValueInput({
      type: body.type,
      discountCents,
      percentOff,
    });
    if (valueErr) {
      return NextResponse.json({ error: valueErr }, { status: 400 });
    }

    let startsAt: Date | null = null;
    let expiresAt: Date | null = null;
    try {
      startsAt = parseOptionalDate(body.startsAt);
      expiresAt = parseOptionalDate(body.expiresAt);
    } catch {
      return NextResponse.json({ error: "有效期格式无效" }, { status: 400 });
    }
    if (startsAt && expiresAt && expiresAt < startsAt) {
      return NextResponse.json({ error: "结束时间不能早于开始时间" }, { status: 400 });
    }

    const code = normalizeCouponCode(body.code);
    if (code.length < 2) {
      return NextResponse.json({ error: "券码至少 2 个字符" }, { status: 400 });
    }

    const minAmount = Math.max(0, Math.round((body.minAmountYuan ?? 0) * 100));

    const coupon = await prisma.coupon.create({
      data: {
        code,
        title: body.title.trim(),
        type: body.type,
        discountCents,
        percentOff,
        minAmount,
        maxUses: body.maxUses ?? 100,
        maxPerUser: body.maxPerUser ?? 1,
        startsAt,
        expiresAt,
        isActive: body.isActive ?? true,
        productScope,
        createdById: session.id,
        ...(productScope === "SELECTED"
          ? {
              products: {
                create: productIds.map((courseId) => ({ courseId })),
              },
            }
          : {}),
      },
      include: couponProductsInclude,
    });

    return NextResponse.json({ coupon: serializeStudioCoupon(coupon) });
  } catch (error) {
    const { status, error: message } = studioErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

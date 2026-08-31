/**
 * PATCH /api/studio/coupons/[id] —— 更新 / 启停优惠券
 * DELETE —— 删除（已有订单关联时仅建议停用，删除会因外键失败则提示）
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

type Ctx = { params: Promise<{ id: string }> };

async function loadOwnedCoupon(id: string, userId: string, role: string) {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: couponProductsInclude,
  });
  if (!coupon) return { error: "优惠券不存在" as const, coupon: null };
  if (!canViewAllStudioData(role) && coupon.createdById !== userId) {
    return { error: "无权操作该优惠券" as const, coupon: null };
  }
  return { error: null, coupon };
}

const patchSchema = z.object({
  code: z.string().min(2).max(32).optional(),
  title: z.string().min(1).max(80).optional(),
  type: z.string().optional(),
  discountYuan: z.number().optional(),
  percentOff: z.number().int().optional(),
  minAmountYuan: z.number().optional(),
  maxUses: z.number().int().min(1).max(1_000_000).optional(),
  maxPerUser: z.number().int().min(1).max(100).optional(),
  startsAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  productScope: z.string().optional(),
  productIds: z.array(z.string()).optional(),
});

function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value == null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("DATE_INVALID");
  return d;
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const session = await requireStudioUser();
    if (!canManageCoupons(session.role)) {
      return NextResponse.json({ error: "无权管理优惠券" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const owned = await loadOwnedCoupon(id, session.id, session.role);
    if (!owned.coupon) {
      return NextResponse.json({ error: owned.error }, { status: 404 });
    }

    const body = patchSchema.parse(await req.json());
    const nextType = body.type ?? owned.coupon.type;
    if (!isCouponType(nextType)) {
      return NextResponse.json({ error: "优惠类型无效" }, { status: 400 });
    }

    let discountCents = owned.coupon.discountCents;
    let percentOff = owned.coupon.percentOff;

    if (nextType === "FIXED") {
      if (body.discountYuan !== undefined) {
        discountCents = Math.round(body.discountYuan * 100);
      }
      percentOff = 0;
    } else {
      if (body.percentOff !== undefined) {
        percentOff = body.percentOff;
      }
      discountCents = 0;
    }

    const valueErr = validateCouponValueInput({
      type: nextType,
      discountCents,
      percentOff,
    });
    if (valueErr) {
      return NextResponse.json({ error: valueErr }, { status: 400 });
    }

    let startsAt: Date | null | undefined;
    let expiresAt: Date | null | undefined;
    try {
      startsAt = parseOptionalDate(body.startsAt);
      expiresAt = parseOptionalDate(body.expiresAt);
    } catch {
      return NextResponse.json({ error: "有效期格式无效" }, { status: 400 });
    }

    const finalStarts =
      startsAt === undefined ? owned.coupon.startsAt : startsAt;
    const finalExpires =
      expiresAt === undefined ? owned.coupon.expiresAt : expiresAt;
    if (finalStarts && finalExpires && finalExpires < finalStarts) {
      return NextResponse.json({ error: "结束时间不能早于开始时间" }, { status: 400 });
    }

    const nextScopeRaw =
      body.productScope ?? owned.coupon.productScope ?? "ALL";
    if (!isCouponProductScope(nextScopeRaw)) {
      return NextResponse.json({ error: "商品适用范围无效" }, { status: 400 });
    }
    const nextScope = nextScopeRaw;

    const existingIds = owned.coupon.products.map((p) => p.courseId);
    const nextProductIds =
      body.productIds !== undefined
        ? Array.from(
            new Set(body.productIds.map((x) => x.trim()).filter(Boolean)),
          )
        : existingIds;

    if (body.productScope !== undefined || body.productIds !== undefined) {
      const scopeErr = validateCouponProductScopeInput({
        productScope: nextScope,
        productIds: nextScope === "SELECTED" ? nextProductIds : [],
      });
      if (scopeErr) {
        return NextResponse.json({ error: scopeErr }, { status: 400 });
      }
      if (nextScope === "SELECTED" && nextProductIds.length > 0) {
        const seeAll = canViewAllStudioData(session.role);
        const ownedCount = await prisma.course.count({
          where: {
            id: { in: nextProductIds },
            ...(seeAll ? {} : { teacherId: session.id }),
          },
        });
        if (ownedCount !== nextProductIds.length) {
          return NextResponse.json(
            { error: "部分商品不存在或无权设置优惠券" },
            { status: 400 },
          );
        }
      }
    }

    const coupon = await prisma.$transaction(async (tx) => {
      await tx.coupon.update({
        where: { id },
        data: {
          ...(body.code !== undefined
            ? { code: normalizeCouponCode(body.code) }
            : {}),
          ...(body.title !== undefined ? { title: body.title.trim() } : {}),
          type: nextType,
          discountCents,
          percentOff,
          ...(body.minAmountYuan !== undefined
            ? { minAmount: Math.max(0, Math.round(body.minAmountYuan * 100)) }
            : {}),
          ...(body.maxUses !== undefined ? { maxUses: body.maxUses } : {}),
          ...(body.maxPerUser !== undefined
            ? { maxPerUser: body.maxPerUser }
            : {}),
          ...(startsAt !== undefined ? { startsAt } : {}),
          ...(expiresAt !== undefined ? { expiresAt } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.productScope !== undefined || body.productIds !== undefined
            ? { productScope: nextScope }
            : {}),
        },
      });

      // 改范围时整体替换关联，避免残留旧商品导致错用券
      if (body.productScope !== undefined || body.productIds !== undefined) {
        await tx.couponProduct.deleteMany({ where: { couponId: id } });
        if (nextScope === "SELECTED" && nextProductIds.length > 0) {
          await tx.couponProduct.createMany({
            data: nextProductIds.map((courseId) => ({
              couponId: id,
              courseId,
            })),
          });
        }
      }

      return tx.coupon.findUniqueOrThrow({
        where: { id },
        include: couponProductsInclude,
      });
    });

    return NextResponse.json({ coupon: serializeStudioCoupon(coupon) });
  } catch (error) {
    const { status, error: message } = studioErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const session = await requireStudioUser();
    if (!canManageCoupons(session.role)) {
      return NextResponse.json({ error: "无权管理优惠券" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const owned = await loadOwnedCoupon(id, session.id, session.role);
    if (!owned.coupon) {
      return NextResponse.json({ error: owned.error }, { status: 404 });
    }

    // 已绑定订单时 SQLite 外键可能阻止删除；优先建议停用
    const orderCount = await prisma.order.count({ where: { couponId: id } });
    if (orderCount > 0) {
      await prisma.coupon.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        ok: true,
        deactivated: true,
        message: "该券已有订单使用，已改为停用而非删除",
      });
    }

    await prisma.coupon.delete({ where: { id } });
    return NextResponse.json({ ok: true, deactivated: false });
  } catch (error) {
    const { status, error: message } = studioErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

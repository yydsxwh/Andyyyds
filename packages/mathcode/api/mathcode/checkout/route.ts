/**
 * POST /api/mathcode/checkout
 * 识图专用下单：不走 /api/orders（那边会拦复购、数量上限 99）。
 * 会员可反复开通；按页单的 quantity = 页数，金额 = 0.5 元 × 页数。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateMathcodeAccess, getOrCreateMathcodeWallet } from "@andyyyds/mathcode/lib/mathcode-billing";
import { ensureMathcodeSkus } from "@andyyyds/mathcode/lib/mathcode-skus";
import {
  MATHCODE_GUEST_CENTS_PER_PAGE,
  MATHCODE_MAX_PAY_PAGES,
  MATHCODE_MEMBERSHIP_CENTS,
} from "@andyyyds/mathcode/lib/mathcode-quota";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { isAdmin } from "@andyyyds/shared/roles";
import { makeOrderNo } from "@andyyyds/shared/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["membership", "pages"]),
  pageCount: z.number().int().min(1).max(MATHCODE_MAX_PAY_PAGES).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (isAdmin(session)) {
    return NextResponse.json({ error: "站长无需购买，可直接转换" }, { status: 400 });
  }

  try {
    const body = schema.parse(await req.json());
    const skus = await ensureMathcodeSkus(prisma);

    if (body.kind === "membership") {
      const order = await reuseOrCreateOrder({
        userId: session.id,
        courseId: skus.membership.id,
        quantity: 1,
        amount: MATHCODE_MEMBERSHIP_CENTS,
        specLabel: "包月会员 150页",
      });
      return NextResponse.json({
        orderId: order.id,
        amount: order.amount,
        kind: "membership",
      });
    }

    const wallet = await getOrCreateMathcodeWallet(prisma, session.id);
    const decision = evaluateMathcodeAccess({
      session,
      wallet,
      pageCount: 0,
    });
    // 会员期内不能再按 0.5 元散买补差，只能续费会员
    if (decision.memberActive) {
      return NextResponse.json(
        {
          error: "会员期内额度不足请再开通会员，不能按 0.5 元/页补差",
          code: "NEED_RENEW",
        },
        { status: 402 },
      );
    }

    const pageCount = body.pageCount ?? 0;
    if (pageCount < 1) {
      return NextResponse.json({ error: "请填写要购买的页数" }, { status: 400 });
    }

    const order = await reuseOrCreateOrder({
      userId: session.id,
      courseId: skus.page.id,
      quantity: pageCount,
      amount: pageCount * MATHCODE_GUEST_CENTS_PER_PAGE,
      specLabel: `${pageCount}页`,
    });
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      kind: "pages",
      pageCount,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "MATHCODE_SKU_NO_ADMIN"
        ? "站点尚未配置站长账号，暂时无法下单"
        : "下单失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function reuseOrCreateOrder(input: {
  userId: string;
  courseId: string;
  quantity: number;
  amount: number;
  specLabel: string;
}) {
  const pending = await prisma.order.findFirst({
    where: {
      userId: input.userId,
      courseId: input.courseId,
      status: "PENDING",
      amount: input.amount,
      quantity: input.quantity,
    },
    orderBy: { createdAt: "desc" },
  });
  if (pending) return pending;

  return prisma.order.create({
    data: {
      orderNo: makeOrderNo(),
      userId: input.userId,
      courseId: input.courseId,
      quantity: input.quantity,
      specLabel: input.specLabel,
      amount: input.amount,
      discount: 0,
      status: "PENDING",
    },
  });
}

/**
 * GET  /api/mathcode/access  当前额度与定价
 * POST /api/mathcode/access  判断这一批 n 页能不能直接转（402=先付费/续费）
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertMathcodeCanConsume,
  loadMathcodeAccessSnapshot,
  mathcodeQuotaHttpBody,
} from "@andyyyds/mathcode/lib/mathcode-billing";
import { ensureMathcodeSkus } from "@andyyyds/mathcode/lib/mathcode-skus";
import { MATHCODE_MAX_PAY_PAGES, MATHCODE_PRICING } from "@andyyyds/mathcode/lib/mathcode-quota";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { getPaymentChannels } from "@andyyyds/shared/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postSchema = z.object({
  pageCount: z.number().int().min(0).max(MATHCODE_MAX_PAY_PAGES),
});

export async function GET() {
  const [session, channels] = await Promise.all([
    getSession(),
    getPaymentChannels(),
  ]);
  try {
    await ensureMathcodeSkus(prisma);
  } catch {
    // 本地无站长账号时仍返回定价，下单时再报错
  }

  if (!session) {
    return NextResponse.json({
      loggedIn: false,
      unlimited: false,
      memberActive: false,
      memberPages: 0,
      guestPages: 0,
      available: 0,
      memberUntil: null,
      pricing: MATHCODE_PRICING,
      channels,
    });
  }

  const access = await loadMathcodeAccessSnapshot(prisma, session);
  return NextResponse.json({ ...access, channels });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录", code: "NEED_LOGIN" }, { status: 401 });
  }

  try {
    const body = postSchema.parse(await req.json());
    const decision = await assertMathcodeCanConsume(prisma, session, body.pageCount);
    if (!decision.ok) {
      return NextResponse.json(mathcodeQuotaHttpBody(decision), { status: 402 });
    }
    return NextResponse.json(mathcodeQuotaHttpBody(decision));
  } catch {
    return NextResponse.json({ error: "无法校验额度" }, { status: 400 });
  }
}

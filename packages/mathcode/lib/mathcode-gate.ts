/**
 * 识图 API 共用：登录校验 + 扣页前检查 + 成功后扣 1 页。
 * Office 拆文档不走这里（只登录、不扣页）。
 */

import { NextResponse } from "next/server";
import {
  assertMathcodeCanConsume,
  consumeMathcodePage,
  MathcodeQuotaError,
  mathcodeQuotaHttpBody,
} from "@andyyyds/mathcode/lib/mathcode-billing";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";

export async function requireMathcodeSession() {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: "请先登录", code: "NEED_LOGIN" }, { status: 401 }),
    };
  }
  return { session, error: null };
}

export async function requireMathcodePageCredit(
  session: { id: string; role: string; roles: string[] },
) {
  const decision = await assertMathcodeCanConsume(prisma, session, 1);
  if (!decision.ok) {
    return NextResponse.json(mathcodeQuotaHttpBody(decision), { status: 402 });
  }
  return null;
}

export async function chargeMathcodePageAfterSuccess(
  session: { id: string; role: string; roles: string[] },
  unitLabel: string,
) {
  try {
    await consumeMathcodePage(prisma, session, unitLabel);
    return null;
  } catch (error) {
    if (error instanceof MathcodeQuotaError) {
      return NextResponse.json(mathcodeQuotaHttpBody(error.decision), { status: 402 });
    }
    throw error;
  }
}

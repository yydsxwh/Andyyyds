/**
 * POST /api/auth/kk
 * body: { kkNumber, password }
 *
 * 历史学员编号 + 密码登录。不开放由此通道注册，避免自造 KK 号。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { loginUserByKkNumber } from "@andyyyds/shared/auth-providers";

const schema = z.object({
  kkNumber: z.string().min(1).max(16),
  password: z.string().min(6).max(100),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const { result } = await loginUserByKkNumber({
      kkNumber: body.kkNumber,
      password: body.password,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

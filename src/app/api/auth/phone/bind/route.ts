/**
 * POST /api/auth/phone/bind
 * 已登录用户绑定手机号（验证码 purpose=bind）。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { bindPhoneToUser } from "@/lib/auth-providers";
import { isValidCnMobile, normalizePhone } from "@/lib/phone";
import { verifySmsCode } from "@/lib/sms";

const schema = z.object({
  phone: z.string().min(6).max(20),
  code: z.string().min(4).max(8),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    const body = schema.parse(await req.json());
    const phone = normalizePhone(body.phone);
    if (!isValidCnMobile(phone)) {
      return NextResponse.json({ error: "请输入正确的手机号" }, { status: 400 });
    }
    const ok = await verifySmsCode({
      phone,
      code: body.code,
      purpose: "bind",
    });
    if (!ok) {
      return NextResponse.json(
        { error: "验证码错误或已过期" },
        { status: 400 },
      );
    }
    await bindPhoneToUser({ userId: session.id, phone });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "绑定失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

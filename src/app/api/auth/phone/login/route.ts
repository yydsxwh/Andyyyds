/**
 * POST /api/auth/phone/login
 * body: { phone, code, mode?, name?, password?, referralCode?, requestedRole? }
 *
 * mode=login（默认）：验证码通过后登录；无账号则自动注册学员。
 * mode=register：验证码通过后创建账号（可含身份申请）；已注册则提示去登录。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { findOrCreateUserByPhone } from "@/lib/auth-providers";
import { isValidCnMobile, normalizePhone } from "@/lib/phone";
import { APPLYABLE_ROLES } from "@/lib/roles";
import { verifySmsCode } from "@/lib/sms";

const schema = z.object({
  phone: z.string().min(6).max(20),
  code: z.string().min(4).max(8),
  mode: z.enum(["login", "register"]).optional().default("login"),
  name: z.string().max(40).optional(),
  /** 可选：注册时同时设密码 */
  password: z.string().min(6).max(100).optional().or(z.literal("")),
  referralCode: z.string().max(32).optional(),
  requestedRole: z.enum(APPLYABLE_ROLES).optional().default("STUDENT"),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const phone = normalizePhone(body.phone);
    if (!isValidCnMobile(phone)) {
      return NextResponse.json({ error: "请输入正确的手机号" }, { status: 400 });
    }
    const ok = await verifySmsCode({
      phone,
      code: body.code,
      purpose: "login",
    });
    if (!ok) {
      return NextResponse.json(
        { error: "验证码错误或已过期" },
        { status: 400 },
      );
    }

    if (body.mode === "register" && !(body.name || "").trim()) {
      return NextResponse.json({ error: "请填写昵称" }, { status: 400 });
    }

    const { result } = await findOrCreateUserByPhone({
      phone,
      name: body.name,
      password: body.password || undefined,
      referralCode: body.referralCode,
      requestedRole: body.requestedRole,
      mode: body.mode,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "登录失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

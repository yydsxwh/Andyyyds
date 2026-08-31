/**
 * POST /api/auth/account
 * body: { username, password, mode?, name?, referralCode?, requestedRole? }
 *
 * 账号 + 密码注册/登录（与邮箱通道分开，不接受邮箱当地址）。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  loginUserByUsername,
  registerUserByUsername,
} from "@andyyyds/shared/auth-providers";
import { APPLYABLE_ROLES } from "@andyyyds/shared/roles";

const schema = z.object({
  username: z.string().min(1).max(40),
  password: z.string().min(6).max(100),
  mode: z.enum(["login", "register"]).optional().default("login"),
  name: z.string().max(40).optional(),
  referralCode: z.string().max(32).optional(),
  requestedRole: z.enum(APPLYABLE_ROLES).optional().default("STUDENT"),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const mode = body.mode || "login";

    if (mode === "register") {
      const { result } = await registerUserByUsername({
        username: body.username,
        password: body.password,
        name: body.name || "",
        referralCode: body.referralCode,
        requestedRole: body.requestedRole,
      });
      return NextResponse.json(result);
    }

    const { result } = await loginUserByUsername({
      username: body.username,
      password: body.password,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "操作失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

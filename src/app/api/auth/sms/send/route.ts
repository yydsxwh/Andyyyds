/**
 * POST /api/auth/sms/send
 * body: { phone, purpose?: "login" | "bind" }
 * 发送短信验证码；测试模式下码写入服务端日志。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import { sendSmsCode } from "@andyyyds/shared/sms";

const schema = z.object({
  phone: z.string().min(6).max(20),
  purpose: z.enum(["login", "bind"]).optional().default("login"),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    if (body.purpose === "bind") {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 });
      }
    }
    const result = await sendSmsCode({
      phone: body.phone,
      purpose: body.purpose,
    });
    return NextResponse.json({
      ok: true,
      cooldownSec: result.cooldownSec,
      // 仅告知是否测试模式，不返回验证码本身
      testMode: result.testMode,
      message: result.testMode
        ? "测试模式：验证码已写入服务器日志（或使用系统设置中的固定测试码）"
        : "验证码已发送",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "发送失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

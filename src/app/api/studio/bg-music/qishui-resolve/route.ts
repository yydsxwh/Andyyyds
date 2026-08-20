/**
 * POST /api/studio/bg-music/qishui-resolve
 * 站长粘贴汽水分享短链 → 解析 track_id / 曲名 / 封面。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveQishuiShare } from "@/lib/bg-music-qishui";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";

export const runtime = "nodejs";

const schema = z.object({
  input: z.string().min(1).max(2000),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = schema.parse(await req.json());
    const result = await resolveQishuiShare(body.input);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "请粘贴汽水音乐分享链接" }, { status: 400 });
    }
    if (error instanceof Error && error.message) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

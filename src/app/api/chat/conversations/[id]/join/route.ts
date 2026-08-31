import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import {
  acceptGroupInvite,
  rejectGroupInvite,
} from "@andyyyds/shared/chat/group-service";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["accept", "reject"]),
});

/** 同意/拒绝群邀请 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const body = schema.parse(await req.json());
    if (body.action === "accept") {
      await acceptGroupInvite(id, session.id);
    } else {
      await rejectGroupInvite(id, session.id);
    }
    return NextResponse.json({ ok: true, action: body.action });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "操作失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import { setGroupAnnouncement } from "@andyyyds/shared/chat/group-service";

export const dynamic = "force-dynamic";

const schema = z.object({
  text: z.string().max(1000),
});

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
    const result = await setGroupAnnouncement({
      conversationId: id,
      actorId: session.id,
      text: body.text,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "设置失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

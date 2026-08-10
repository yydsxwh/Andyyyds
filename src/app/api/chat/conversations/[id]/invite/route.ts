import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { inviteUsersToGroup } from "@/lib/chat/group-service";

export const dynamic = "force-dynamic";

const schema = z.object({
  inviteeIds: z.array(z.string().min(1)).min(1).max(40),
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
    const result = await inviteUsersToGroup({
      conversationId: id,
      actorId: session.id,
      inviteeIds: body.inviteeIds,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "邀请失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

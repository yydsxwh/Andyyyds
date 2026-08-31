import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { acceptDirectChat } from "@andyyyds/shared/chat/service";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const conversation = await acceptDirectChat(id, session.id);
    return NextResponse.json({
      conversationId: conversation.id,
      status: conversation.status,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "操作失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

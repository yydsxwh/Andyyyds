import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { recallMessage } from "@andyyyds/shared/chat/service";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; messageId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const { id, messageId } = await ctx.params;
  try {
    const result = await recallMessage({
      conversationId: id,
      messageId,
      userId: session.id,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "撤回失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

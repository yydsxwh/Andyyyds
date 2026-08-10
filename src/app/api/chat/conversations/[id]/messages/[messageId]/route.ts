import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hideMessageLocally } from "@/lib/chat/service";

export const dynamic = "force-dynamic";

/** 本地删除：仅对自己隐藏该条消息 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; messageId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const { id, messageId } = await ctx.params;
  try {
    const result = await hideMessageLocally({
      conversationId: id,
      messageId,
      userId: session.id,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "删除失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

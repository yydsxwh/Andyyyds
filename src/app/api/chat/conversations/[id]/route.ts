import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getConversationForUser } from "@/lib/chat/service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const conversation = await getConversationForUser(id, session.id);
    return NextResponse.json({ conversation });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

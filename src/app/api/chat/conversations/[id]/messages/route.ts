import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import { listMessages, sendTextMessage } from "@andyyyds/shared/chat/service";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  try {
    const messages = await listMessages({
      conversationId: id,
      userId: session.id,
      beforeId: sp.get("before") || undefined,
      limit: Number(sp.get("limit") || 50) || 50,
    });
    return NextResponse.json({ messages });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

const postSchema = z.object({
  body: z.string().min(1).max(2000),
  mentionIds: z.array(z.string().min(1)).max(20).optional(),
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
    const body = postSchema.parse(await req.json());
    const message = await sendTextMessage({
      conversationId: id,
      senderId: session.id,
      body: body.body,
      mentionIds: body.mentionIds,
    });
    return NextResponse.json({ message });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "发送失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

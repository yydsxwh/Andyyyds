import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import { createGroupChat } from "@andyyyds/shared/chat/group-service";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(1).max(40),
  inviteeIds: z.array(z.string().min(1)).min(1).max(40),
});

/** 创建群聊并邀请用户（对方同意后进群） */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const body = schema.parse(await req.json());
    const conversation = await createGroupChat({
      ownerId: session.id,
      title: body.title,
      inviteeIds: body.inviteeIds,
    });
    return NextResponse.json({ conversationId: conversation.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "创建失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import { CHAT_SOURCE, isChatSource } from "@andyyyds/shared/chat/constants";
import {
  listConversationsForUser,
  requestDirectChat,
} from "@andyyyds/shared/chat/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const conversations = await listConversationsForUser(session.id);
  return NextResponse.json({ conversations });
}

const requestSchema = z.object({
  peerUserId: z.string().min(1),
  source: z.string().optional(),
  relatedCourseId: z.string().optional(),
  relatedMeetupId: z.string().optional(),
});

/** 发起私聊请求（待对方确认） */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const body = requestSchema.parse(await req.json());
    const sourceRaw = body.source || CHAT_SOURCE.USER_SEARCH;
    const source = isChatSource(sourceRaw)
      ? sourceRaw
      : CHAT_SOURCE.USER_SEARCH;
    const result = await requestDirectChat({
      requesterId: session.id,
      peerUserId: body.peerUserId,
      source,
      relatedCourseId: body.relatedCourseId,
      relatedMeetupId: body.relatedMeetupId,
    });
    return NextResponse.json({
      conversationId: result.conversation.id,
      status: result.conversation.status,
      created: result.created,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "发起失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

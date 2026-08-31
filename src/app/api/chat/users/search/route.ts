import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { assertSocialChatEnabled } from "@andyyyds/shared/chat/policy";
import { searchUsersForChat } from "@andyyyds/shared/chat/service";

export const dynamic = "force-dynamic";

/** 按昵称搜索可发起私聊的用户（合规隐藏社交找人时拒绝） */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    await assertSocialChatEnabled();
    const q = new URL(req.url).searchParams.get("q") || "";
    const users = await searchUsersForChat(session.id, q);
    return NextResponse.json({ users });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "搜索失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

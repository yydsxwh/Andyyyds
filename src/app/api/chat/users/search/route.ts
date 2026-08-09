import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchUsersForChat } from "@/lib/chat/service";

export const dynamic = "force-dynamic";

/** 按昵称搜索可发起私聊的用户 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get("q") || "";
  const users = await searchUsersForChat(session.id, q);
  return NextResponse.json({ users });
}

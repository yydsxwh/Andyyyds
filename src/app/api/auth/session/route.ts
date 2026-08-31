/**
 * GET /api/auth/session
 * 给桌面壳 / App 读当前登录态（昵称、头像），不返回邮箱等敏感字段。
 * 未登录返回 { user: null }，不要 401，方便壳层轮询。
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { user: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const avatarUrl = session.avatarUrl
    ? await resolveStoredAccessUrl(session.avatarUrl)
    : "";

  return NextResponse.json(
    {
      user: {
        id: session.id,
        name: session.name,
        avatarUrl,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

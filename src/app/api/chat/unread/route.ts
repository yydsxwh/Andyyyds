import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { getUnreadTotal } from "@andyyyds/shared/chat/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ count: 0 });
  }
  const count = await getUnreadTotal(session.id);
  return NextResponse.json({ count });
}

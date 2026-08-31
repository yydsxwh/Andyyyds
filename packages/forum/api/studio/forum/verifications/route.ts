/**
 * GET /api/studio/forum/verifications
 * 站长审核高校实名认证。
 */

import { NextResponse } from "next/server";
import { prisma } from "@andyyyds/shared/db";
import { canManageForum } from "@andyyyds/shared/roles";
import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";

export async function GET(req: Request) {
  try {
    const session = await requireAdmin();
    if (!canManageForum(session)) {
      return NextResponse.json({ error: "仅站长可审核学校认证" }, { status: 403 });
    }
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "PENDING";
    const where =
      status === "ALL"
        ? {}
        : { status: status === "VERIFIED" || status === "REJECTED" ? status : "PENDING" };
    const rows = await prisma.forumSchoolVerification.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        university: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    });
    return NextResponse.json({ verifications: rows });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

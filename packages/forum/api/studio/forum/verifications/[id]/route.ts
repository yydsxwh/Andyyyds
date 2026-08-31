/**
 * PATCH /api/studio/forum/verifications/[id]
 * 站长通过或驳回高校实名认证。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@andyyyds/shared/db";
import { canManageForum } from "@andyyyds/shared/roles";
import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED"]),
  reviewNote: z.string().trim().max(200).optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const session = await requireAdmin();
    if (!canManageForum(session)) {
      return NextResponse.json({ error: "仅站长可审核学校认证" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const row = await prisma.forumSchoolVerification.findUnique({
      where: { id },
    });
    if (!row) {
      return NextResponse.json({ error: "认证记录不存在" }, { status: 404 });
    }
    const note =
      body.status === "REJECTED"
        ? body.reviewNote?.trim() || "未通过审核"
        : body.reviewNote?.trim() || "";
    const updated = await prisma.forumSchoolVerification.update({
      where: { id },
      data: {
        status: body.status,
        reviewNote: note,
        reviewedAt: new Date(),
        reviewedById: session.id,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        university: { select: { id: true, name: true, slug: true } },
      },
    });
    if (body.status === "VERIFIED") {
      const user = await prisma.user.findUnique({
        where: { id: row.userId },
        select: { forumUniversityId: true },
      });
      if (!user?.forumUniversityId || user.forumUniversityId === row.universityId) {
        await prisma.user.update({
          where: { id: row.userId },
          data: { forumUniversityId: row.universityId },
        });
      }
    }
    return NextResponse.json({ verification: updated });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

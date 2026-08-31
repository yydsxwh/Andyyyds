/**
 * GET  /api/forum/verify  当前账号的本科/研究生认证档
 * POST /api/forum/verify  提交或更换某一档实名学校认证
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import {
  FORUM_CAMPUS_EMAIL_MAX,
  FORUM_REAL_NAME_MAX,
  FORUM_STUDENT_ID_MAX,
  isOwnedForumMediaUrl,
} from "@andyyyds/forum/lib/forum";
import { isCampusForumSpace } from "@andyyyds/forum/lib/forum-space";
import {
  decideForumVerifyStatus,
  FORUM_DEGREE_LABEL,
  isForumDegreeLevel,
  normalizeCampusEmail,
  normalizeRealName,
  normalizeStudentId,
  validateSchoolVerifyInput,
} from "@andyyyds/forum/lib/forum-school";

const postSchema = z.object({
  universityId: z.string().min(1),
  degreeLevel: z.enum(["UNDERGRAD", "GRADUATE"]),
  realName: z.string().trim().min(1).max(FORUM_REAL_NAME_MAX),
  studentId: z.string().trim().min(1).max(FORUM_STUDENT_ID_MAX),
  campusEmail: z.string().trim().max(FORUM_CAMPUS_EMAIL_MAX).optional(),
  proofUrl: z.string().trim().max(2000).optional(),
});

async function loadSlots(userId: string) {
  const rows = await prisma.forumSchoolVerification.findMany({
    where: { userId },
    include: {
      university: { select: { id: true, name: true, slug: true, enabled: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    degreeLevel: row.degreeLevel,
    universityId: row.universityId,
    universityName: row.university.name,
    universitySlug: row.university.slug,
    status: row.status,
    realName: row.realName,
    studentId: row.studentId,
    campusEmail: row.campusEmail,
    reviewNote: row.reviewNote,
  }));
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const slots = await loadSlots(session.id);
  return NextResponse.json({
    slots,
    verifiedUniversityIds: session.forumVerifiedUniversityIds,
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const body = postSchema.parse(await req.json());
    if (!isForumDegreeLevel(body.degreeLevel)) {
      return NextResponse.json({ error: "请选择本科或研究生" }, { status: 400 });
    }
    const realName = normalizeRealName(body.realName);
    const studentId = normalizeStudentId(body.studentId);
    const campusEmail = normalizeCampusEmail(body.campusEmail || "");
    const invalid = validateSchoolVerifyInput({
      realName,
      studentId,
      campusEmail,
    });
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }
    const proofUrl = (body.proofUrl || "").trim();
    if (proofUrl && !isOwnedForumMediaUrl(proofUrl, session.id)) {
      return NextResponse.json(
        { error: "证明材料无效，请重新上传" },
        { status: 400 },
      );
    }

    const university = await prisma.forumUniversity.findUnique({
      where: { id: body.universityId },
    });
    if (!university || !university.enabled || !isCampusForumSpace(university.kind)) {
      return NextResponse.json({ error: "高校分区不存在或已关闭" }, { status: 404 });
    }

    const existing = await prisma.forumSchoolVerification.findUnique({
      where: {
        userId_degreeLevel: {
          userId: session.id,
          degreeLevel: body.degreeLevel,
        },
      },
    });

    const status = decideForumVerifyStatus({
      session,
      emailDomains: university.emailDomains,
      campusEmail,
    });

    const record = existing
      ? await prisma.forumSchoolVerification.update({
          where: { id: existing.id },
          data: {
            universityId: university.id,
            realName,
            studentId,
            campusEmail,
            proofUrl,
            status,
            reviewNote: status === "PENDING" ? "" : existing.reviewNote,
            reviewedAt: status === "VERIFIED" ? new Date() : null,
            reviewedById: "",
          },
        })
      : await prisma.forumSchoolVerification.create({
          data: {
            userId: session.id,
            universityId: university.id,
            degreeLevel: body.degreeLevel,
            realName,
            studentId,
            campusEmail,
            proofUrl,
            status,
          },
        });

    if (status === "VERIFIED") {
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { forumUniversityId: true },
      });
      if (!user?.forumUniversityId || user.forumUniversityId === university.id) {
        await prisma.user.update({
          where: { id: session.id },
          data: { forumUniversityId: university.id },
        });
      }
    }

    const slots = await loadSlots(session.id);
    const degreeLabel = FORUM_DEGREE_LABEL[body.degreeLevel];
    return NextResponse.json({
      ok: true,
      status: record.status,
      message:
        record.status === "VERIFIED"
          ? `${university.name}（${degreeLabel}）认证已通过`
          : record.status === "PENDING"
            ? `${university.name}（${degreeLabel}）已提交，等待站长审核`
            : "已提交",
      slots,
    });
  } catch {
    return NextResponse.json({ error: "认证提交失败" }, { status: 400 });
  }
}

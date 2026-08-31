/**
 * POST /api/forum/join
 * 已认证本校（或站长）时把当前高校记为最近进入的分区。
 * 未认证用户请走 /api/forum/verify，不能靠这一接口绕过实名档位限制。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { isAdmin } from "@andyyyds/shared/roles";

const schema = z.object({
  universityId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const { universityId } = schema.parse(await req.json());
    const university = await prisma.forumUniversity.findUnique({
      where: { id: universityId },
    });
    if (!university || !university.enabled) {
      return NextResponse.json({ error: "高校分区不存在或已关闭" }, { status: 404 });
    }
    const verified = session.forumVerifiedUniversityIds.includes(university.id);
    const legacyMember = session.forumUniversityId === university.id;
    if (!isAdmin(session) && !verified && !legacyMember) {
      return NextResponse.json(
        {
          error: "请先完成本科或研究生实名学校认证",
          needVerify: true,
        },
        { status: 403 },
      );
    }
    await prisma.user.update({
      where: { id: session.id },
      data: { forumUniversityId: university.id },
    });
    return NextResponse.json({
      ok: true,
      universityId: university.id,
      slug: university.slug,
      name: university.name,
    });
  } catch {
    return NextResponse.json({ error: "加入失败" }, { status: 400 });
  }
}

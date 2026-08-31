/**
 * POST /api/forum/join
 * 用当前网站账号加入某高校分区（一人一校，不另开号）。
 * 站长若配置了邮箱后缀，则该账号邮箱必须匹配。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { emailMatchesUniversityDomains } from "@/lib/forum";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

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
    if (
      !isAdmin(session) &&
      !emailMatchesUniversityDomains(session.email, university.emailDomains)
    ) {
      return NextResponse.json(
        {
          error:
            "该校分区额外限制了学校邮箱。请用已绑定该校邮箱的网站账号登录，或联系站长帮你加入。",
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

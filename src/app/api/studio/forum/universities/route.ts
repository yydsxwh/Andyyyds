/**
 * GET  /api/studio/forum/universities — 高校分区列表
 * POST /api/studio/forum/universities — 创建高校分区并写入默认专区
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  DEFAULT_FORUM_ZONES,
  FORUM_DESC_MAX,
  FORUM_NAME_MAX,
  FORUM_RESERVED_SLUGS,
  FORUM_SLOGAN_MAX,
  normalizeForumSlug,
  slugifyUniversity,
} from "@/lib/forum";
import { prisma } from "@/lib/db";
import { canManageForum } from "@/lib/roles";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";

const createSchema = z.object({
  name: z.string().trim().min(2).max(FORUM_NAME_MAX),
  slug: z.string().trim().max(40).optional(),
  slogan: z.string().trim().max(FORUM_SLOGAN_MAX).optional(),
  description: z.string().trim().max(FORUM_DESC_MAX).optional(),
  logoUrl: z.string().trim().max(500).optional(),
  adImageUrl: z.string().trim().max(500).optional(),
  adHref: z.string().trim().max(500).optional(),
  adAlt: z.string().trim().max(80).optional(),
  emailDomains: z.string().trim().max(200).optional(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!canManageForum(session)) {
      return NextResponse.json({ error: "仅站长可管理大学论坛" }, { status: 403 });
    }
    const rows = await prisma.forumUniversity.findMany({
      include: {
        _count: { select: { members: true, posts: true, zones: true } },
        zones: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ universities: rows });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = createSchema.parse(await req.json());
    const slug = normalizeForumSlug(body.slug || slugifyUniversity(body.name));
    if (!slug || FORUM_RESERVED_SLUGS.has(slug)) {
      return NextResponse.json({ error: "路径不可用，请换一个英文短名" }, { status: 400 });
    }
    const exists = await prisma.forumUniversity.findUnique({ where: { slug } });
    if (exists) {
      return NextResponse.json({ error: "该路径已被占用" }, { status: 400 });
    }
    const maxSort = await prisma.forumUniversity.aggregate({
      _max: { sortOrder: true },
    });
    const university = await prisma.forumUniversity.create({
      data: {
        name: body.name,
        slug,
        slogan: body.slogan || "",
        description: body.description || "",
        logoUrl: body.logoUrl || "",
        adImageUrl: body.adImageUrl || "",
        adHref: body.adHref || "",
        adAlt: body.adAlt || "",
        emailDomains: body.emailDomains || "",
        enabled: body.enabled ?? true,
        sortOrder: (maxSort._max.sortOrder || 0) + 10,
        zones: {
          create: DEFAULT_FORUM_ZONES.map((zone, index) => ({
            key: zone.key,
            name: zone.name,
            sortOrder: index * 10,
          })),
        },
      },
      include: {
        zones: { orderBy: { sortOrder: "asc" } },
        _count: { select: { members: true, posts: true, zones: true } },
      },
    });
    return NextResponse.json({ university });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

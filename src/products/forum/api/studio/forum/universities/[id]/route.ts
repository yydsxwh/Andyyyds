/**
 * PATCH  /api/studio/forum/universities/[id]
 * DELETE /api/studio/forum/universities/[id]
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  FORUM_DESC_MAX,
  FORUM_NAME_MAX,
  FORUM_RESERVED_SLUGS,
  FORUM_SLOGAN_MAX,
  FORUM_ZONE_NAME_MAX,
  normalizeForumSlug,
} from "@/lib/forum";
import { prisma } from "@/lib/db";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(2).max(FORUM_NAME_MAX).optional(),
  slug: z.string().trim().max(40).optional(),
  slogan: z.string().trim().max(FORUM_SLOGAN_MAX).optional(),
  description: z.string().trim().max(FORUM_DESC_MAX).optional(),
  logoUrl: z.string().trim().max(500).optional(),
  adImageUrl: z.string().trim().max(500).optional(),
  adHref: z.string().trim().max(500).optional(),
  adAlt: z.string().trim().max(80).optional(),
  emailDomains: z.string().trim().max(200).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  addZone: z
    .object({
      name: z.string().trim().min(1).max(FORUM_ZONE_NAME_MAX),
    })
    .optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const current = await prisma.forumUniversity.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "高校分区不存在" }, { status: 404 });
    }

    if (body.slug) {
      const slug = normalizeForumSlug(body.slug);
      if (!slug || FORUM_RESERVED_SLUGS.has(slug)) {
        return NextResponse.json({ error: "路径不可用" }, { status: 400 });
      }
      if (slug !== current.slug) {
        const clash = await prisma.forumUniversity.findUnique({ where: { slug } });
        if (clash) {
          return NextResponse.json({ error: "该路径已被占用" }, { status: 400 });
        }
      }
      body.slug = slug;
    }

    if (body.addZone) {
      const key = `z-${Date.now().toString(36)}`;
      const maxSort = await prisma.forumZone.aggregate({
        where: { universityId: id },
        _max: { sortOrder: true },
      });
      await prisma.forumZone.create({
        data: {
          universityId: id,
          key,
          name: body.addZone.name,
          sortOrder: (maxSort._max.sortOrder || 0) + 10,
        },
      });
    }

    const university = await prisma.forumUniversity.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        slogan: body.slogan,
        description: body.description,
        logoUrl: body.logoUrl,
        adImageUrl: body.adImageUrl,
        adHref: body.adHref,
        adAlt: body.adAlt,
        emailDomains: body.emailDomains,
        enabled: body.enabled,
        sortOrder: body.sortOrder,
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

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    await prisma.forumUniversity.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

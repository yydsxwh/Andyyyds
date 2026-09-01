/**
 * PATCH /api/studio/forum/zones/[id] — 改话题名/排序/是否出现在话题栏
 * DELETE 删除话题。仍有帖时把帖挪到同校其他话题后再删，避免话题栏删不掉。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { FORUM_ZONE_NAME_MAX } from "@andyyyds/forum/lib/forum";
import { prisma } from "@andyyyds/shared/db";
import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(FORUM_ZONE_NAME_MAX).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const current = await prisma.forumZone.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "话题不存在" }, { status: 404 });
    }
    if (body.enabled === false) {
      const otherEnabled = await prisma.forumZone.count({
        where: {
          universityId: current.universityId,
          enabled: true,
          NOT: { id },
        },
      });
      if (otherEnabled === 0) {
        return NextResponse.json(
          { error: "至少保留一个显示在话题栏里的话题" },
          { status: 400 },
        );
      }
    }
    const zone = await prisma.forumZone.update({
      where: { id },
      data: body,
    });
    return NextResponse.json({ zone });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const zone = await prisma.forumZone.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    });
    if (!zone) {
      return NextResponse.json({ error: "话题不存在" }, { status: 404 });
    }
    const siblingCount = await prisma.forumZone.count({
      where: { universityId: zone.universityId, NOT: { id } },
    });
    if (siblingCount === 0) {
      return NextResponse.json(
        { error: "至少保留一个话题，否则没法发帖" },
        { status: 400 },
      );
    }
    if (zone._count.posts > 0) {
      const fallback = await prisma.forumZone.findFirst({
        where: {
          universityId: zone.universityId,
          NOT: { id },
        },
        orderBy: [{ enabled: "desc" }, { sortOrder: "asc" }],
      });
      if (!fallback) {
        return NextResponse.json(
          { error: "没有可接收旧帖的其他话题" },
          { status: 400 },
        );
      }
      await prisma.forumPost.updateMany({
        where: { zoneId: id },
        data: { zoneId: fallback.id },
      });
    }
    await prisma.forumZone.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

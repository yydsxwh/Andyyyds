/**
 * PATCH /api/studio/forum/zones/[id] — 改话题名/排序/是否出现在话题栏
 * DELETE 删除一级或二级话题。仍有帖时把帖挪到同分区其他话题后再删。
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

async function pickFallbackZone(args: {
  universityId: string;
  excludeIds: string[];
  preferId?: string | null;
}) {
  if (args.preferId && !args.excludeIds.includes(args.preferId)) {
    const preferred = await prisma.forumZone.findFirst({
      where: { id: args.preferId, universityId: args.universityId },
    });
    if (preferred) return preferred;
  }
  const top = await prisma.forumZone.findFirst({
    where: {
      universityId: args.universityId,
      parentId: null,
      NOT: { id: { in: args.excludeIds } },
    },
    orderBy: [{ enabled: "desc" }, { sortOrder: "asc" }],
  });
  if (top) return top;
  return prisma.forumZone.findFirst({
    where: {
      universityId: args.universityId,
      NOT: { id: { in: args.excludeIds } },
    },
    orderBy: [{ enabled: "desc" }, { sortOrder: "asc" }],
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const current = await prisma.forumZone.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "话题不存在" }, { status: 404 });
    }
    // 一级藏起来后，它下面的二级也不会出现在前台，所以至少留一个开着的一级
    if (body.enabled === false && !current.parentId) {
      const otherEnabledTops = await prisma.forumZone.count({
        where: {
          universityId: current.universityId,
          parentId: null,
          enabled: true,
          NOT: { id },
        },
      });
      if (otherEnabledTops === 0) {
        return NextResponse.json(
          { error: "至少保留一个显示在话题栏里的一级话题" },
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
      include: {
        children: { select: { id: true } },
      },
    });
    if (!zone) {
      return NextResponse.json({ error: "话题不存在" }, { status: 404 });
    }
    const childIds = zone.children.map((child) => child.id);
    const removeIds = [zone.id, ...childIds];

    if (!zone.parentId) {
      const otherTops = await prisma.forumZone.count({
        where: {
          universityId: zone.universityId,
          parentId: null,
          NOT: { id },
        },
      });
      if (otherTops === 0) {
        return NextResponse.json(
          { error: "至少保留一个一级话题，否则没法发帖" },
          { status: 400 },
        );
      }
    }

    const fallback = await pickFallbackZone({
      universityId: zone.universityId,
      excludeIds: removeIds,
      preferId: zone.parentId,
    });
    const postCount = await prisma.forumPost.count({
      where: { zoneId: { in: removeIds } },
    });
    if (postCount > 0 && !fallback) {
      return NextResponse.json(
        { error: "没有可接收旧帖的其他话题" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      if (postCount > 0 && fallback) {
        await tx.forumPost.updateMany({
          where: { zoneId: { in: removeIds } },
          data: { zoneId: fallback.id },
        });
      }
      if (childIds.length > 0) {
        await tx.forumZone.deleteMany({ where: { id: { in: childIds } } });
      }
      await tx.forumZone.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

/**
 * PATCH /api/studio/forum/zones/[id] — 改专区名/排序/开关
 * DELETE 停用并拒绝删除仍有帖子的专区
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { FORUM_ZONE_NAME_MAX } from "@/lib/forum";
import { prisma } from "@/lib/db";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";

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
      return NextResponse.json({ error: "专区不存在" }, { status: 404 });
    }
    if (zone._count.posts > 0) {
      await prisma.forumZone.update({
        where: { id },
        data: { enabled: false },
      });
      return NextResponse.json({
        ok: true,
        disabled: true,
        message: "该专区已有帖子，已停用而不是删除",
      });
    }
    await prisma.forumZone.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

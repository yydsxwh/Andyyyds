import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@andyyyds/shared/db";
import { MEDIA_CATEGORY_NAME_MAX } from "@andyyyds/shared/media";
import { canDeleteMedia } from "@andyyyds/shared/roles";
import { requireCourseStudioUser, studioErrorResponse } from "@andyyyds/shared/studio";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(MEDIA_CATEGORY_NAME_MAX),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireCourseStudioUser();
    const { id } = await params;
    const category = await prisma.mediaCategory.findFirst({
      where: { id, ownerId: session.id },
    });
    if (!category) {
      return NextResponse.json({ error: "分类不存在" }, { status: 404 });
    }

    const body = patchSchema.parse(await req.json());
    const conflict = await prisma.mediaCategory.findFirst({
      where: {
        ownerId: session.id,
        name: body.name,
        NOT: { id },
      },
    });
    if (conflict) {
      return NextResponse.json({ error: "同名分类已存在" }, { status: 400 });
    }

    const updated = await prisma.mediaCategory.update({
      where: { id },
      data: { name: body.name },
      include: { _count: { select: { assets: true } } },
    });
    return NextResponse.json({ category: updated });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireCourseStudioUser();
    if (!canDeleteMedia(session.role)) {
      return NextResponse.json(
        { error: "老师账号不可删除分类，请联系站长处理" },
        { status: 403 },
      );
    }
    const { id } = await params;
    const category = await prisma.mediaCategory.findFirst({
      where: { id, ownerId: session.id },
    });
    if (!category) {
      return NextResponse.json({ error: "分类不存在" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.mediaAsset.updateMany({
        where: { categoryId: id, ownerId: session.id },
        data: { categoryId: null },
      }),
      prisma.mediaCategory.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

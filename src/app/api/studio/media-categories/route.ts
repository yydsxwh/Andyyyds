import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@andyyyds/shared/db";
import { MEDIA_CATEGORY_NAME_MAX } from "@andyyyds/shared/media";
import { requireCourseStudioUser, studioErrorResponse } from "@andyyyds/shared/studio";

const createSchema = z.object({
  name: z.string().trim().min(1).max(MEDIA_CATEGORY_NAME_MAX),
});

export async function GET() {
  try {
    const session = await requireCourseStudioUser();
    const categories = await prisma.mediaCategory.findMany({
      where: { ownerId: session.id },
      include: { _count: { select: { assets: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ categories });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireCourseStudioUser();
    const body = createSchema.parse(await req.json());
    const exists = await prisma.mediaCategory.findFirst({
      where: { ownerId: session.id, name: body.name },
    });
    if (exists) {
      return NextResponse.json({ error: "同名分类已存在" }, { status: 400 });
    }

    const category = await prisma.mediaCategory.create({
      data: { name: body.name, ownerId: session.id },
      include: { _count: { select: { assets: true } } },
    });
    return NextResponse.json({ category });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PRODUCT_TITLE_MAX } from "@/lib/media";
import { requireStudioUser, studioErrorResponse } from "@/lib/studio";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";

const lessonSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0),
  type: z.enum(["VIDEO", "ARTICLE", "LIVE"]).default("VIDEO"),
  content: z.string().max(20000).optional(),
  videoUrl: z.string().max(800).optional(),
  durationSec: z.number().int().min(0).optional(),
  isPreview: z.boolean().optional(),
  mediaAssetId: z.string().nullable().optional(),
});

const chapterSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(0),
  lessons: z.array(lessonSchema).max(200),
});

const patchSchema = z.object({
  title: z.string().trim().min(2).max(PRODUCT_TITLE_MAX).optional(),
  subtitle: z.string().trim().max(200).optional(),
  description: z.string().trim().min(2).max(5000).optional(),
  price: z.coerce.number().min(0).optional(),
  coverUrl: z.string().max(800).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  productType: z.enum(["COURSE", "COLUMN"]).optional(),
  slug: z.string().trim().min(1).max(120).optional(),
  chapters: z.array(chapterSchema).max(100).optional(),
});

async function getOwnedCourse(id: string, sessionId: string, role: string) {
  return prisma.course.findFirst({
    where: {
      id,
      ...(role === "ADMIN" ? {} : { teacherId: sessionId }),
    },
    include: {
      chapters: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            orderBy: { sortOrder: "asc" },
            include: {
              mediaAsset: { select: { id: true, name: true, fileUrl: true } },
            },
          },
        },
      },
    },
  });
}

function serializeCourse(
  course: NonNullable<Awaited<ReturnType<typeof getOwnedCourse>>>,
) {
  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    subtitle: course.subtitle,
    description: course.description,
    price: course.price,
    coverUrl: course.coverUrl,
    status: course.status,
    productType: course.productType,
    isFree: course.isFree,
    chapters: course.chapters.map((c) => ({
      id: c.id,
      title: c.title,
      sortOrder: c.sortOrder,
      lessons: c.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        sortOrder: l.sortOrder,
        type: l.type,
        content: l.content,
        videoUrl: l.videoUrl,
        durationSec: l.durationSec,
        isPreview: l.isPreview,
        mediaAssetId: l.mediaAssetId,
        mediaAsset: l.mediaAsset,
      })),
    })),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireStudioUser();
    const { id } = await params;
    const course = await getOwnedCourse(id, session.id, session.role);
    if (!course) {
      return NextResponse.json({ error: "课程不存在或无权访问" }, { status: 404 });
    }
    return NextResponse.json({ course: serializeCourse(course) });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireStudioUser();
    const { id } = await params;
    const course = await getOwnedCourse(id, session.id, session.role);
    if (!course) {
      return NextResponse.json({ error: "课程不存在或无权修改" }, { status: 404 });
    }

    const body = patchSchema.parse(await req.json());
    const data: Record<string, unknown> = {};

    if (body.title !== undefined) data.title = body.title;
    if (body.subtitle !== undefined) data.subtitle = body.subtitle;
    if (body.description !== undefined) data.description = body.description;
    if (body.coverUrl !== undefined) data.coverUrl = body.coverUrl.trim();
    if (body.status !== undefined) data.status = body.status;
    if (body.productType !== undefined) data.productType = body.productType;

    if (body.price !== undefined) {
      const priceCents = Math.round(Number(body.price) * 100);
      data.price = priceCents;
      data.originalPrice = priceCents;
      data.isFree = priceCents <= 0;
    }

    if (body.slug !== undefined) {
      const nextSlug = slugify(body.slug) || course.slug;
      if (nextSlug !== course.slug) {
        const exists = await prisma.course.findUnique({ where: { slug: nextSlug } });
        if (exists && exists.id !== course.id) {
          return NextResponse.json(
            { error: "该链接地址已被占用，请换一个" },
            { status: 400 },
          );
        }
        data.slug = nextSlug;
      }
    }

    // 校验课时绑定的素材归属
    if (body.chapters) {
      const assetIds = body.chapters
        .flatMap((c) => c.lessons.map((l) => l.mediaAssetId))
        .filter((x): x is string => Boolean(x));
      if (assetIds.length > 0) {
        const owned = await prisma.mediaAsset.findMany({
          where: {
            id: { in: assetIds },
            ...(session.role === "ADMIN" ? {} : { ownerId: session.id }),
          },
          select: { id: true, fileUrl: true, durationSec: true, description: true },
        });
        if (owned.length !== new Set(assetIds).size) {
          return NextResponse.json(
            { error: "部分视频素材不存在或无权使用" },
            { status: 400 },
          );
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.course.update({ where: { id: course.id }, data });
      }

      if (!body.chapters) return;

      const keepChapterIds: string[] = [];
      for (const chapter of body.chapters) {
        let chapterId = chapter.id;
        if (chapterId && course.chapters.some((c) => c.id === chapterId)) {
          await tx.chapter.update({
            where: { id: chapterId },
            data: {
              title: chapter.title,
              sortOrder: chapter.sortOrder,
            },
          });
        } else {
          const created = await tx.chapter.create({
            data: {
              title: chapter.title,
              sortOrder: chapter.sortOrder,
              courseId: course.id,
            },
          });
          chapterId = created.id;
        }
        keepChapterIds.push(chapterId);

        const existingLessons =
          course.chapters.find((c) => c.id === chapter.id)?.lessons || [];
        const keepLessonIds: string[] = [];

        for (const lesson of chapter.lessons) {
          let videoUrl = lesson.videoUrl || "";
          let durationSec = lesson.durationSec ?? 0;
          let content = lesson.content || "";
          let mediaAssetId = lesson.mediaAssetId ?? null;

          if (mediaAssetId) {
            const asset = await tx.mediaAsset.findUnique({
              where: { id: mediaAssetId },
            });
            if (asset) {
              videoUrl = asset.fileUrl;
              if (!durationSec) durationSec = asset.durationSec || 0;
              if (!content) content = asset.description || "";
            }
          }

          const payload = {
            title: lesson.title,
            sortOrder: lesson.sortOrder,
            type: lesson.type || "VIDEO",
            content,
            videoUrl,
            durationSec,
            isPreview: Boolean(lesson.isPreview),
            mediaAssetId,
            chapterId,
          };

          if (lesson.id && existingLessons.some((l) => l.id === lesson.id)) {
            await tx.lesson.update({
              where: { id: lesson.id },
              data: payload,
            });
            keepLessonIds.push(lesson.id);
          } else {
            const created = await tx.lesson.create({ data: payload });
            keepLessonIds.push(created.id);
          }
        }

        if (keepLessonIds.length === 0) {
          await tx.lesson.deleteMany({ where: { chapterId } });
        } else {
          await tx.lesson.deleteMany({
            where: { chapterId, id: { notIn: keepLessonIds } },
          });
        }
      }

      if (keepChapterIds.length === 0) {
        await tx.chapter.deleteMany({ where: { courseId: course.id } });
      } else {
        await tx.chapter.deleteMany({
          where: { courseId: course.id, id: { notIn: keepChapterIds } },
        });
      }
    });

    const updated = await getOwnedCourse(course.id, session.id, session.role);
    return NextResponse.json({ course: serializeCourse(updated!) });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

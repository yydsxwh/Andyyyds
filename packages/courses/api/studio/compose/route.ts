import { NextResponse } from "next/server";
import { z } from "zod";
import {
  replaceColumnBundleItems,
  resolveBundleCourses,
} from "@andyyyds/courses/lib/course-bundle";
import { DEFAULT_COURSE_COVER_URL } from "@andyyyds/shared/cover-images";
import { prisma } from "@andyyyds/shared/db";
import { PRODUCT_TITLE_MAX } from "@andyyyds/shared/media";
import { yuanToCents } from "@andyyyds/shared/money";
import { requireCreateSellableUser, studioErrorResponse } from "@andyyyds/shared/studio";
import { slugify } from "@andyyyds/shared/utils";

const schema = z
  .object({
    productType: z.enum(["COURSE", "COLUMN", "MATERIAL"]),
    title: z.string().trim().min(2).max(PRODUCT_TITLE_MAX),
    subtitle: z.string().trim().max(200).optional(),
    // 产品介绍选填；空字符串也允许
    description: z.string().trim().max(5000).optional().default(""),
    price: z.union([z.string(), z.number()]),
    hidePrice: z.boolean().optional(),
    coverUrl: z.string().optional(),
    publish: z.boolean().optional(),
    /** 单课/资料：素材 id */
    assetIds: z.array(z.string()).optional(),
    /** 专栏套餐：所含单课 id（有序） */
    courseIds: z.array(z.string()).optional(),
    groupByCategory: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.productType === "COLUMN") {
      if (!v.courseIds || v.courseIds.length < 1) {
        ctx.addIssue({
          code: "custom",
          message: "请至少选择一门单课加入专栏套餐",
          path: ["courseIds"],
        });
      }
    } else if (!v.assetIds || v.assetIds.length < 1) {
      ctx.addIssue({
        code: "custom",
        message: "请至少选择 1 个素材",
        path: ["assetIds"],
      });
    }
  });

/** 资料包课时类型跟素材媒体类型走，便于前台区分下载/播放 */
function lessonTypeFromAsset(asset: { type: string }) {
  const t = (asset.type || "").toUpperCase();
  if (t === "IMAGE" || t === "AUDIO" || t === "DOCUMENT" || t === "OTHER") {
    return t;
  }
  return "VIDEO";
}

function defaultSubtitle(
  productType: "COURSE" | "COLUMN" | "MATERIAL",
  count: number,
) {
  if (productType === "MATERIAL") return `含 ${count} 个可售资料文件`;
  if (productType === "COLUMN") return `含 ${count} 门单课的套餐专栏`;
  return `由 ${count} 个视频素材组成的课程`;
}

function catalogTitle(productType: "COURSE" | "MATERIAL") {
  if (productType === "MATERIAL") return "资料目录";
  return "课程目录";
}

type LessonInput = {
  title: string;
  sortOrder: number;
  type: string;
  content: string;
  videoUrl: string;
  durationSec: number;
  isPreview: boolean;
  mediaAssetId: string;
};

type ChapterInput = {
  title: string;
  sortOrder: number;
  lessons: LessonInput[];
};

export async function POST(req: Request) {
  try {
    // 业务规则：组课/专栏创建走可售产品权限（ADMIN / MERCHANT / AGENT）
    const session = await requireCreateSellableUser();
    const body = schema.parse(await req.json());

    let priceCents: number;
    try {
      priceCents = yuanToCents(body.price);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "价格无效" },
        { status: 400 },
      );
    }

    const publish = body.publish ?? true;

    const baseSlug = slugify(body.title) || `course-${Date.now()}`;
    let slug = baseSlug;
    let i = 1;
    while (await prisma.course.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`;
    }

    // —— 专栏：打包多门单课，不建素材章节 ——
    if (body.productType === "COLUMN") {
      const bundled = await resolveBundleCourses({
        ownerId: session.id,
        courseIds: body.courseIds || [],
      });

      const course = await prisma.course.create({
        data: {
          title: body.title,
          slug,
          subtitle: body.subtitle || defaultSubtitle("COLUMN", bundled.length),
          description: body.description,
          coverUrl:
            body.coverUrl ||
            bundled[0]?.coverUrl ||
            DEFAULT_COURSE_COVER_URL,
          price: priceCents,
          originalPrice: priceCents,
          isFree: priceCents <= 0,
          hidePrice: Boolean(body.hidePrice),
          status: publish ? "PUBLISHED" : "DRAFT",
          productType: "COLUMN",
          teacherId: session.id,
        },
      });

      await replaceColumnBundleItems(
        prisma,
        course.id,
        bundled.map((c) => c.id),
      );

      return NextResponse.json({ id: course.id, slug: course.slug });
    }

    // —— 单课 / 资料：素材组成章节 ——
    const assetIds = body.assetIds || [];
    const assets = await prisma.mediaAsset.findMany({
      where: { ownerId: session.id, id: { in: assetIds } },
      include: { category: true },
    });

    if (assets.length !== assetIds.length) {
      return NextResponse.json(
        { error: "部分素材不存在或无权使用" },
        { status: 400 },
      );
    }

    const ordered = assetIds
      .map((id) => assets.find((a) => a.id === id))
      .filter(Boolean) as typeof assets;

    const chaptersData: ChapterInput[] = body.groupByCategory
      ? buildChaptersByCategory(ordered)
      : [
          {
            title: catalogTitle(body.productType),
            sortOrder: 1,
            lessons: ordered.map((asset, index) => ({
              title: asset.name,
              sortOrder: index + 1,
              type: lessonTypeFromAsset(asset),
              content: asset.description || "",
              videoUrl: asset.fileUrl,
              durationSec: asset.durationSec || 0,
              isPreview: index === 0,
              mediaAssetId: asset.id,
            })),
          },
        ];

    const course = await prisma.course.create({
      data: {
        title: body.title,
        slug,
        subtitle:
          body.subtitle ||
          defaultSubtitle(body.productType, ordered.length),
        description: body.description,
        coverUrl: body.coverUrl || DEFAULT_COURSE_COVER_URL,
        price: priceCents,
        originalPrice: priceCents,
        isFree: priceCents <= 0,
        hidePrice: Boolean(body.hidePrice),
        status: publish ? "PUBLISHED" : "DRAFT",
        productType: body.productType,
        teacherId: session.id,
      },
    });

    for (const chapter of chaptersData) {
      const createdChapter = await prisma.chapter.create({
        data: {
          title: chapter.title,
          sortOrder: chapter.sortOrder,
          courseId: course.id,
        },
      });
      if (chapter.lessons.length > 0) {
        await prisma.lesson.createMany({
          data: chapter.lessons.map((lesson) => ({
            ...lesson,
            chapterId: createdChapter.id,
          })),
        });
      }
    }

    return NextResponse.json({ id: course.id, slug: course.slug });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "参数无效" },
        { status: 400 },
      );
    }
    const mapped = studioErrorResponse(error);
    const message =
      error instanceof Error && error.message && mapped.status === 500
        ? error.message
        : mapped.error;
    // resolveBundleCourses 等业务错误用 400
    if (error instanceof Error && /单课|套餐|素材/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: message },
      { status: mapped.status === 500 ? 400 : mapped.status },
    );
  }
}

function buildChaptersByCategory(
  assets: Array<{
    id: string;
    name: string;
    description: string;
    fileUrl: string;
    durationSec: number;
    type: string;
    category: { name: string } | null;
  }>,
): ChapterInput[] {
  const groups = new Map<string, typeof assets>();
  for (const asset of assets) {
    const key = asset.category?.name || "未分类";
    const list = groups.get(key) || [];
    list.push(asset);
    groups.set(key, list);
  }

  return Array.from(groups.entries()).map(([title, list], chapterIndex) => ({
    title,
    sortOrder: chapterIndex + 1,
    lessons: list.map((asset, index) => ({
      title: asset.name,
      sortOrder: index + 1,
      type: lessonTypeFromAsset(asset),
      content: asset.description || "",
      videoUrl: asset.fileUrl,
      durationSec: asset.durationSec || 0,
      isPreview: chapterIndex === 0 && index === 0,
      mediaAssetId: asset.id,
    })),
  }));
}

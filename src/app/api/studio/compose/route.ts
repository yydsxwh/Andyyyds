import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PRODUCT_TITLE_MAX } from "@/lib/media";
import { requireStudioUser, studioErrorResponse } from "@/lib/studio";
import { slugify } from "@/lib/utils";

const schema = z.object({
  productType: z.enum(["COURSE", "COLUMN"]),
  title: z.string().trim().min(2).max(PRODUCT_TITLE_MAX),
  subtitle: z.string().trim().max(200).optional(),
  description: z.string().trim().min(10).max(5000),
  price: z.coerce.number().min(0),
  coverUrl: z.string().optional(),
  publish: z.boolean().optional(),
  assetIds: z.array(z.string()).min(1),
  groupByCategory: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireStudioUser();
    const body = schema.parse(await req.json());

    const assets = await prisma.mediaAsset.findMany({
      where: { ownerId: session.id, id: { in: body.assetIds } },
      include: { category: true },
    });

    if (assets.length !== body.assetIds.length) {
      return NextResponse.json({ error: "部分素材不存在或无权使用" }, { status: 400 });
    }

    const ordered = body.assetIds
      .map((id) => assets.find((a) => a.id === id))
      .filter(Boolean) as typeof assets;

    const baseSlug = slugify(body.title);
    let slug = baseSlug;
    let i = 1;
    while (await prisma.course.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`;
    }

    const priceCents = Math.round(Number(body.price) * 100);
    const publish = body.publish ?? true;

    const chaptersData = body.groupByCategory
      ? buildChaptersByCategory(ordered)
      : [
          {
            title: body.productType === "COLUMN" ? "专栏目录" : "课程目录",
            sortOrder: 1,
            lessons: {
              create: ordered.map((asset, index) => ({
                title: asset.name,
                sortOrder: index + 1,
                type: "VIDEO",
                content: asset.description,
                videoUrl: asset.fileUrl,
                durationSec: asset.durationSec,
                isPreview: index === 0,
                mediaAssetId: asset.id,
              })),
            },
          },
        ];

    const course = await prisma.course.create({
      data: {
        title: body.title,
        slug,
        subtitle:
          body.subtitle ||
          (body.productType === "COLUMN"
            ? `精选 ${ordered.length} 个素材组成的专栏`
            : `由 ${ordered.length} 个视频素材组成的课程`),
        description: body.description,
        coverUrl:
          body.coverUrl ||
          "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
        price: priceCents,
        originalPrice: priceCents,
        isFree: priceCents <= 0,
        status: publish ? "PUBLISHED" : "DRAFT",
        productType: body.productType,
        teacherId: session.id,
        chapters: { create: chaptersData },
      },
    });

    return NextResponse.json({ id: course.id, slug: course.slug });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

function buildChaptersByCategory(
  assets: Array<{
    id: string;
    name: string;
    description: string;
    fileUrl: string;
    durationSec: number;
    category: { name: string } | null;
  }>,
) {
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
    lessons: {
      create: list.map((asset, index) => ({
        title: asset.name,
        sortOrder: index + 1,
        type: "VIDEO",
        content: asset.description,
        videoUrl: asset.fileUrl,
        durationSec: asset.durationSec,
        isPreview: chapterIndex === 0 && index === 0,
        mediaAssetId: asset.id,
      })),
    },
  }));
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import { DEFAULT_COURSE_COVER_URL } from "@andyyyds/shared/cover-images";
import { prisma } from "@andyyyds/shared/db";
import { yuanToCents } from "@andyyyds/shared/money";
import { canCreateSellableProducts } from "@andyyyds/shared/roles";
import { slugify } from "@andyyyds/shared/utils";

const schema = z.object({
  title: z.string().min(2),
  subtitle: z.string().optional(),
  description: z.string().min(10),
  price: z.union([z.string(), z.number()]),
  coverUrl: z.string().optional(),
  publish: z.union([z.literal("1"), z.literal("true"), z.boolean()]).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  // 业务规则：仅站长 / 入驻商家 / 加盟代理可新建可售课程；老师拒绝
  if (!canCreateSellableProducts(session.role)) {
    return NextResponse.json(
      { error: "仅入驻商家、加盟代理与站长可新建课程、专栏或商品" },
      { status: 403 },
    );
  }

  try {
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
    const baseSlug = slugify(body.title);
    let slug = baseSlug;
    let i = 1;
    while (await prisma.course.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`;
    }

    const publish =
      body.publish === true || body.publish === "1" || body.publish === "true";

    const course = await prisma.course.create({
      data: {
        title: body.title,
        slug,
        subtitle: body.subtitle || "",
        description: body.description,
        price: priceCents,
        originalPrice: priceCents,
        isFree: priceCents <= 0,
        coverUrl: body.coverUrl || DEFAULT_COURSE_COVER_URL,
        status: publish ? "PUBLISHED" : "DRAFT",
        teacherId: session.id,
        chapters: {
          create: [
            {
              title: "第一章",
              sortOrder: 1,
              lessons: {
                create: [
                  {
                    title: "导学与学习建议",
                    sortOrder: 1,
                    type: "ARTICLE",
                    isPreview: true,
                    content: "欢迎学习本课程。请先完成自我介绍与学习目标设定。",
                    durationSec: 300,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    return NextResponse.json({ id: course.id, slug: course.slug });
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 400 });
  }
}

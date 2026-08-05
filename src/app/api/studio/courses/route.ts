import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(2),
  subtitle: z.string().optional(),
  description: z.string().min(10),
  price: z.coerce.number().min(0),
  coverUrl: z.string().optional(),
  publish: z.union([z.literal("1"), z.literal("true"), z.boolean()]).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (session.role !== "TEACHER" && session.role !== "ADMIN") {
    return NextResponse.json({ error: "仅创作者可上架课程" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());
    const priceCents = Math.round(Number(body.price) * 100);
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
        coverUrl:
          body.coverUrl ||
          "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
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

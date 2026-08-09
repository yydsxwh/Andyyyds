/**
 * GET/PATCH /api/studio/products —— 站长产品管理（Course，不含约搭壳）
 *
 * 产品 = Course（单课 / 专栏 / 资料 / 商城）。站长可批量调展示次序、置顶、精华与上下架。
 * 约搭壳(MEETUP)走约搭管理，不进本列表，避免按课程逻辑运营活动。
 * 硬删除走既有 /api/studio/courses/[id] DELETE，避免拆两套履约清理逻辑。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { MEETUP_PRODUCT_TYPE } from "@/lib/meetup";
import { PRODUCT_PLAZA_ORDER_BY } from "@/lib/product-display-order";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";

export const runtime = "nodejs";

const patchItemSchema = z.object({
  id: z.string().min(1),
  sortOrder: z.number().int().min(0).optional(),
  isPinned: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  hidePrice: z.boolean().optional(),
  /** 下架用 DRAFT，上架用 PUBLISHED；有订单时优先下架而非硬删 */
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

const patchSchema = z.object({
  /** 按当前列表顺序写入 sortOrder=0..n-1（拖拽保存） */
  orderedIds: z.array(z.string().min(1)).max(500).optional(),
  items: z.array(patchItemSchema).max(500).optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const products = await prisma.course.findMany({
      where: { productType: { not: MEETUP_PRODUCT_TYPE } },
      include: {
        teacher: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        _count: { select: { enrollments: true, orders: true } },
      },
      orderBy: PRODUCT_PLAZA_ORDER_BY,
    });

    return NextResponse.json({
      products: products.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        subtitle: p.subtitle,
        coverUrl: p.coverUrl,
        price: p.price,
        status: p.status,
        productType: p.productType,
        sortOrder: p.sortOrder,
        isPinned: p.isPinned,
        isFeatured: p.isFeatured,
        hidePrice: p.hidePrice,
        teacherName: p.teacher.name,
        categoryName: p.category?.name || "",
        enrollmentCount: p._count.enrollments,
        orderCount: p._count.orders,
        updatedAt: p.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = patchSchema.parse(await req.json());

    if (!body.orderedIds?.length && !body.items?.length) {
      return NextResponse.json({ error: "无更新内容" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // 拖拽排序：列表顺序即 sortOrder；置顶仍由 isPinned 单独控制
      // 跳过约搭壳：活动展示不走课程广场排序
      if (body.orderedIds?.length) {
        const rows = await tx.course.findMany({
          where: { id: { in: body.orderedIds } },
          select: { id: true, productType: true },
        });
        const typeById = new Map(rows.map((r) => [r.id, r.productType]));
        for (let i = 0; i < body.orderedIds.length; i += 1) {
          const id = body.orderedIds[i]!;
          if (typeById.get(id) === MEETUP_PRODUCT_TYPE) continue;
          await tx.course.update({
            where: { id },
            data: { sortOrder: i },
          });
        }
      }

      if (body.items?.length) {
        for (const item of body.items) {
          const existing = await tx.course.findUnique({
            where: { id: item.id },
            select: { productType: true },
          });
          if (!existing || existing.productType === MEETUP_PRODUCT_TYPE) {
            continue;
          }
          const data: {
            sortOrder?: number;
            isPinned?: boolean;
            isFeatured?: boolean;
            hidePrice?: boolean;
            status?: string;
          } = {};
          if (item.sortOrder !== undefined) data.sortOrder = item.sortOrder;
          if (item.isPinned !== undefined) data.isPinned = item.isPinned;
          if (item.isFeatured !== undefined) data.isFeatured = item.isFeatured;
          if (item.hidePrice !== undefined) data.hidePrice = item.hidePrice;
          if (item.status !== undefined) data.status = item.status;
          if (Object.keys(data).length === 0) continue;
          await tx.course.update({
            where: { id: item.id },
            data,
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

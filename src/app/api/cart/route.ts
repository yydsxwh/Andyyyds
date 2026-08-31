/**
 * 购物车 API：登录用户服务端持久化。
 * GET 列表 | POST 加购 | PATCH 改数量/勾选 | DELETE 删除
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { buildSpecLabel, parseSpecs, SHOP_PRODUCT_TYPE } from "@andyyyds/shared/shop";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";

export const runtime = "nodejs";

const addSchema = z.object({
  courseId: z.string().min(1),
  quantity: z.number().int().min(1).max(99).optional(),
  specSelected: z.record(z.string(), z.string()).optional(),
  specLabel: z.string().max(200).optional(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  quantity: z.number().int().min(1).max(99).optional(),
  selected: z.boolean().optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1).optional(),
  ids: z.array(z.string().min(1)).optional(),
  /** true：清空当前用户购物车 */
  clear: z.boolean().optional(),
});

async function serializeCart(userId: string) {
  const rows = await prisma.cartItem.findMany({
    where: { userId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          coverUrl: true,
          price: true,
          originalPrice: true,
          status: true,
          productType: true,
          isFree: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const items = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      courseId: row.courseId,
      quantity: row.quantity,
      specLabel: row.specLabel,
      selected: row.selected,
      title: row.course.title,
      slug: row.course.slug,
      coverUrl: await resolveStoredAccessUrl(row.course.coverUrl),
      price: row.course.price,
      originalPrice: row.course.originalPrice,
      status: row.course.status,
      isFree: row.course.isFree,
      available:
        row.course.status === "PUBLISHED" &&
        row.course.productType === SHOP_PRODUCT_TYPE,
    })),
  );

  return { items };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  return NextResponse.json(await serializeCart(session.id));
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = addSchema.parse(await req.json());
    const course = await prisma.course.findUnique({
      where: { id: body.courseId },
    });
    if (
      !course ||
      course.status !== "PUBLISHED" ||
      course.productType !== SHOP_PRODUCT_TYPE
    ) {
      return NextResponse.json({ error: "商品不可加入购物车" }, { status: 400 });
    }

    let specLabel = (body.specLabel || "").trim();
    if (!specLabel) {
      const built = buildSpecLabel(parseSpecs(course.specsJson), body.specSelected);
      if (!built.ok) {
        return NextResponse.json({ error: built.error }, { status: 400 });
      }
      specLabel = built.label;
    }

    const qty = body.quantity ?? 1;
    const existing = await prisma.cartItem.findUnique({
      where: {
        userId_courseId_specLabel: {
          userId: session.id,
          courseId: course.id,
          specLabel,
        },
      },
    });

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: Math.min(99, existing.quantity + qty),
          selected: true,
        },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          userId: session.id,
          courseId: course.id,
          quantity: qty,
          specLabel,
          selected: true,
        },
      });
    }

    return NextResponse.json(await serializeCart(session.id));
  } catch {
    return NextResponse.json({ error: "加购失败" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = patchSchema.parse(await req.json());
    const item = await prisma.cartItem.findFirst({
      where: { id: body.id, userId: session.id },
    });
    if (!item) {
      return NextResponse.json({ error: "购物车项不存在" }, { status: 404 });
    }

    await prisma.cartItem.update({
      where: { id: item.id },
      data: {
        ...(body.quantity != null ? { quantity: body.quantity } : {}),
        ...(body.selected != null ? { selected: body.selected } : {}),
      },
    });

    return NextResponse.json(await serializeCart(session.id));
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = deleteSchema.parse(await req.json().catch(() => ({})));
    if (body.clear) {
      await prisma.cartItem.deleteMany({ where: { userId: session.id } });
    } else {
      const ids = body.ids?.length
        ? body.ids
        : body.id
          ? [body.id]
          : [];
      if (ids.length === 0) {
        return NextResponse.json({ error: "缺少 id" }, { status: 400 });
      }
      await prisma.cartItem.deleteMany({
        where: { userId: session.id, id: { in: ids } },
      });
    }
    return NextResponse.json(await serializeCart(session.id));
  } catch {
    return NextResponse.json({ error: "删除失败" }, { status: 400 });
  }
}

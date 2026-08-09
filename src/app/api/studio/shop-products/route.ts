/**
 * 站长 / 可售角色：商城商品 CRUD（productType=PRODUCT）
 * 与组课 compose 隔离，避免并行「产品管理」冲突。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_COURSE_COVER_URL } from "@/lib/cover-images";
import { prisma } from "@/lib/db";
import { PRODUCT_TITLE_MAX } from "@/lib/media";
import { yuanToCents } from "@/lib/money";
import {
  parseGallery,
  parseSpecs,
  SHOP_PRODUCT_TYPE,
  stringifyGallery,
  stringifySpecs,
  type ShopSpecsConfig,
} from "@/lib/shop";
import { requireCreateSellableUser, studioErrorResponse } from "@/lib/studio";
import { canViewAllStudioData } from "@/lib/roles";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";

const specsSchema = z.object({
  options: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(20),
        values: z.array(z.string().trim().min(1).max(40)).min(1).max(30),
      }),
    )
    .max(5)
    .optional()
    .default([]),
});

const createSchema = z.object({
  title: z.string().trim().min(2).max(PRODUCT_TITLE_MAX),
  subtitle: z.string().trim().max(200).optional(),
  description: z.string().trim().max(10000).optional().default(""),
  price: z.union([z.string(), z.number()]),
  originalPrice: z.union([z.string(), z.number()]).optional(),
  hidePrice: z.boolean().optional(),
  coverUrl: z.string().max(800).optional(),
  gallery: z.array(z.string().max(800)).max(12).optional(),
  specs: specsSchema.optional(),
  categoryId: z.string().optional().nullable(),
  publish: z.boolean().optional(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(2).max(PRODUCT_TITLE_MAX).optional(),
  subtitle: z.string().trim().max(200).optional(),
  description: z.string().trim().max(10000).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  originalPrice: z.union([z.string(), z.number()]).optional(),
  hidePrice: z.boolean().optional(),
  coverUrl: z.string().max(800).optional(),
  gallery: z.array(z.string().max(800)).max(12).optional(),
  specs: specsSchema.optional(),
  categoryId: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

function teacherScope(sessionId: string, role: string) {
  return canViewAllStudioData(role) ? {} : { teacherId: sessionId };
}

export async function GET() {
  try {
    const session = await requireCreateSellableUser();
    const products = await prisma.course.findMany({
      where: {
        productType: SHOP_PRODUCT_TYPE,
        ...teacherScope(session.id, session.role),
      },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { orders: true } },
      },
      orderBy: [{ isPinned: "desc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({
      products: products.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        subtitle: p.subtitle,
        description: p.description,
        coverUrl: p.coverUrl,
        gallery: parseGallery(p.galleryJson),
        specs: parseSpecs(p.specsJson),
        price: p.price,
        originalPrice: p.originalPrice,
        hidePrice: p.hidePrice,
        status: p.status,
        studentCount: p.studentCount,
        categoryId: p.categoryId,
        categoryName: p.category?.name || "",
        orderCount: p._count.orders,
        updatedAt: p.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    const mapped = studioErrorResponse(e);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireCreateSellableUser();
    const body = createSchema.parse(await req.json());

    let priceCents: number;
    try {
      priceCents = yuanToCents(body.price);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "价格无效" },
        { status: 400 },
      );
    }

    let originalCents = priceCents;
    if (body.originalPrice != null && String(body.originalPrice).trim() !== "") {
      try {
        originalCents = yuanToCents(body.originalPrice);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "划线价无效" },
          { status: 400 },
        );
      }
    }

    const gallery = (body.gallery || []).map((u) => u.trim()).filter(Boolean);
    const coverUrl =
      body.coverUrl?.trim() || gallery[0] || DEFAULT_COURSE_COVER_URL;
    const specs: ShopSpecsConfig = body.specs || { options: [] };

    const baseSlug = slugify(body.title) || `shop-${Date.now()}`;
    let slug = baseSlug;
    let i = 1;
    while (await prisma.course.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`;
    }

    const publish = body.publish ?? true;

    const product = await prisma.course.create({
      data: {
        title: body.title,
        slug,
        subtitle: body.subtitle || "",
        description: body.description || "商城商品",
        coverUrl,
        galleryJson: stringifyGallery(
          gallery.length ? gallery : coverUrl ? [coverUrl] : [],
        ),
        specsJson: stringifySpecs(specs),
        price: priceCents,
        originalPrice: Math.max(originalCents, priceCents),
        isFree: priceCents <= 0,
        hidePrice: Boolean(body.hidePrice),
        status: publish ? "PUBLISHED" : "DRAFT",
        productType: SHOP_PRODUCT_TYPE,
        teacherId: session.id,
        categoryId: body.categoryId || null,
      },
    });

    return NextResponse.json({ id: product.id, slug: product.slug });
  } catch (e) {
    const mapped = studioErrorResponse(e);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireCreateSellableUser();
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.course.findFirst({
      where: {
        id: body.id,
        productType: SHOP_PRODUCT_TYPE,
        ...teacherScope(session.id, session.role),
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "商品不存在" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.title != null) data.title = body.title;
    if (body.subtitle != null) data.subtitle = body.subtitle;
    if (body.description != null) data.description = body.description;
    if (body.coverUrl != null) data.coverUrl = body.coverUrl;
    if (body.status != null) data.status = body.status;
    if (body.categoryId !== undefined) data.categoryId = body.categoryId;
    if (body.gallery != null) {
      const gallery = body.gallery.map((u) => u.trim()).filter(Boolean);
      data.galleryJson = stringifyGallery(gallery);
      if (!body.coverUrl && gallery[0]) data.coverUrl = gallery[0];
    }
    if (body.specs != null) {
      data.specsJson = stringifySpecs(body.specs);
    }
    if (body.price != null) {
      try {
        const cents = yuanToCents(body.price);
        data.price = cents;
        data.isFree = cents <= 0;
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "价格无效" },
          { status: 400 },
        );
      }
    }
    if (body.originalPrice != null && String(body.originalPrice).trim() !== "") {
      try {
        data.originalPrice = yuanToCents(body.originalPrice);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "划线价无效" },
          { status: 400 },
        );
      }
    }
    if (body.hidePrice !== undefined) data.hidePrice = body.hidePrice;

    const updated = await prisma.course.update({
      where: { id: existing.id },
      data,
    });

    return NextResponse.json({ id: updated.id, slug: updated.slug });
  } catch (e) {
    const mapped = studioErrorResponse(e);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireCreateSellableUser();
    const { id } = z.object({ id: z.string().min(1) }).parse(await req.json());
    const existing = await prisma.course.findFirst({
      where: {
        id,
        productType: SHOP_PRODUCT_TYPE,
        ...teacherScope(session.id, session.role),
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "商品不存在" }, { status: 404 });
    }
    await prisma.course.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = studioErrorResponse(e);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

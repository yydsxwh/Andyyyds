/**
 * Studio 优惠券 API 序列化：含商品适用范围，供列表/创建/更新统一返回。
 */

export type CouponWithProducts = {
  id: string;
  code: string;
  title: string;
  type: string;
  discountCents: number;
  percentOff: number;
  minAmount: number;
  maxUses: number;
  usedCount: number;
  maxPerUser: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  productScope: string;
  createdById: string;
  createdAt: Date;
  products?: Array<{
    courseId: string;
    course?: {
      id: string;
      title: string;
      slug: string;
      productType: string;
    } | null;
  }>;
};

export function serializeStudioCoupon(c: CouponWithProducts) {
  const products = (c.products || [])
    .map((p) =>
      p.course
        ? {
            id: p.course.id,
            title: p.course.title,
            slug: p.course.slug,
            productType: p.course.productType,
          }
        : null,
    )
    .filter(Boolean) as Array<{
    id: string;
    title: string;
    slug: string;
    productType: string;
  }>;

  return {
    id: c.id,
    code: c.code,
    title: c.title,
    type: c.type,
    discountCents: c.discountCents,
    percentOff: c.percentOff,
    minAmount: c.minAmount,
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    maxPerUser: c.maxPerUser,
    startsAt: c.startsAt?.toISOString() ?? null,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    isActive: c.isActive,
    productScope: c.productScope || "ALL",
    productIds: products.map((p) => p.id),
    productTitles: products.map((p) => p.title),
    products,
    createdById: c.createdById,
    createdAt: c.createdAt.toISOString(),
  };
}

/** Prisma include：带商品标题/slug，便于后台展示与分享链 */
export const couponProductsInclude = {
  products: {
    include: {
      course: {
        select: { id: true, title: true, slug: true, productType: true },
      },
    },
  },
} as const;

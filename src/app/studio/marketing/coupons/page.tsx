import { redirect } from "next/navigation";
import {
  CouponAdminPanel,
  type CouponAdminRow,
  type CouponProductOption,
} from "@/components/coupon-admin-panel";
import { MarketingSubnav } from "@/components/marketing-subnav";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageCoupons, canViewAllStudioData } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function StudioCouponsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageCoupons(session.role)) redirect("/studio");

  const seeAll = canViewAllStudioData(session.role);
  const [rows, products] = await Promise.all([
    prisma.coupon.findMany({
      where: seeAll ? undefined : { createdById: session.id },
      include: {
        products: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                productType: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.course.findMany({
      where: seeAll ? undefined : { teacherId: session.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        productType: true,
        status: true,
      },
      take: 500,
    }),
  ]);

  const initialCoupons: CouponAdminRow[] = rows.map((c) => {
    const productList = c.products
      .map((p) => p.course)
      .filter(Boolean)
      .map((course) => ({
        id: course!.id,
        title: course!.title,
        slug: course!.slug,
        productType: course!.productType,
      }));
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
      productIds: productList.map((p) => p.id),
      productTitles: productList.map((p) => p.title),
      products: productList,
      createdAt: c.createdAt.toISOString(),
    };
  });

  const productOptions: CouponProductOption[] = products;

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="marketing" />
      <div>
        <h1 className="text-3xl font-semibold">优惠券</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          创建比例折扣或定额减免；可设全站/指定商品；列表可分享链接到微信或
          QQ。学员打开链接后下单可预填券码。
        </p>
      </div>
      <MarketingSubnav current="coupons" />
      <CouponAdminPanel
        initialCoupons={initialCoupons}
        productOptions={productOptions}
      />
    </div>
  );
}

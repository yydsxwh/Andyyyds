import { redirect } from "next/navigation";
import { StudioNav } from "@/components/studio-nav";
import { StudioShopPanel } from "@/components/studio-shop-panel";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { canCreateSellableProducts, isAdmin } from "@andyyyds/shared/roles";
import { parseGallery, parseSpecs, SHOP_PRODUCT_TYPE } from "@andyyyds/shared/shop";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "商城商品",
};

export default async function StudioShopPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // 站长看完整后台导航；商家/代理也可上架自己的商城商品
  if (!canCreateSellableProducts(session.role)) redirect("/studio");

  const teacherScope = isAdmin(session.role) ? {} : { teacherId: session.id };

  const [products, categories] = await Promise.all([
    prisma.course.findMany({
      where: { productType: SHOP_PRODUCT_TYPE, ...teacherScope },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { orders: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const initialProducts = await Promise.all(
    products.map(async (p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      subtitle: p.subtitle,
      description: p.description,
      coverUrl: await resolveStoredAccessUrl(p.coverUrl),
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
  );

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="shop" area={isAdmin(session.role) ? "admin" : "creator"} />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">商城商品</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          上架后出现在前台 /shop。下单必填/选填字段请到「内容管理」配置。
        </p>
      </div>
      <StudioShopPanel
        initialProducts={initialProducts}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}

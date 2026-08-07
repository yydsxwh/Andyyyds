import { redirect } from "next/navigation";
import {
  AdminProductsPanel,
  type AdminProductRow,
} from "@/components/admin-products-panel";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PRODUCT_PLAZA_ORDER_BY } from "@/lib/product-display-order";
import { isAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * 站长「产品管理」：统一管理可售 Course（单课/专栏/资料）的展示次序、置顶、精华与增删改。
 * 与创作者中心「课程与资料」分离：此处仅站长，面向全站运营。
 */
export default async function StudioProductsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.role)) redirect("/studio");

  const rows = await prisma.course.findMany({
    include: {
      teacher: { select: { name: true } },
      category: { select: { name: true } },
      _count: { select: { enrollments: true, orders: true } },
    },
    orderBy: PRODUCT_PLAZA_ORDER_BY,
  });

  const products: AdminProductRow[] = rows.map((p) => ({
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
    teacherName: p.teacher.name,
    categoryName: p.category?.name || "",
    enrollmentCount: p._count.enrollments,
    orderCount: p._count.orders,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <div className="container space-y-6 py-10 sm:py-12">
      <StudioNav current="products" area="admin" />

      <div>
        <h1 className="text-3xl font-semibold">产品管理</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          管理全站单课、专栏、资料与商城商品的展示次序、置顶与精华。商城新建/规格多图请进「商城商品」；
          课程与资料新建走组课流程。有成交记录时优先下架，硬删除会清除订单与报名。
        </p>
      </div>

      <div className="surface rounded-[28px] p-4 sm:p-6">
        <AdminProductsPanel
          key={products
            .map(
              (p) =>
                `${p.id}:${p.sortOrder}:${p.isPinned}:${p.isFeatured}:${p.status}`,
            )
            .join("|")}
          initialProducts={products}
        />
      </div>
    </div>
  );
}

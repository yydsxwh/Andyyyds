import Link from "next/link";
import { redirect } from "next/navigation";
import { CoursesSubnav } from "@andyyyds/courses/components/courses-subnav";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { StudioProductDeleteButton } from "@andyyyds/courses/components/studio-product-delete-button";
import { productDetailPath, productTypeLabel } from "@andyyyds/shared/product-types";
import {
  canCreateSellableProducts,
  canDeleteCourses,
  canManageCourses,
  canViewAllStudioData,
} from "@andyyyds/shared/roles";
import { formatPrice } from "@andyyyds/shared/utils";

export const dynamic = "force-dynamic";

/**
 * 创作者中心「我的资料」：只列 productType=MATERIAL，降低「找不到创建资料」的困惑。
 * 创建仍走 compose，并预选资料类型。
 */
export default async function StudioMaterialsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageCourses(session.role)) {
    redirect("/studio");
  }

  const canCreate = canCreateSellableProducts(session.role);
  const canDelete = canDeleteCourses(session.role);
  const teacherId = canViewAllStudioData(session.role) ? undefined : session.id;
  const materials = await prisma.course.findMany({
    where: {
      productType: "MATERIAL",
      ...(teacherId ? { teacherId } : {}),
    },
    include: { _count: { select: { enrollments: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const composeHref = "/studio/courses/compose?type=MATERIAL";

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="courses" />
      <div>
        <h1 className="text-3xl font-semibold">我的资料</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {canCreate
            ? "管理已上架资料包；创建时在组课页选择类型「资料」，会出现在前台资料广场。"
            : "查看名下资料；新建可售资料需入驻商家、加盟代理或站长权限。"}
        </p>
      </div>

      <CoursesSubnav current="materials" canCreate={canCreate} />

      {canCreate ? (
        <Link
          href={composeHref}
          className="surface block rounded-[24px] p-5 transition hover:-translate-y-0.5"
        >
          <div className="text-lg font-semibold">创建资料</div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            多选素材、定价上架，生成资料包（前台走资料广场）
          </p>
        </Link>
      ) : null}

      <div className="surface rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">
          资料列表
          <span className="ml-2 text-sm font-normal text-[var(--muted)]">
            {materials.length} 个
          </span>
        </h2>
        <div className="mt-4 space-y-3">
          {materials.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-2xl bg-white/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-medium">
                  <span className="mr-2 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs text-[var(--brand)]">
                    {productTypeLabel(item.productType)}
                  </span>
                  {item.title}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {item.status === "PUBLISHED" ? "已上架" : "草稿"} ·{" "}
                  {formatPrice(item.price)} · 已购 {item._count.enrollments}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link
                  href={`/learn/${item.slug}`}
                  className="font-medium text-[var(--brand)]"
                >
                  预览内容
                </Link>
                <Link
                  href={`/studio/courses/${item.id}/edit`}
                  className="font-medium text-[var(--brand)]"
                >
                  编辑资料
                </Link>
                <Link
                  href={`/studio/courses/${item.id}/content`}
                  className="font-medium text-[var(--brand)]"
                >
                  编辑内容
                </Link>
                <Link
                  href={productDetailPath(item.slug, item.productType)}
                  className="text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  查看前台
                </Link>
                {canDelete ? (
                  <StudioProductDeleteButton
                    productId={item.id}
                    title={item.title}
                    productType={item.productType}
                  />
                ) : null}
              </div>
            </div>
          ))}
          {materials.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {canCreate ? (
                <>
                  还没有资料。去{" "}
                  <Link href={composeHref} className="text-[var(--brand)]">
                    创建资料
                  </Link>{" "}
                  上架第一个吧。
                </>
              ) : (
                "暂无已分配的资料。老师不可新建可售资料，请联系站长。"
              )}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

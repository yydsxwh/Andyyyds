import Link from "next/link";
import { redirect } from "next/navigation";
import { CoursesSubnav } from "@/components/courses-subnav";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isProductType,
  productDetailPath,
  productTypeLabel,
  type ProductType,
} from "@/lib/product-types";
import { StudioProductDeleteButton } from "@/components/studio-product-delete-button";
import {
  canCreateSellableProducts,
  canDeleteCourses,
  canManageCourses,
  canViewAllStudioData,
} from "@/lib/roles";
import { getStudioNavConfig } from "@/lib/site-settings";
import {
  studioNavHref,
  studioNavLabel,
} from "@/lib/studio-nav-config";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTERS: { key: "all" | ProductType; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "COURSE", label: "单课" },
  { key: "COLUMN", label: "专栏" },
  { key: "MATERIAL", label: "资料" },
];

export default async function StudioCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageCourses(session.role)) {
    redirect("/studio");
  }

  const params = await searchParams;
  const typeParam = (params.type || "").toUpperCase();
  // 仅单课/专栏/资料可筛；MEETUP/PRODUCT 有独立入口，勿经 ?type= 回流本列表
  const activeFilter: "all" | ProductType =
    isProductType(typeParam) &&
    (typeParam === "COURSE" ||
      typeParam === "COLUMN" ||
      typeParam === "MATERIAL")
      ? typeParam
      : "all";

  const canCreate = canCreateSellableProducts(session.role);
  const canDelete = canDeleteCourses(session.role);
  const teacherId = canViewAllStudioData(session.role) ? undefined : session.id;
  // 约搭壳(MEETUP)/商城(PRODUCT)不是课程：勿混进「我的课程」以免出现「编辑章节」等误操作
  const courseListTypes =
    activeFilter === "all"
      ? (["COURSE", "COLUMN", "MATERIAL"] as const)
      : ([activeFilter] as const);
  const [courses, studioNav] = await Promise.all([
    prisma.course.findMany({
      where: {
        ...(teacherId ? { teacherId } : {}),
        productType: { in: [...courseListTypes] },
      },
      include: { _count: { select: { enrollments: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    getStudioNavConfig(),
  ]);

  const composeLabel = studioNavLabel(
    studioNav.courses,
    "compose",
    "创建产品",
  );
  const composeHref = studioNavHref(
    studioNav.courses,
    "compose",
    "/studio/courses/compose",
  );
  const createMaterialHref = "/studio/courses/compose?type=MATERIAL";

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="courses" />
      <div>
        <h1 className="text-3xl font-semibold">课程与资料</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {canCreate
            ? "管理已上架单课、专栏与资料；创建时在组课页选择类型（含「资料」）。"
            : "维护已分配或名下的课程与资料；新建可售产品需入驻商家、加盟代理或站长权限。"}
        </p>
      </div>

      <CoursesSubnav current="list" canCreate={canCreate} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {canCreate ? (
          <>
            <Link
              href={composeHref}
              className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
            >
              <div className="text-lg font-semibold">{composeLabel}</div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                多选素材、排顺序、定价上架，生成单课、专栏或资料
              </p>
            </Link>
            <Link
              href={createMaterialHref}
              className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
            >
              <div className="text-lg font-semibold">创建资料</div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                直接进入组课并预选「资料」，上架后出现在资料广场
              </p>
            </Link>
          </>
        ) : null}
        <Link
          href="/studio/media"
          className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
        >
          <div className="text-lg font-semibold">去素材中心</div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            上传、分类管理视频/文档素材
            {canCreate ? "后再来组课或组资料" : ""}
          </p>
        </Link>
      </div>

      <div className="surface rounded-[28px] p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">我的课程 / 专栏 / 资料</h2>
          <div className="flex flex-wrap gap-2" aria-label="按产品类型筛选">
            {FILTERS.map((filter) => {
              const href =
                filter.key === "all"
                  ? "/studio/courses"
                  : `/studio/courses?type=${filter.key}`;
              const active = activeFilter === filter.key;
              return (
                <Link
                  key={filter.key}
                  href={href}
                  className={`min-h-10 rounded-full px-3 py-2 text-sm ${
                    active
                      ? "bg-[var(--brand)] text-white"
                      : "border border-[var(--line)] bg-white/70 text-[var(--muted)]"
                  }`}
                >
                  {filter.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {courses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col gap-2 rounded-2xl bg-white/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-medium">
                  <span className="mr-2 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs text-[var(--brand)]">
                    {productTypeLabel(course.productType)}
                  </span>
                  {course.title}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {course.status === "PUBLISHED" ? "已上架" : "草稿"} ·{" "}
                  {formatPrice(course.price)} ·{" "}
                  {course.productType === "MATERIAL" ? "已购" : "报名"}{" "}
                  {course._count.enrollments}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link
                  href={`/learn/${course.slug}`}
                  className="font-medium text-[var(--brand)]"
                >
                  预览网课
                </Link>
                <Link
                  href={`/studio/courses/${course.id}/edit`}
                  className="font-medium text-[var(--brand)]"
                >
                  编辑课程
                </Link>
                <Link
                  href={`/studio/courses/${course.id}/content`}
                  className="font-medium text-[var(--brand)]"
                >
                  {course.productType === "COLUMN"
                    ? "编辑套餐"
                    : "编辑章节/课时"}
                </Link>
                {course.productType === "COURSE" ||
                course.productType === "COLUMN" ? (
                  <Link
                    href={`/studio/courses/${course.id}/progress`}
                    className="font-medium text-[var(--brand)]"
                  >
                    学习进度
                  </Link>
                ) : null}
                <Link
                  href={productDetailPath(course.slug, course.productType)}
                  className="text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  查看前台
                </Link>
                {canDelete ? (
                  <StudioProductDeleteButton
                    productId={course.id}
                    title={course.title}
                    productType={course.productType}
                  />
                ) : null}
              </div>
            </div>
          ))}
          {courses.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {canCreate ? (
                <>
                  还没有
                  {activeFilter === "MATERIAL"
                    ? "资料"
                    : activeFilter === "all"
                      ? "产品"
                      : productTypeLabel(activeFilter)}
                  。先去{" "}
                  <Link
                    href={
                      activeFilter === "MATERIAL"
                        ? createMaterialHref
                        : composeHref
                    }
                    className="text-[var(--brand)]"
                  >
                    {activeFilter === "MATERIAL" ? "创建资料" : composeLabel}
                  </Link>{" "}
                  生成一个吧。
                </>
              ) : (
                "暂无已分配的课程。老师不可新建可售课程，请联系站长分配。"
              )}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ComposeProductForm } from "@andyyyds/courses/components/compose-product-form";
import { CoursesSubnav } from "@andyyyds/courses/components/courses-subnav";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { canCreateSellableProducts, canManageCourses } from "@andyyyds/shared/roles";
import { getStudioNavConfig, getUiCopy } from "@andyyyds/shared/site-settings";
import { studioNavLabel } from "@andyyyds/shared/studio-nav-config";

export const dynamic = "force-dynamic";

export default async function StudioCoursesComposePage({
  searchParams,
}: {
  searchParams: Promise<{ assets?: string; type?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageCourses(session.role)) {
    redirect("/studio");
  }
  if (!canCreateSellableProducts(session.role)) {
    redirect("/studio/courses");
  }

  const params = await searchParams;
  const initialSelectedIds = (params.assets || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  // 支持 ?type=MATERIAL / ?type=MEETUP 预选；MEETUP 仅作入口，仍不走组课 API
  const typeParam = (params.type || "").toUpperCase();
  const initialProductType =
    typeParam === "COURSE" ||
    typeParam === "COLUMN" ||
    typeParam === "MATERIAL" ||
    typeParam === "MEETUP"
      ? typeParam
      : undefined;

  const [assets, bundleCourses, uiCopy, studioNav] = await Promise.all([
    prisma.mediaAsset.findMany({
      where: { ownerId: session.id },
      include: { category: true },
      orderBy: { updatedAt: "desc" },
    }),
    // 专栏套餐只能打包自己的单课
    prisma.course.findMany({
      where: { teacherId: session.id, productType: "COURSE" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        status: true,
        coverUrl: true,
      },
    }),
    getUiCopy(),
    getStudioNavConfig(),
  ]);

  const composeLabel = studioNavLabel(
    studioNav.courses,
    "compose",
    "创建产品",
  );
  const preselectMaterial = initialProductType === "MATERIAL";

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="courses" />
      <div>
        <h1 className="text-3xl font-semibold">
          {preselectMaterial ? "创建资料" : composeLabel}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          先选产品类型：单课/资料用素材组课；专栏是套餐，选择多门单课打包售卖。
          资料会出现在前台「资料广场」。活动走约搭创建（可设价格、分档报名），不进「我的课程」。
          {assets.length === 0 ? (
            <>
              {" "}
              还没有素材？先去{" "}
              <Link href="/studio/media" className="text-[var(--brand)]">
                素材中心
              </Link>{" "}
              上传。
            </>
          ) : null}
        </p>
      </div>
      <CoursesSubnav current="compose" canCreate />
      <ComposeProductForm
        assets={assets}
        bundleCourses={bundleCourses}
        initialSelectedIds={initialSelectedIds}
        initialProductType={initialProductType}
        copy={uiCopy.compose}
      />
    </div>
  );
}

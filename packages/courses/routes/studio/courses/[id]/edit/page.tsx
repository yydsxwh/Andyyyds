import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CouponAdminPanel,
  type CouponAdminRow,
  type CouponProductOption,
} from "@/components/coupon-admin-panel";
import { CoursesSubnav } from "@andyyyds/courses/components/courses-subnav";
import { EditCourseForm } from "@andyyyds/courses/components/edit-course-form";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import {
  isMeetupProductType,
  meetupActivityEditPath,
} from "@andyyyds/shared/product-types";
import {
  canDeleteCourses,
  canManageCoupons,
  canManageCourses,
  canViewAllStudioData,
} from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

/**
 * 编辑课程 = 产品介绍信息（标题/封面/价格等）+ 本商品优惠券。
 * 章节/课时在 /studio/courses/[id]/content。
 */
export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageCourses(session.role)) {
    redirect("/studio");
  }

  const { id } = await params;
  const seeAll = canViewAllStudioData(session.role);
  const course = await prisma.course.findFirst({
    where: {
      id,
      ...(seeAll ? {} : { teacherId: session.id }),
    },
    include: {
      chapters: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: { orderBy: { sortOrder: "asc" } },
        },
      },
      bundleItems: {
        orderBy: { sortOrder: "asc" },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              price: true,
              status: true,
              coverUrl: true,
            },
          },
        },
      },
    },
  });
  if (!course) notFound();

  // 约搭≠课程：壳商品禁止走 edit-course-form，统一进活动编辑（时间/地点/分档）
  if (isMeetupProductType(course.productType)) {
    redirect(meetupActivityEditPath(course.slug, { fromCourseEdit: true }));
  }
  if (course.productType === "PRODUCT") {
    redirect("/studio/shop");
  }

  const showCoupons = canManageCoupons(session.role);
  const [availableBundleCourses, couponRows, productRows] = await Promise.all([
    prisma.course.findMany({
      where: {
        productType: "COURSE",
        id: { not: course.id },
        ...(seeAll
          ? { teacherId: course.teacherId }
          : { teacherId: session.id }),
      },
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
    showCoupons
      ? prisma.coupon.findMany({
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
        })
      : Promise.resolve([]),
    showCoupons
      ? prisma.course.findMany({
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
        })
      : Promise.resolve([]),
  ]);

  const initialCoupons: CouponAdminRow[] = couponRows.map((c) => {
    const productList = c.products
      .map((p) => p.course)
      .filter(Boolean)
      .map((item) => ({
        id: item!.id,
        title: item!.title,
        slug: item!.slug,
        productType: item!.productType,
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

  const productOptions: CouponProductOption[] = productRows;
  const contentLabel =
    course.productType === "COLUMN" ? "编辑套餐内容" : "编辑章节/课时";

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="courses" />
      <CoursesSubnav current="list" />
      <EditCourseForm
        mode="product"
        course={{
          id: course.id,
          title: course.title,
          slug: course.slug,
          subtitle: course.subtitle,
          description: course.description,
          price: course.price,
          hidePrice: course.hidePrice,
          coverUrl: course.coverUrl,
          status: course.status,
          productType: course.productType,
          bundleCourses: course.bundleItems.map((item) => item.course),
          chapters: course.chapters.map((c) => ({
            id: c.id,
            title: c.title,
            sortOrder: c.sortOrder,
            lessons: c.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              sortOrder: l.sortOrder,
              type: l.type,
              content: l.content,
              videoUrl: l.videoUrl,
              durationSec: l.durationSec,
              isPreview: l.isPreview,
              mediaAssetId: l.mediaAssetId,
            })),
          })),
        }}
        mediaAssets={[]}
        availableBundleCourses={availableBundleCourses}
        canDeleteStructure={canDeleteCourses(session.role)}
        canDeleteProduct={canDeleteCourses(session.role)}
      />

      {showCoupons ? (
        <div className="mx-auto max-w-3xl">
          <CouponAdminPanel
            embedded
            defaultProductId={course.id}
            initialCoupons={initialCoupons}
            productOptions={productOptions}
          />
        </div>
      ) : null}

      <p className="flex flex-wrap items-center justify-center gap-4 text-center text-sm text-[var(--muted)]">
        <Link
          href={`/studio/courses/${course.id}/content`}
          className="text-[var(--brand)]"
        >
          {contentLabel}
        </Link>
        {course.productType === "COURSE" || course.productType === "COLUMN" ? (
          <Link
            href={`/studio/courses/${course.id}/progress`}
            className="text-[var(--brand)]"
          >
            查看学员学习进度
          </Link>
        ) : null}
        <Link href="/studio/courses" className="text-[var(--brand)]">
          ← 返回课程中心
        </Link>
      </p>
    </div>
  );
}

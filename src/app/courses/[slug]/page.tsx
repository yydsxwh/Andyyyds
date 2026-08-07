import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { CourseShareBar } from "@/components/course-share-bar";
import { PurchasePanel } from "@/components/purchase-panel";
import { getSession } from "@/lib/auth";
import { canPreviewAllLessons } from "@/lib/course-access";
import { listColumnBundleCourses } from "@/lib/course-bundle";
import { prisma } from "@/lib/db";
import { productDetailPath, productTypeLabel } from "@/lib/product-types";
import { getOrderFormConfig } from "@/lib/site-settings";
import { resolveStoredAccessUrl } from "@/lib/storage";
import { decodeRouteSlug, formatDuration, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteSlug(rawSlug);
  const session = await getSession();
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      teacher: true,
      category: true,
      chapters: {
        orderBy: { sortOrder: "asc" },
        include: { lessons: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!course || course.status !== "PUBLISHED") notFound();

  // 资料 / 商城商品走各自详情，避免两套 URL 并存
  if (course.productType === "MATERIAL") {
    redirect(`/materials/${encodeURIComponent(slug)}`);
  }
  if (course.productType === "PRODUCT") {
    redirect(`/shop/${encodeURIComponent(slug)}`);
  }

  const isColumn = course.productType === "COLUMN";
  const bundleCourses = isColumn
    ? await listColumnBundleCourses(course.id)
    : [];

  const enrolled = session
    ? Boolean(
        await prisma.enrollment.findUnique({
          where: {
            userId_courseId: { userId: session.id, courseId: course.id },
          },
        }),
      )
    : false;

  const ownedChildIds = new Set<string>();
  if (session && bundleCourses.length > 0) {
    const childEnrollments = await prisma.enrollment.findMany({
      where: {
        userId: session.id,
        courseId: { in: bundleCourses.map((c) => c.id) },
      },
      select: { courseId: true },
    });
    for (const row of childEnrollments) ownedChildIds.add(row.courseId);
  }

  const canStaffPreview = session
    ? canPreviewAllLessons({
        role: session.role,
        userId: session.id,
        teacherId: course.teacherId,
      })
    : false;

  const lessonCount = course.chapters.reduce((n, c) => n + c.lessons.length, 0);
  const orderForm = await getOrderFormConfig();
  const inviteCode = session
    ? (
        await prisma.user.findUnique({
          where: { id: session.id },
          select: { referralCode: true },
        })
      )?.referralCode || ""
    : "";
  const coverUrl = await resolveStoredAccessUrl(course.coverUrl);

  const bundleWithCovers = await Promise.all(
    bundleCourses.map(async (child) => ({
      ...child,
      coverDisplayUrl: await resolveStoredAccessUrl(child.coverUrl),
    })),
  );

  // 专栏套餐购买后留在详情页选课学习，不进空的 /learn
  const afterPurchaseHref = isColumn
    ? productDetailPath(slug, "COLUMN")
    : `/learn/${slug}`;

  const publishedBundle = bundleWithCovers.filter(
    (c) => c.status === "PUBLISHED",
  );
  const sumListPrice = publishedBundle.reduce((n, c) => n + c.price, 0);

  return (
    <div className="container grid gap-8 py-12 lg:grid-cols-[1.4fr_0.8fr]">
      <div className="space-y-8">
        <div className="surface overflow-hidden rounded-[32px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt={course.title}
            className="aspect-[16/9] w-full object-cover"
          />
          <div className="space-y-4 p-6 sm:p-8">
            <div className="text-sm text-[var(--muted)]">
              {productTypeLabel(course.productType)}
              {isColumn ? "套餐" : ""} ·{" "}
              {course.category?.name ?? "综合"} · {course.teacher.name}
            </div>
            <h1 className="text-3xl font-semibold">{course.title}</h1>
            <p className="text-[var(--muted)]">{course.subtitle}</p>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
              <span>{course.studentCount} 人在学</span>
              <span>★ {course.rating.toFixed(1)}</span>
              {isColumn ? (
                <span>
                  含 {publishedBundle.length || bundleWithCovers.length} 门单课
                </span>
              ) : (
                <span>{lessonCount} 课时</span>
              )}
              <span>{course.isFree ? "免费" : formatPrice(course.price)}</span>
              {isColumn && sumListPrice > course.price && course.price > 0 ? (
                <span className="line-through">
                  单买合计 {formatPrice(sumListPrice)}
                </span>
              ) : null}
            </div>
            <p className="leading-7 text-[var(--ink)]">{course.description}</p>
          </div>
        </div>

        {isColumn ? (
          <div className="surface rounded-[32px] p-6 sm:p-8">
            <h2 className="text-xl font-semibold">套餐包含单课</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              购买本专栏后，下列每门单课均自动开通学习权限；也可单独购买某一门。
            </p>
            <ul className="mt-6 space-y-3">
              {bundleWithCovers.map((child, index) => {
                const owned = ownedChildIds.has(child.id);
                return (
                  <li key={child.id}>
                    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-white/60 p-4 sm:flex-row sm:items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={child.coverDisplayUrl}
                        alt=""
                        className="aspect-video w-full shrink-0 rounded-xl object-cover sm:h-20 sm:w-32 sm:aspect-auto"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-[var(--muted)]">
                          第 {index + 1} 门
                          {child.status !== "PUBLISHED" ? " · 未上架" : ""}
                          {owned ? " · 已拥有" : ""}
                        </div>
                        <div className="mt-0.5 font-medium">{child.title}</div>
                        {child.subtitle ? (
                          <p className="mt-1 truncate text-sm text-[var(--muted)]">
                            {child.subtitle}
                          </p>
                        ) : null}
                        <div className="mt-1 text-sm text-[var(--muted)]">
                          单独售价 {formatPrice(child.price)}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {enrolled || owned || canStaffPreview ? (
                          <Link
                            href={`/learn/${child.slug}`}
                            className="btn btn-primary min-h-11 px-4"
                          >
                            去学习
                          </Link>
                        ) : null}
                        <Link
                          href={productDetailPath(child.slug, "COURSE")}
                          className="btn btn-secondary min-h-11 px-4"
                        >
                          查看单课
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {bundleWithCovers.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                本专栏尚未配置所含单课
                {lessonCount > 0
                  ? "（仍为旧版素材目录，请创作者在编辑页改为套餐）"
                  : ""}
                。
              </p>
            ) : null}

            {/* 旧版素材型专栏仍展示目录，避免存量内容不可见 */}
            {lessonCount > 0 ? (
              <div className="mt-8 border-t border-[var(--line)] pt-6">
                <h3 className="font-medium">附加内容目录</h3>
                <div className="mt-4 space-y-5">
                  {course.chapters.map((chapter) => (
                    <div key={chapter.id}>
                      <h4 className="text-sm font-medium">{chapter.title}</h4>
                      <ul className="mt-2 space-y-2">
                        {chapter.lessons.map((lesson) => (
                          <li
                            key={lesson.id}
                            className="flex items-center justify-between gap-3 rounded-2xl bg-white/60 px-4 py-3 text-sm"
                          >
                            <span>{lesson.title}</span>
                            <span className="text-[var(--muted)]">
                              {formatDuration(lesson.durationSec)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="surface rounded-[32px] p-6 sm:p-8">
            <h2 className="text-xl font-semibold">课程大纲</h2>
            <div className="mt-6 space-y-5">
              {course.chapters.map((chapter) => (
                <div key={chapter.id}>
                  <h3 className="font-medium">{chapter.title}</h3>
                  <ul className="mt-3 space-y-2">
                    {chapter.lessons.map((lesson) => (
                      <li
                        key={lesson.id}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-white/60 px-4 py-3 text-sm"
                      >
                        <span>
                          {lesson.title}
                          {lesson.isPreview ? (
                            <span className="ml-2 text-[var(--brand)]">试看</span>
                          ) : null}
                          {lesson.type === "LIVE" ? (
                            <span className="ml-2 text-[var(--accent)]">直播</span>
                          ) : null}
                        </span>
                        <span className="text-[var(--muted)]">
                          {formatDuration(lesson.durationSec)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <PurchasePanel
          courseId={course.id}
          price={course.price}
          isFree={course.isFree}
          enrolled={enrolled}
          slug={course.slug}
          orderForm={orderForm}
          productLabel={isColumn ? "专栏" : "课程"}
          canStaffPreview={canStaffPreview}
          learnHref={afterPurchaseHref}
        />
        <CourseShareBar
          slug={course.slug}
          title={course.title}
          inviteCode={inviteCode}
          productType={course.productType}
        />
      </div>
    </div>
  );
}

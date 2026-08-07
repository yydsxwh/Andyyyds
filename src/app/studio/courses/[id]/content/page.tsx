import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CoursesSubnav } from "@/components/courses-subnav";
import { EditCourseForm } from "@/components/edit-course-form";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canDeleteCourses, canManageCourses, canViewAllStudioData } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * 编辑章节/课时（或专栏套餐内容），与「编辑课程」产品介绍页分离。
 */
export default async function EditCourseContentPage({
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

  const [mediaAssets, availableBundleCourses] = await Promise.all([
    prisma.mediaAsset.findMany({
      where: seeAll ? {} : { ownerId: session.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        fileUrl: true,
        durationSec: true,
      },
      take: 300,
    }),
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
  ]);

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="courses" />
      <CoursesSubnav current="list" />
      <EditCourseForm
        mode="content"
        course={{
          id: course.id,
          title: course.title,
          slug: course.slug,
          subtitle: course.subtitle,
          description: course.description,
          price: course.price,
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
        mediaAssets={mediaAssets}
        availableBundleCourses={availableBundleCourses}
        canDeleteStructure={canDeleteCourses(session.role)}
        canDeleteProduct={false}
      />
      <p className="flex flex-wrap items-center justify-center gap-4 text-center text-sm text-[var(--muted)]">
        <Link
          href={`/studio/courses/${course.id}/edit`}
          className="text-[var(--brand)]"
        >
          ← 返回编辑产品介绍
        </Link>
        <Link href="/studio/courses" className="text-[var(--brand)]">
          课程中心
        </Link>
      </p>
    </div>
  );
}

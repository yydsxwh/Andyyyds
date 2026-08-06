import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CoursesSubnav } from "@/components/courses-subnav";
import { EditCourseForm } from "@/components/edit-course-form";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "TEACHER" && session.role !== "ADMIN") {
    redirect("/studio");
  }

  const { id } = await params;
  const course = await prisma.course.findFirst({
    where: {
      id,
      ...(session.role === "ADMIN" ? {} : { teacherId: session.id }),
    },
    include: {
      chapters: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!course) notFound();

  const mediaAssets = await prisma.mediaAsset.findMany({
    where: session.role === "ADMIN" ? {} : { ownerId: session.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      fileUrl: true,
      durationSec: true,
    },
    take: 300,
  });

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="courses" />
      <CoursesSubnav current="list" />
      <EditCourseForm
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
      />
      <p className="text-center text-sm text-[var(--muted)]">
        <Link href="/studio/courses" className="text-[var(--brand)]">
          ← 返回课程中心
        </Link>
      </p>
    </div>
  );
}

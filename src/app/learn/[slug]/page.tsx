import { notFound, redirect } from "next/navigation";
import { LearnPlayer } from "@/components/learn-player";
import { getSession } from "@/lib/auth";
import { canPreviewAllLessons } from "@/lib/course-access";
import { prisma } from "@/lib/db";
import { decodeRouteSlug } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LearnCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteSlug(rawSlug);
  const session = await getSession();
  if (!session) redirect("/login");

  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      chapters: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            orderBy: { sortOrder: "asc" },
            include: {
              mediaAsset: {
                select: { name: true, type: true, sizeBytes: true },
              },
            },
          },
        },
      },
    },
  });
  if (!course) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.id, courseId: course.id } },
    include: { progress: true },
  });

  // 站长可预览任意课程；授课者可预览名下课程（不必先购买）
  const staffPreview = canPreviewAllLessons({
    role: session.role,
    userId: session.id,
    teacherId: course.teacherId,
  });
  const canAccessAll = Boolean(enrollment) || staffPreview;
  const progressMap = Object.fromEntries(
    (enrollment?.progress || []).map((p) => [
      p.lessonId,
      { completed: p.completed, positionSec: p.positionSec },
    ]),
  );
  const isMaterial = course.productType === "MATERIAL";

  return (
    <div className="container space-y-4 py-10">
      {staffPreview && !enrollment ? (
        <p className="rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/5 px-4 py-3 text-sm text-[var(--brand-strong)]">
          {isMaterial
            ? "站长 / 授课预览模式：可预览或下载全部资料，不计入学员购买。"
            : "站长 / 授课预览模式：可播放全部课时，不计入学员报名。"}
        </p>
      ) : null}
      <LearnPlayer
        courseTitle={course.title}
        productType={course.productType}
        canAccessAll={canAccessAll}
        enrollmentId={enrollment?.id}
        progressMap={progressMap}
        chapters={course.chapters.map((c) => ({
          id: c.id,
          title: c.title,
          lessons: c.lessons.map((l) => {
            // 资料课时以素材类型为准，避免旧数据 type 被误写成 VIDEO
            const type =
              course.productType === "MATERIAL" && l.mediaAsset?.type
                ? l.mediaAsset.type
                : l.type;
            return {
              id: l.id,
              title: l.title,
              type,
              content: l.content,
              videoUrl: l.videoUrl,
              isPreview: l.isPreview,
              durationSec: l.durationSec,
              liveAt: l.liveAt ? l.liveAt.toISOString() : null,
              fileName: l.mediaAsset?.name || undefined,
              fileSizeBytes: l.mediaAsset?.sizeBytes || undefined,
            };
          }),
        }))}
      />
    </div>
  );
}

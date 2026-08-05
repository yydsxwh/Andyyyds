import { notFound, redirect } from "next/navigation";
import { LearnPlayer } from "@/components/learn-player";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LearnCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      chapters: {
        orderBy: { sortOrder: "asc" },
        include: { lessons: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!course) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.id, courseId: course.id } },
    include: { progress: true },
  });

  const canAccessAll = Boolean(enrollment);
  const progressMap = Object.fromEntries(
    (enrollment?.progress || []).map((p) => [
      p.lessonId,
      { completed: p.completed, positionSec: p.positionSec },
    ]),
  );

  return (
    <div className="container py-10">
      <LearnPlayer
        courseTitle={course.title}
        canAccessAll={canAccessAll}
        enrollmentId={enrollment?.id}
        progressMap={progressMap}
        chapters={course.chapters.map((c) => ({
          id: c.id,
          title: c.title,
          lessons: c.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            type: l.type as "VIDEO" | "ARTICLE" | "LIVE",
            content: l.content,
            videoUrl: l.videoUrl,
            isPreview: l.isPreview,
            durationSec: l.durationSec,
            liveAt: l.liveAt ? l.liveAt.toISOString() : null,
          })),
        }))}
      />
    </div>
  );
}

import { notFound } from "next/navigation";
import { PurchasePanel } from "@/components/purchase-panel";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOrderFormConfig } from "@/lib/site-settings";
import { formatDuration, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  const enrolled = session
    ? Boolean(
        await prisma.enrollment.findUnique({
          where: {
            userId_courseId: { userId: session.id, courseId: course.id },
          },
        }),
      )
    : false;

  const lessonCount = course.chapters.reduce((n, c) => n + c.lessons.length, 0);
  const orderForm = await getOrderFormConfig();

  return (
    <div className="container grid gap-8 py-12 lg:grid-cols-[1.4fr_0.8fr]">
      <div className="space-y-8">
        <div className="surface overflow-hidden rounded-[32px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={course.coverUrl} alt={course.title} className="aspect-[16/9] w-full object-cover" />
          <div className="space-y-4 p-6 sm:p-8">
            <div className="text-sm text-[var(--muted)]">
              {course.productType === "COLUMN" ? "专栏" : "课程"} ·{" "}
              {course.category?.name ?? "综合"} · {course.teacher.name}
            </div>
            <h1 className="text-3xl font-semibold">{course.title}</h1>
            <p className="text-[var(--muted)]">{course.subtitle}</p>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
              <span>{course.studentCount} 人在学</span>
              <span>★ {course.rating.toFixed(1)}</span>
              <span>{lessonCount} 课时</span>
              <span>{course.isFree ? "免费" : formatPrice(course.price)}</span>
            </div>
            <p className="leading-7 text-[var(--ink)]">{course.description}</p>
          </div>
        </div>

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
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <PurchasePanel
          courseId={course.id}
          price={course.price}
          isFree={course.isFree}
          enrolled={enrolled}
          slug={course.slug}
          orderForm={orderForm}
        />
      </div>
    </div>
  );
}

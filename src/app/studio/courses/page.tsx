import Link from "next/link";
import { redirect } from "next/navigation";
import { CoursesSubnav } from "@/components/courses-subnav";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStudioNavConfig } from "@/lib/site-settings";
import {
  studioNavHref,
  studioNavLabel,
} from "@/lib/studio-nav-config";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StudioCoursesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "TEACHER" && session.role !== "ADMIN") {
    redirect("/studio");
  }

  const teacherId = session.role === "ADMIN" ? undefined : session.id;
  const [courses, studioNav] = await Promise.all([
    prisma.course.findMany({
      where: teacherId ? { teacherId } : undefined,
      include: { _count: { select: { enrollments: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    getStudioNavConfig(),
  ]);

  const composeLabel = studioNavLabel(studioNav.courses, "compose", "创建课程");
  const composeHref = studioNavHref(
    studioNav.courses,
    "compose",
    "/studio/courses/compose",
  );

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="courses" />
      <div>
        <h1 className="text-3xl font-semibold">课程中心</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          管理已上架课程/专栏，或用素材一键生成可售产品。
        </p>
      </div>

      <CoursesSubnav current="list" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={composeHref}
          className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
        >
          <div className="text-lg font-semibold">{composeLabel}</div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            多选素材、排顺序、定价上架，生成单课或专栏
          </p>
        </Link>
        <Link
          href="/studio/media"
          className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
        >
          <div className="text-lg font-semibold">去素材中心</div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            上传、分类管理视频素材后再来组课
          </p>
        </Link>
      </div>

      <div className="surface rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">我的课程 / 专栏</h2>
        <div className="mt-4 space-y-3">
          {courses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col gap-2 rounded-2xl bg-white/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-medium">
                  <span className="mr-2 rounded-full bg-[rgba(15,107,92,0.12)] px-2 py-0.5 text-xs text-[var(--brand)]">
                    {course.productType === "COLUMN" ? "专栏" : "课程"}
                  </span>
                  {course.title}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {course.status === "PUBLISHED" ? "已上架" : "草稿"} ·{" "}
                  {formatPrice(course.price)} · 报名 {course._count.enrollments}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link
                  href={`/studio/courses/${course.id}/edit`}
                  className="font-medium text-[var(--brand)]"
                >
                  编辑
                </Link>
                <Link
                  href={`/courses/${course.slug}`}
                  className="text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  查看前台
                </Link>
              </div>
            </div>
          ))}
          {courses.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              还没有课程。先去{" "}
              <Link href={composeHref} className="text-[var(--brand)]">
                {composeLabel}
              </Link>{" "}
              生成一门吧。
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

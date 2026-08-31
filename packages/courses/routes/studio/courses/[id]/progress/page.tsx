import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CoursesSubnav } from "@andyyyds/courses/components/courses-subnav";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { videoWatchPercent } from "@andyyyds/courses/lib/lesson-resource-access";
import {
  isMeetupProductType,
  meetupActivityEditPath,
  productTypeLabel,
} from "@andyyyds/shared/product-types";
import {
  canCreateSellableProducts,
  canViewAllStudioData,
  canViewLearnerProgress,
} from "@andyyyds/shared/roles";
import { formatStudyDuration } from "@andyyyds/shared/utils";

export const dynamic = "force-dynamic";

function maskPhone(phone: string) {
  const p = phone.trim();
  if (p.length < 7) return p || "—";
  return `${p.slice(0, 3)}****${p.slice(-4)}`;
}

/**
 * 单课 / 专栏学员学习进度：站长看全站，老师/商家/代理看名下课程。
 * 资料包不走此页（业务是下载非看课时长）。
 */
export default async function CourseLearnerProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canViewLearnerProgress(session.role)) {
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
          lessons: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              type: true,
              durationSec: true,
              sortOrder: true,
              resources: {
                orderBy: { sortOrder: "asc" },
                select: {
                  id: true,
                  title: true,
                  fileName: true,
                },
              },
            },
          },
        },
      },
      enrollments: {
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
          progress: true,
        },
      },
    },
  });
  if (!course) notFound();

  // 约搭是报名活动，无学习进度；误开时回到活动编辑
  if (isMeetupProductType(course.productType)) {
    redirect(meetupActivityEditPath(course.slug, { fromCourseEdit: true }));
  }
  if (course.productType === "MATERIAL") {
    redirect(`/studio/courses/${course.id}/edit`);
  }

  const lessons = course.chapters.flatMap((c) =>
    c.lessons.map((l) => ({
      ...l,
      chapterTitle: c.title,
    })),
  );
  const totalLessons = lessons.length;
  const videoLessons = lessons.filter((l) => l.type === "VIDEO");
  const resourceIds = lessons.flatMap((l) => l.resources.map((r) => r.id));
  const canCreate = canCreateSellableProducts(session.role);

  const enrollmentIds = course.enrollments.map((e) => e.id);
  const downloadLogs =
    resourceIds.length > 0 && enrollmentIds.length > 0
      ? await prisma.lessonResourceDownload.findMany({
          where: {
            resourceId: { in: resourceIds },
            enrollmentId: { in: enrollmentIds },
          },
          orderBy: { createdAt: "desc" },
          select: {
            resourceId: true,
            enrollmentId: true,
            createdAt: true,
          },
        })
      : [];

  /** enrollmentId → resourceId → 最近一次下载时间 */
  const downloadByEnrollment = new Map<string, Map<string, Date>>();
  for (const log of downloadLogs) {
    let byRes = downloadByEnrollment.get(log.enrollmentId);
    if (!byRes) {
      byRes = new Map();
      downloadByEnrollment.set(log.enrollmentId, byRes);
    }
    // 已按 createdAt desc，只保留首次（最近）
    if (!byRes.has(log.resourceId)) {
      byRes.set(log.resourceId, log.createdAt);
    }
  }

  const rows = course.enrollments.map((en) => {
    const byLesson = new Map(en.progress.map((p) => [p.lessonId, p]));
    const completedCount = en.progress.filter((p) => p.completed).length;
    const watchedSec = en.progress.reduce(
      (sum, p) => sum + (p.watchedSec || 0),
      0,
    );
    const lastAt = en.progress.reduce<Date | null>((latest, p) => {
      if (!latest || p.updatedAt > latest) return p.updatedAt;
      return latest;
    }, null);
    const percent =
      totalLessons > 0
        ? Math.min(100, Math.round((completedCount / totalLessons) * 100))
        : 0;
    const downloads = downloadByEnrollment.get(en.id) || new Map();

    return {
      enrollmentId: en.id,
      enrolledAt: en.createdAt,
      user: en.user,
      completedCount,
      watchedSec,
      lastAt,
      percent,
      lessons: lessons.map((lesson) => {
        const p = byLesson.get(lesson.id);
        const completed = Boolean(p?.completed);
        const positionSec = p?.positionSec || 0;
        const watchPct =
          lesson.type === "VIDEO"
            ? videoWatchPercent({
                positionSec,
                durationSec: lesson.durationSec,
                completed,
              })
            : null;
        const resourceRows = lesson.resources.map((r) => {
          const at = downloads.get(r.id) || null;
          return {
            id: r.id,
            title: r.title,
            fileName: r.fileName,
            downloaded: Boolean(at),
            downloadedAt: at,
          };
        });
        return {
          id: lesson.id,
          title: lesson.title,
          chapterTitle: lesson.chapterTitle,
          type: lesson.type,
          durationSec: lesson.durationSec,
          completed,
          positionSec,
          watchedSec: p?.watchedSec || 0,
          watchPct,
          updatedAt: p?.updatedAt || null,
          resources: resourceRows,
        };
      }),
    };
  });

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="courses" />
      <CoursesSubnav current="list" canCreate={canCreate} />

      <div>
        <p className="text-sm text-[var(--muted)]">
          <Link href="/studio/courses" className="text-[var(--brand)]">
            ← 课程与资料
          </Link>
        </p>
        <h1 className="mt-2 text-3xl font-semibold">学习进度</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          <span className="mr-2 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs text-[var(--brand)]">
            {productTypeLabel(course.productType)}
          </span>
          {course.title}
          {" · "}
          {course.enrollments.length} 名学员
          {" · "}
          {totalLessons} 个课时
          {videoLessons.length > 0
            ? `（含 ${videoLessons.length} 个视频）`
            : ""}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          视频观看进度按「播放位置 / 时长」估算；课件下载以审计日志为准。学习时长按正放累计，拖拽不计入。
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="surface rounded-[28px] p-8 text-center text-sm text-[var(--muted)]">
          还没有学员报名。学员购买或免费领取后会出现在这里。
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <details
              key={row.enrollmentId}
              className="surface group rounded-[28px] p-5 open:pb-4"
            >
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--ink)]">
                      {row.user.name}
                    </div>
                    <div className="mt-1 break-all text-xs text-[var(--muted)]">
                      {maskPhone(row.user.phone)}
                      {row.user.email ? ` · ${row.user.email}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span>
                      进度{" "}
                      <strong className="text-[var(--brand)]">
                        {row.completedCount}/{totalLessons}
                      </strong>
                      （{row.percent}%）
                    </span>
                    <span>
                      学习时长{" "}
                      <strong>{formatStudyDuration(row.watchedSec)}</strong>
                    </span>
                    <span className="text-[var(--muted)]">
                      {row.lastAt
                        ? `最近学习 ${row.lastAt.toLocaleString("zh-CN")}`
                        : "尚未开始学习"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--line)]">
                  <div
                    className="h-full rounded-full bg-[var(--brand)]"
                    style={{ width: `${row.percent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--muted)] group-open:hidden">
                  点击展开各课时明细
                </p>
              </summary>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-[var(--muted)]">
                    <tr>
                      <th className="py-2 pr-3 font-medium">课时</th>
                      <th className="py-2 pr-3 font-medium">观看</th>
                      <th className="py-2 pr-3 font-medium">状态</th>
                      <th className="py-2 pr-3 font-medium">课件</th>
                      <th className="py-2 font-medium">本课时长</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.lessons.map((lesson) => (
                      <tr
                        key={lesson.id}
                        className="border-t border-[var(--line)] align-top"
                      >
                        <td className="py-2.5 pr-3">
                          <div className="font-medium">{lesson.title}</div>
                          <div className="text-xs text-[var(--muted)]">
                            {lesson.chapterTitle}
                            {lesson.type === "VIDEO" ? " · 视频" : ""}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          {lesson.watchPct !== null ? (
                            <span>
                              <strong className="text-[var(--brand)]">
                                {lesson.watchPct}%
                              </strong>
                              <span className="text-[var(--muted)]">
                                {" "}
                                / 100%
                              </span>
                              {lesson.positionSec > 0 ? (
                                <div className="text-xs text-[var(--muted)]">
                                  学到{" "}
                                  {formatStudyDuration(lesson.positionSec)}
                                </div>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          {lesson.completed ? (
                            <span className="text-[var(--brand)]">已完成</span>
                          ) : lesson.watchedSec > 0 ||
                            lesson.positionSec > 0 ? (
                            <span>学习中</span>
                          ) : (
                            <span className="text-[var(--muted)]">未开始</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          {lesson.resources.length === 0 ? (
                            <span className="text-[var(--muted)]">无课件</span>
                          ) : (
                            <ul className="space-y-1 text-xs">
                              {lesson.resources.map((r) => (
                                <li key={r.id}>
                                  {r.downloaded ? (
                                    <span className="text-[var(--brand)]">
                                      已下载
                                      {r.downloadedAt
                                        ? ` · ${r.downloadedAt.toLocaleString("zh-CN")}`
                                        : ""}
                                    </span>
                                  ) : (
                                    <span className="text-[var(--muted)]">
                                      未下载 · {r.title}
                                    </span>
                                  )}
                                  {r.downloaded ? (
                                    <span className="block text-[var(--muted)]">
                                      {r.title}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="py-2.5">
                          {formatStudyDuration(lesson.watchedSec)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}

      <p className="text-center text-sm text-[var(--muted)]">
        <Link
          href={`/studio/courses/${course.id}/edit`}
          className="text-[var(--brand)]"
        >
          去编辑课程
        </Link>
        {" · "}
        <Link
          href={`/studio/courses/${course.id}/content`}
          className="text-[var(--brand)]"
        >
          编辑章节 / 课件
        </Link>
      </p>
    </div>
  );
}

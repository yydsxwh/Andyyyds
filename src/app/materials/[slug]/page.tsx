import { redirect, notFound } from "next/navigation";
import { StartConsultChatButton } from "@/components/chat/start-consult-chat-button";
import { CourseShareBar } from "@/components/course-share-bar";
import { PurchasePanel } from "@/components/purchase-panel";
import { CHAT_SOURCE } from "@/lib/chat/constants";
import { getSession } from "@/lib/auth";
import { canPreviewAllLessons } from "@/lib/course-access";
import { prisma } from "@/lib/db";
import { lessonTypeLabel } from "@/lib/lesson-kinds";
import { formatBytes } from "@/lib/media";
import { shouldHideProductPrice } from "@/lib/product-price-display";
import {
  getHideAllPricesFlag,
  getOrderFormConfig,
} from "@/lib/site-settings";
import { resolveStoredAccessUrl } from "@/lib/storage";
import { decodeRouteSlug, formatDuration, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** 资料详情：付费后预览/下载文件，目录不展示视频时长误导 */
export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteSlug(rawSlug);
  const [session, hideAllPrices] = await Promise.all([
    getSession(),
    getHideAllPricesFlag(),
  ]);
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      teacher: true,
      category: true,
      chapters: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            orderBy: { sortOrder: "asc" },
            include: {
              mediaAsset: {
                select: { type: true, sizeBytes: true, name: true },
              },
            },
          },
        },
      },
    },
  });

  if (!course || course.status !== "PUBLISHED") notFound();

  // 误开课程/专栏链接到资料路径时，跳回对应广场详情
  if (course.productType !== "MATERIAL") {
    redirect(`/courses/${encodeURIComponent(slug)}`);
  }

  const hidePriceDisplay = shouldHideProductPrice({
    hideAllPrices,
    hidePrice: course.hidePrice,
  });

  const enrolled = session
    ? Boolean(
        await prisma.enrollment.findUnique({
          where: {
            userId_courseId: { userId: session.id, courseId: course.id },
          },
        }),
      )
    : false;
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
              资料 · {course.category?.name ?? "综合"} · {course.teacher.name}
            </div>
            <h1 className="text-3xl font-semibold">{course.title}</h1>
            <p className="text-[var(--muted)]">{course.subtitle}</p>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
              <span>{course.studentCount} 人已购</span>
              <span>★ {course.rating.toFixed(1)}</span>
              <span>{lessonCount} 个文件</span>
              {hidePriceDisplay ? null : (
                <span>{course.isFree ? "免费" : formatPrice(course.price)}</span>
              )}
            </div>
            <p className="leading-7 text-[var(--ink)]">{course.description}</p>
          </div>
        </div>

        <div className="surface rounded-[32px] p-6 sm:p-8">
          <h2 className="text-xl font-semibold">资料目录</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            购买后可在线预览或下载文件；标「试看」的可先免费预览。
          </p>
          <div className="mt-6 space-y-5">
            {course.chapters.map((chapter) => (
              <div key={chapter.id}>
                <h3 className="font-medium">{chapter.title}</h3>
                <ul className="mt-3 space-y-2">
                  {chapter.lessons.map((lesson) => {
                    const kind = lesson.mediaAsset?.type || lesson.type;
                    const size = lesson.mediaAsset?.sizeBytes || 0;
                    const showDuration =
                      kind === "VIDEO" && lesson.durationSec > 0;
                    const meta = [
                      lessonTypeLabel(kind),
                      size > 0 ? formatBytes(size) : null,
                      showDuration ? formatDuration(lesson.durationSec) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <li
                        key={lesson.id}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-white/60 px-4 py-3 text-sm"
                      >
                        <span>
                          {lesson.title}
                          {lesson.isPreview ? (
                            <span className="ml-2 text-[var(--brand)]">
                              试看
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-[var(--muted)]">
                          {meta || "文件"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <PurchasePanel
          courseId={course.id}
          price={course.price}
          isFree={course.isFree}
          enrolled={enrolled}
          slug={course.slug}
          orderForm={orderForm}
          productLabel="资料"
          canStaffPreview={canStaffPreview}
          hidePriceDisplay={hidePriceDisplay}
        />
        {session?.id !== course.teacherId ? (
          <StartConsultChatButton
            peerUserId={course.teacherId}
            source={CHAT_SOURCE.PRODUCT_CONSULT}
            relatedCourseId={course.id}
          >
            私聊咨询老师
          </StartConsultChatButton>
        ) : null}
        <CourseShareBar
          slug={course.slug}
          title={course.title}
          inviteCode={inviteCode}
          productType="MATERIAL"
        />
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MeetupEditorForm } from "@/components/meetup-editor-form";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fromMeetupPeopleDb } from "@/lib/meetup";
import { parseJsonStringArray } from "@/lib/meetup-meta";
import { parseMeetupServicePhones } from "@/lib/meetup-service-contact";
import { canManageMeetups } from "@/lib/roles";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "编辑约搭",
};

/**
 * 前台编辑：任意登录用户若是发起人可改自己的局；站长也可进。
 * 与站长后台 /studio/meetup 分离：此处不要求 ADMIN，避免把创建/编辑收紧成仅站长。
 */
export default async function MeetupEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    const { id } = await params;
    redirect(`/login?next=${encodeURIComponent(`/meetup/${id}/edit`)}`);
  }

  const { id } = await params;
  const query = await searchParams;
  // 从课程编辑误入时提示：约搭走活动字段，不是章节课时
  const fromCourseEdit = query.from === "course-edit";
  const meetup = await prisma.meetup.findUnique({
    where: { id },
    include: {
      slots: {
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { joins: true } } },
      },
      productCourse: { select: { hidePrice: true } },
    },
  });
  if (!meetup) notFound();

  const isHost = meetup.hostId === session.id;
  const isAdmin = canManageMeetups(session.role);
  if (!isHost && !isAdmin) {
    redirect(`/meetup/${id}`);
  }

  return (
    <div className="container py-10 sm:py-12">
      <div className="mb-6">
        <Link href={`/meetup/${meetup.id}`} className="text-sm text-[var(--brand)]">
          ← 返回活动详情
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">编辑约搭</h1>
        {fromCourseEdit ? (
          <p className="mt-2 rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/5 px-4 py-3 text-sm text-[var(--brand-strong)]">
            约搭是活动不是课程。已为你打开活动编辑（时间、地点、分档报名等），请勿使用课程/章节表单。
          </p>
        ) : null}
        <p className="mt-2 text-sm text-[var(--muted)]">
          {isHost
            ? "可改价格、分档、详情与状态；取消请用状态「已取消」。"
            : "站长编辑他人发起的活动。"}
        </p>
      </div>
      <MeetupEditorForm
        mode="edit"
        apiPath={`/api/meetup/${meetup.id}`}
        showStatus
        successHref="/meetup/{id}"
        submitLabel="保存修改"
        initial={{
          id: meetup.id,
          title: meetup.title,
          description: meetup.description,
          contentHtml: meetup.contentHtml || "",
          priceCents: meetup.priceCents,
          hidePrice: Boolean(meetup.productCourse?.hidePrice),
          category: meetup.category,
          startsAt: meetup.startsAt.toISOString(),
          endsAt: meetup.endsAt?.toISOString() ?? null,
          timezone: meetup.timezone || "Asia/Shanghai",
          place: meetup.place,
          latitude: meetup.latitude,
          longitude: meetup.longitude,
          coverUrl: meetup.coverUrl || "",
          tags: parseJsonStringArray(meetup.tagsJson),
          feeIncludes: meetup.feeIncludes || "",
          refundPolicy: meetup.refundPolicy || "",
          autoRefund: Boolean(meetup.autoRefund),
          gallery: parseJsonStringArray(meetup.galleryJson),
          contactUrl: meetup.contactUrl || "",
          meetingPoint: meetup.meetingPoint || "",
          destination: meetup.destination || "",
          highlights: meetup.highlights || "",
          adminPhone: meetup.adminPhone || "",
          servicePhones: parseMeetupServicePhones(meetup.servicePhonesJson),
          wechatService: meetup.wechatService || "",
          itineraryHtml: meetup.itineraryHtml || "",
          feeNoteHtml: meetup.feeNoteHtml || "",
          notesHtml: meetup.notesHtml || "",
          status: meetup.status,
          slots: meetup.slots.map((s) => ({
            id: s.id,
            name: s.name,
            maxPeople: fromMeetupPeopleDb(s.maxPeople),
            joinCount: s._count.joins,
          })),
        }}
      />
    </div>
  );
}

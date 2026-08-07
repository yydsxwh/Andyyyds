import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MeetupEditorForm } from "@/components/meetup-editor-form";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseJsonStringArray } from "@/lib/meetup-meta";
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
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) {
    const { id } = await params;
    redirect(`/login?next=${encodeURIComponent(`/meetup/${id}/edit`)}`);
  }

  const { id } = await params;
  const meetup = await prisma.meetup.findUnique({
    where: { id },
    include: {
      slots: {
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { joins: true } } },
      },
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
        successHref={(meetupId) => `/meetup/${meetupId}`}
        submitLabel="保存修改"
        initial={{
          id: meetup.id,
          title: meetup.title,
          description: meetup.description,
          contentHtml: meetup.contentHtml || "",
          priceCents: meetup.priceCents,
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
          status: meetup.status,
          slots: meetup.slots.map((s) => ({
            id: s.id,
            name: s.name,
            maxPeople: s.maxPeople,
            joinCount: s._count.joins,
          })),
        }}
      />
    </div>
  );
}

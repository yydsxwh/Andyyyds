import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MeetupEditorForm } from "@/components/meetup-editor-form";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fromMeetupPeopleDb } from "@/lib/meetup";
import { parseJsonStringArray } from "@/lib/meetup-meta";
import { parseMeetupServicePhones } from "@/lib/meetup-service-contact";
import { canManageMeetups } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function StudioMeetupEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageMeetups(session.role)) redirect("/studio");

  const { id } = await params;
  const meetup = await prisma.meetup.findUnique({
    where: { id },
    include: {
      slots: {
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { joins: true } } },
      },
      host: { select: { name: true } },
      productCourse: { select: { hidePrice: true } },
    },
  });
  if (!meetup) notFound();

  return (
    <div className="container space-y-6 py-10 sm:py-12">
      <StudioNav current="meetup" area="admin" />
      <div>
        <Link href="/studio/meetup" className="text-sm text-[var(--brand)]">
          ← 返回约搭管理
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">编辑约搭</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          发起人 {meetup.host.name} ·{" "}
          <Link
            href={`/meetup/${meetup.id}`}
            className="text-[var(--brand)] underline-offset-2 hover:underline"
          >
            查看前台详情
          </Link>
        </p>
      </div>
      <MeetupEditorForm
        mode="edit"
        apiPath={`/api/studio/meetups/${meetup.id}`}
        showStatus
        successHref="/studio/meetup"
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

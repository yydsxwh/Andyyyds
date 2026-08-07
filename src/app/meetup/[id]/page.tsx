import { notFound } from "next/navigation";
import {
  MeetupDetailView,
  type MeetupDetailData,
} from "@/components/meetup-detail-view";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseJsonStringArray } from "@/lib/meetup-meta";
import { ensureMeetupProductCourse } from "@/lib/meetup-product";
import { canManageMeetups } from "@/lib/roles";
import { getOrderFormConfig } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: { title: true },
  });
  return {
    title: meetup?.title ? `${meetup.title} · 约搭` : "约搭详情",
  };
}

export default async function MeetupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  let meetup = await prisma.meetup.findUnique({
    where: { id },
    include: {
      host: { select: { id: true, name: true, avatarUrl: true } },
      slots: { orderBy: { sortOrder: "asc" } },
      joins: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!meetup) notFound();

  if (!meetup.productCourseId) {
    await ensureMeetupProductCourse(prisma, meetup);
    meetup = (await prisma.meetup.findUnique({
      where: { id },
      include: {
        host: { select: { id: true, name: true, avatarUrl: true } },
        slots: { orderBy: { sortOrder: "asc" } },
        joins: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }))!;
  }

  const inviteCode = session
    ? (
        await prisma.user.findUnique({
          where: { id: session.id },
          select: { referralCode: true },
        })
      )?.referralCode || ""
    : "";

  const orderForm = await getOrderFormConfig();

  const data: MeetupDetailData = {
    id: meetup.id,
    title: meetup.title,
    description: meetup.description,
    contentHtml: meetup.contentHtml || "",
    priceCents: meetup.priceCents,
    category: meetup.category,
    startsAt: meetup.startsAt.toISOString(),
    endsAt: meetup.endsAt ? meetup.endsAt.toISOString() : null,
    place: meetup.place,
    maxPeople: meetup.maxPeople,
    coverUrl: meetup.coverUrl || "",
    tags: parseJsonStringArray(meetup.tagsJson),
    feeIncludes: meetup.feeIncludes || "",
    refundPolicy: meetup.refundPolicy || "",
    autoRefund: Boolean(meetup.autoRefund),
    gallery: parseJsonStringArray(meetup.galleryJson),
    contactUrl: meetup.contactUrl || "",
    status: meetup.status,
    hostId: meetup.hostId,
    productCourseId: meetup.productCourseId || null,
    slots: meetup.slots.map((s) => ({
      id: s.id,
      name: s.name,
      maxPeople: s.maxPeople,
      joinCount: meetup.joins.filter((j) => j.slotId === s.id).length,
    })),
    host: {
      id: meetup.host.id,
      name: meetup.host.name,
      avatarUrl: meetup.host.avatarUrl || "",
    },
    joins: meetup.joins.map((j) => ({
      id: j.id,
      userId: j.userId,
      slotId: j.slotId || null,
      user: {
        id: j.user.id,
        name: j.user.name,
        avatarUrl: j.user.avatarUrl || "",
      },
    })),
  };

  return (
    <MeetupDetailView
      meetup={data}
      currentUserId={session?.id ?? null}
      inviteCode={inviteCode}
      orderForm={orderForm}
      canManageAsAdmin={
        session ? canManageMeetups(session.role) : false
      }
    />
  );
}

import { notFound } from "next/navigation";
import {
  MeetupDetailView,
  type MeetupDetailData,
} from "@/components/meetup-detail-view";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fromMeetupPeopleDb } from "@/lib/meetup";
import { parseJsonStringArray } from "@/lib/meetup-meta";
import { ensureMeetupProductCourse } from "@/lib/meetup-product";
import {
  parseMeetupServicePhones,
  sumMeetupPartySize,
} from "@/lib/meetup-service-contact";
import { canManageMeetups } from "@/lib/roles";
import { resolveContentFields } from "@/lib/i18n/content-resolve";
import { getRequestLocaleContext } from "@/lib/i18n/get-request-locale";
import {
  getHideAllPricesFlag,
  getOrderFormConfig,
  getPortalConfig,
} from "@/lib/site-settings";

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

  const [orderForm, portal, hideAllPrices, productCourse] = await Promise.all([
    getOrderFormConfig(),
    getPortalConfig(),
    getHideAllPricesFlag(),
    meetup.productCourseId
      ? prisma.course.findUnique({
          where: { id: meetup.productCourseId },
          select: { hidePrice: true },
        })
      : Promise.resolve(null),
  ]);
  const siteContact = portal.contact;
  const localeCtx = await getRequestLocaleContext();
  const loc = await resolveContentFields({
    entityType: "meetup",
    entityId: meetup.id,
    fields: {
      title: meetup.title,
      description: meetup.description || "",
      contentHtml: meetup.contentHtml || "",
      place: meetup.place || "",
      meetingPoint: meetup.meetingPoint || "",
      destination: meetup.destination || "",
      highlights: meetup.highlights || "",
      feeIncludes: meetup.feeIncludes || "",
      refundPolicy: meetup.refundPolicy || "",
    },
    locale: localeCtx.contentLocale,
  });
  // 站长：主显中文；访客：主显当前 locale 译文（无缓存则原文）
  const withBi = (field: keyof typeof loc) => {
    const row = loc[field];
    if (!localeCtx.bilingual) return row.text;
    return row.source || row.text;
  };
  const secondary = (field: keyof typeof loc) => {
    if (!localeCtx.bilingual) return undefined;
    const row = loc[field];
    if (row.text && row.text !== row.source) return row.text;
    return undefined;
  };

  const data: MeetupDetailData = {
    id: meetup.id,
    title: withBi("title"),
    titleSecondary: secondary("title"),
    description: withBi("description"),
    contentHtml: withBi("contentHtml") || "",
    priceCents: meetup.priceCents,
    hidePrice: Boolean(productCourse?.hidePrice),
    category: meetup.category,
    startsAt: meetup.startsAt.toISOString(),
    endsAt: meetup.endsAt ? meetup.endsAt.toISOString() : null,
    timezone: meetup.timezone || "Asia/Shanghai",
    place: withBi("place"),
    placeSecondary: secondary("place"),
    maxPeople: fromMeetupPeopleDb(meetup.maxPeople),
    coverUrl: meetup.coverUrl || "",
    tags: parseJsonStringArray(meetup.tagsJson),
    feeIncludes: withBi("feeIncludes") || "",
    refundPolicy: withBi("refundPolicy") || "",
    autoRefund: Boolean(meetup.autoRefund),
    gallery: parseJsonStringArray(meetup.galleryJson),
    contactUrl: meetup.contactUrl || "",
    meetingPoint: withBi("meetingPoint") || "",
    destination: withBi("destination") || "",
    highlights: withBi("highlights") || "",
    adminPhone: meetup.adminPhone || "",
    servicePhones: parseMeetupServicePhones(meetup.servicePhonesJson),
    wechatService: meetup.wechatService || "",
    itineraryHtml: meetup.itineraryHtml || "",
    feeNoteHtml: meetup.feeNoteHtml || "",
    notesHtml: meetup.notesHtml || "",
    status: meetup.status,
    hostId: meetup.hostId,
    productCourseId: meetup.productCourseId || null,
    slots: meetup.slots.map((s) => ({
      id: s.id,
      name: s.name,
      maxPeople: fromMeetupPeopleDb(s.maxPeople),
      joinCount: sumMeetupPartySize(
        meetup.joins.filter((j) => j.slotId === s.id),
      ),
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
      partySize: Math.max(1, Math.floor(Number(j.partySize) || 1)),
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
      siteContact={{
        phone: siteContact?.phone || "",
        wechat: siteContact?.wechat || "",
        title: siteContact?.title || "网站联系方式",
      }}
      canManageAsAdmin={
        session ? canManageMeetups(session.role) : false
      }
      hideAllPrices={hideAllPrices}
    />
  );
}

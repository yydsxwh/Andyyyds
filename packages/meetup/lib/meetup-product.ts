/**
 * 约搭 ↔ 可售 Course 壳
 *
 * 为何挂一层 Course：站内订单、微信/支付宝支付、优惠券、分销结算都按 Course 走；
 * 约搭本身保留活动字段（时间/地点/人数/分档），售卖侧用 productType=MEETUP 的壳商品对齐。
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_COURSE_COVER_URL } from "@andyyyds/shared/cover-images";
import {
  fromMeetupPeopleDb,
  MEETUP_PRODUCT_TYPE,
  statusAfterJoinCountChange,
} from "@andyyyds/meetup/lib/meetup";
import { parseMeetupSlotIdFromSpec } from "@andyyyds/meetup/lib/meetup-meta";
import { sumMeetupPartySize } from "@andyyyds/meetup/lib/meetup-service-contact";

type Db = PrismaClient | Prisma.TransactionClient;

/** 创建或同步约搭对应的可售壳；slug 固定为 meetup.id，支付回跳用 */
export async function ensureMeetupProductCourse(
  db: Db,
  meetup: {
    id: string;
    title: string;
    description: string;
    contentHtml?: string;
    coverUrl: string;
    priceCents: number;
    hidePrice?: boolean;
    hostId: string;
    productCourseId?: string | null;
    status: string;
  },
): Promise<string> {
  const price = Math.max(0, Math.floor(meetup.priceCents || 0));
  const isFree = price <= 0;
  const hidePrice =
    meetup.hidePrice === undefined ? undefined : Boolean(meetup.hidePrice);
  // 取消的活动壳下架，避免优惠券/搜索误购；其它状态保持可售以便已报名履约
  const courseStatus = meetup.status === "CANCELLED" ? "DRAFT" : "PUBLISHED";
  const description =
    (meetup.contentHtml || "").trim() ||
    meetup.description ||
    "约搭活动报名";
  const coverUrl = meetup.coverUrl?.trim() || DEFAULT_COURSE_COVER_URL;
  const slug = meetup.id;

  if (meetup.productCourseId) {
    await db.course.update({
      where: { id: meetup.productCourseId },
      data: {
        title: meetup.title,
        subtitle: "约搭活动",
        description,
        coverUrl,
        price,
        originalPrice: price,
        isFree,
        ...(hidePrice === undefined ? {} : { hidePrice }),
        status: courseStatus,
        productType: MEETUP_PRODUCT_TYPE,
        teacherId: meetup.hostId,
        slug,
      },
    });
    return meetup.productCourseId;
  }

  const existing = await db.course.findUnique({ where: { slug } });
  if (existing) {
    await db.course.update({
      where: { id: existing.id },
      data: {
        title: meetup.title,
        subtitle: "约搭活动",
        description,
        coverUrl,
        price,
        originalPrice: price,
        isFree,
        ...(hidePrice === undefined ? {} : { hidePrice }),
        status: courseStatus,
        productType: MEETUP_PRODUCT_TYPE,
        teacherId: meetup.hostId,
      },
    });
    await db.meetup.update({
      where: { id: meetup.id },
      data: { productCourseId: existing.id },
    });
    return existing.id;
  }

  const created = await db.course.create({
    data: {
      title: meetup.title,
      slug,
      subtitle: "约搭活动",
      description,
      coverUrl,
      price,
      originalPrice: price,
      isFree,
      hidePrice: Boolean(hidePrice),
      status: courseStatus,
      productType: MEETUP_PRODUCT_TYPE,
      teacherId: meetup.hostId,
    },
  });
  await db.meetup.update({
    where: { id: meetup.id },
    data: { productCourseId: created.id },
  });
  return created.id;
}

/**
 * 支付/0 元券履约后写入报名；从最近订单 specLabel 恢复所选分档。
 * 与免费 join API 共用规则，保证付费与免费最终都进 MeetupJoin。
 */
export async function joinMeetupAfterPurchase(
  db: Db,
  input: { userId: string; productCourseId: string },
): Promise<void> {
  const meetup = await db.meetup.findFirst({
    where: { productCourseId: input.productCourseId },
    include: {
      joins: { select: { partySize: true } },
      slots: { orderBy: { sortOrder: "asc" }, select: { id: true } },
    },
  });
  if (!meetup) return;
  if (meetup.status === "CANCELLED") return;

  const existing = await db.meetupJoin.findUnique({
    where: {
      meetupId_userId: { meetupId: meetup.id, userId: input.userId },
    },
  });
  if (existing) return;

  // 最近一笔该壳商品订单：specLabel 带分档；quantity 写入占用名额
  const latestOrder = await db.order.findFirst({
    where: {
      userId: input.userId,
      courseId: input.productCourseId,
      status: "PAID",
    },
    orderBy: { paidAt: "desc" },
    select: { specLabel: true, quantity: true },
  });
  let slotId = parseMeetupSlotIdFromSpec(latestOrder?.specLabel);
  if (slotId) {
    const slotOk = meetup.slots.some((s) => s.id === slotId);
    if (!slotOk) slotId = null;
  }
  if (!slotId && meetup.slots[0]) {
    slotId = meetup.slots[0].id;
  }
  const partySize = Math.max(
    1,
    Math.min(10, Math.floor(Number(latestOrder?.quantity) || 1)),
  );

  await db.meetupJoin.create({
    data: {
      meetupId: meetup.id,
      userId: input.userId,
      slotId: slotId || null,
      partySize,
    },
  });

  const joinCount = sumMeetupPartySize(meetup.joins) + partySize;
  const nextStatus = statusAfterJoinCountChange({
    currentStatus: meetup.status,
    joinCount,
    maxPeople: fromMeetupPeopleDb(meetup.maxPeople),
  });
  if (nextStatus !== meetup.status) {
    await db.meetup.update({
      where: { id: meetup.id },
      data: { status: nextStatus },
    });
  }

  // 付费报名履约后进约搭群（best-effort，不阻断报名）
  try {
    const { ensureMeetupGroupAndJoin } = await import("@andyyyds/shared/chat/group-service");
    await ensureMeetupGroupAndJoin({
      meetupId: meetup.id,
      hostId: meetup.hostId,
      meetupTitle: meetup.title,
      userId: input.userId,
    });
  } catch (err) {
    console.error("[meetup:chat-group]", err);
  }
}

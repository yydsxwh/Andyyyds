/**
 * 站长约搭管理
 * GET  —— 全站活动列表
 * POST —— 创建活动（发起人为当前站长）
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fromMeetupPeopleDb, toMeetupPeopleDb } from "@/lib/meetup";
import {
  meetupDetailDbFields,
  meetupWriteSchema,
  parseMeetupWriteBody,
} from "@/lib/meetup-payload";
import { ensureMeetupProductCourse } from "@/lib/meetup-product";
import { canManageMeetups } from "@/lib/roles";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (!canManageMeetups(session.role)) {
    return NextResponse.json({ error: "仅站长可管理约搭" }, { status: 403 });
  }

  const rows = await prisma.meetup.findMany({
    include: {
      host: { select: { id: true, name: true } },
      _count: { select: { joins: true, slots: true } },
    },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  const courseIds = rows
    .map((m) => m.productCourseId)
    .filter((id): id is string => Boolean(id));
  const paidByCourse = new Map<string, number>();
  if (courseIds.length > 0) {
    const paidGroups = await prisma.order.groupBy({
      by: ["courseId"],
      where: { courseId: { in: courseIds }, status: "PAID" },
      _count: { _all: true },
    });
    for (const g of paidGroups) {
      paidByCourse.set(g.courseId, g._count._all);
    }
  }

  return NextResponse.json({
    meetups: rows.map((m) => ({
      id: m.id,
      title: m.title,
      category: m.category,
      status: m.status,
      priceCents: m.priceCents,
      place: m.place,
      startsAt: m.startsAt.toISOString(),
      endsAt: m.endsAt?.toISOString() ?? null,
      maxPeople: fromMeetupPeopleDb(m.maxPeople),
      joinCount: m._count.joins,
      slotCount: m._count.slots,
      coverUrl: m.coverUrl || "",
      hostId: m.hostId,
      hostName: m.host.name,
      productCourseId: m.productCourseId,
      paidOrderCount: m.productCourseId
        ? paidByCourse.get(m.productCourseId) || 0
        : 0,
      updatedAt: m.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (!canManageMeetups(session.role)) {
    return NextResponse.json({ error: "仅站长可管理约搭" }, { status: 403 });
  }

  try {
    const body = meetupWriteSchema.parse(await req.json());
    // 站长补录历史活动时允许过去的开始时间
    const parsed = parseMeetupWriteBody(body, { allowPastStart: true });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const data = parsed.data;

    const meetup = await prisma.$transaction(async (tx) => {
      const created = await tx.meetup.create({
        data: {
          title: data.title,
          description: data.description,
          contentHtml: data.contentHtml,
          priceCents: data.priceCents,
          category: data.category,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          timezone: data.timezone,
          place: data.place,
          latitude: data.latitude,
          longitude: data.longitude,
          maxPeople: toMeetupPeopleDb(data.maxPeople),
          coverUrl: data.coverUrl,
          tagsJson: data.tagsJson,
          feeIncludes: data.feeIncludes,
          refundPolicy: data.refundPolicy,
          autoRefund: data.autoRefund,
          galleryJson: data.galleryJson,
          contactUrl: data.contactUrl,
          ...meetupDetailDbFields(data),
          status: "OPEN",
          hostId: session.id,
          slots: {
            create: data.slots.map((s, i) => ({
              name: s.name,
              maxPeople: toMeetupPeopleDb(s.maxPeople),
              sortOrder: i,
            })),
          },
        },
        include: { slots: { orderBy: { sortOrder: "asc" } } },
      });

      await tx.meetupJoin.create({
        data: {
          meetupId: created.id,
          userId: session.id,
          slotId: created.slots[0]?.id || null,
          partySize: 1,
        },
      });

      await ensureMeetupProductCourse(tx, {
        id: created.id,
        title: created.title,
        description: created.description,
        contentHtml: created.contentHtml,
        coverUrl: created.coverUrl,
        priceCents: created.priceCents,
        hidePrice: data.hidePrice,
        hostId: created.hostId,
        status: created.status,
      });

      return created;
    });

    return NextResponse.json({ id: meetup.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "请完整填写约搭信息" }, { status: 400 });
    }
    console.error("[studio:meetup:create]", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

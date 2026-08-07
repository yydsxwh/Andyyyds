/**
 * GET   /api/meetup/[id] —— 详情
 * PATCH /api/meetup/[id] —— 发起人改自己的局（状态或字段）；站长可改任意局
 *
 * 注意：创建走 POST /api/meetup，任意登录用户均可，勿与站长后台 canManageMeetups 混淆。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  fromMeetupPeopleDb,
  isMeetupStatus,
  statusAfterJoinCountChange,
  toMeetupPeopleDb,
} from "@/lib/meetup";
import { parseJsonStringArray } from "@/lib/meetup-meta";
import {
  meetupDetailDbFields,
  meetupWriteSchema,
  parseMeetupWriteBody,
} from "@/lib/meetup-payload";
import { ensureMeetupProductCourse } from "@/lib/meetup-product";
import {
  parseMeetupServicePhones,
  sumMeetupPartySize,
} from "@/lib/meetup-service-contact";
import { canManageMeetups } from "@/lib/roles";

const statusOnlySchema = z.object({
  status: z.string().trim(),
});

async function loadMeetup(id: string) {
  return prisma.meetup.findUnique({
    where: { id },
    include: {
      host: { select: { id: true, name: true, avatarUrl: true } },
      slots: {
        orderBy: { sortOrder: "asc" as const },
        include: { _count: { select: { joins: true } } },
      },
      joins: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" as const },
      },
      _count: { select: { joins: true } },
    },
  });
}

function serialize(row: NonNullable<Awaited<ReturnType<typeof loadMeetup>>>) {
  const joinCount = sumMeetupPartySize(row.joins);
  const priceCents = Math.max(0, Math.floor(row.priceCents || 0));
  const maxPeople = fromMeetupPeopleDb(row.maxPeople);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    contentHtml: row.contentHtml || "",
    priceCents,
    category: row.category,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    timezone: row.timezone || "Asia/Shanghai", // 旧数据无字段时按北京时间
    place: row.place,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    maxPeople,
    coverUrl: row.coverUrl || "",
    tags: parseJsonStringArray(row.tagsJson),
    feeIncludes: row.feeIncludes || "",
    refundPolicy: row.refundPolicy || "",
    autoRefund: Boolean(row.autoRefund),
    gallery: parseJsonStringArray(row.galleryJson),
    contactUrl: row.contactUrl || "",
    meetingPoint: row.meetingPoint || "",
    destination: row.destination || "",
    highlights: row.highlights || "",
    adminPhone: row.adminPhone || "",
    servicePhones: parseMeetupServicePhones(row.servicePhonesJson),
    wechatService: row.wechatService || "",
    itineraryHtml: row.itineraryHtml || "",
    feeNoteHtml: row.feeNoteHtml || "",
    notesHtml: row.notesHtml || "",
    status: row.status,
    hostId: row.hostId,
    productCourseId: row.productCourseId || null,
    slots: row.slots.map((s) => ({
      id: s.id,
      name: s.name,
      maxPeople: fromMeetupPeopleDb(s.maxPeople),
      sortOrder: s.sortOrder,
      joinCount: sumMeetupPartySize(
        row.joins.filter((j) => j.slotId === s.id),
      ),
    })),
    host: {
      id: row.host.id,
      name: row.host.name,
      avatarUrl: row.host.avatarUrl || "",
    },
    joinCount,
    spotsLeft: Math.max(maxPeople - joinCount, 0),
    createdAt: row.createdAt.toISOString(),
    joins: row.joins.map((j) => ({
      id: j.id,
      userId: j.userId,
      slotId: j.slotId || null,
      partySize: Math.max(1, Math.floor(Number(j.partySize) || 1)),
      createdAt: j.createdAt.toISOString(),
      user: {
        id: j.user.id,
        name: j.user.name,
        avatarUrl: j.user.avatarUrl || "",
      },
    })),
  };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let row = await loadMeetup(id);
  if (!row) {
    return NextResponse.json({ error: "活动不存在" }, { status: 404 });
  }
  if (!row.productCourseId) {
    await ensureMeetupProductCourse(prisma, row);
    row = (await loadMeetup(id))!;
  }
  return NextResponse.json({ meetup: serialize(row) });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.meetup.findUnique({
    where: { id },
    include: {
      slots: { include: { _count: { select: { joins: true } } } },
      _count: { select: { joins: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "活动不存在" }, { status: 404 });
  }
  // 发起人管自己的；站长可管全站（字段编辑与取消）
  if (existing.hostId !== session.id && !canManageMeetups(session.role)) {
    return NextResponse.json(
      { error: "仅发起人或站长可管理活动" },
      { status: 403 },
    );
  }

  try {
    const raw = await req.json();

    // 快捷：仅改状态（详情页截止/取消/重开）
    if (
      raw &&
      typeof raw === "object" &&
      Object.keys(raw).length === 1 &&
      "status" in raw
    ) {
      const { status } = statusOnlySchema.parse(raw);
      if (!isMeetupStatus(status)) {
        return NextResponse.json({ error: "状态无效" }, { status: 400 });
      }
      let nextStatus = status;
      if (status === "OPEN") {
        const joins = await prisma.meetupJoin.findMany({
          where: { meetupId: id },
          select: { partySize: true },
        });
        nextStatus = statusAfterJoinCountChange({
          currentStatus: "OPEN",
          joinCount: sumMeetupPartySize(joins),
          maxPeople: fromMeetupPeopleDb(existing.maxPeople),
        });
      }
      await prisma.$transaction(async (tx) => {
        const updated = await tx.meetup.update({
          where: { id },
          data: { status: nextStatus },
        });
        await ensureMeetupProductCourse(tx, updated);
      });
      const row = await loadMeetup(id);
      return NextResponse.json({ meetup: serialize(row!) });
    }

    // 完整字段编辑（发起人改自己的 / 站长改任意）
    const body = meetupWriteSchema.parse(raw);
    // 发起人改时间仍不允许随意写到很久以前；站长补录可放宽
    const parsed = parseMeetupWriteBody(body, {
      allowPastStart: canManageMeetups(session.role),
    });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const data = parsed.data;

    const existingJoins = await prisma.meetupJoin.findMany({
      where: { meetupId: id },
      select: { partySize: true },
    });
    const occupied = sumMeetupPartySize(existingJoins);

    let nextStatus = existing.status;
    if (data.status && isMeetupStatus(data.status)) {
      nextStatus = data.status;
      if (data.status === "OPEN") {
        nextStatus = statusAfterJoinCountChange({
          currentStatus: "OPEN",
          joinCount: occupied,
          maxPeople: data.maxPeople,
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.meetup.update({
        where: { id },
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
          status: nextStatus,
        },
      });

      const keepIds = new Set<string>();
      for (let i = 0; i < data.slots.length; i += 1) {
        const slot = data.slots[i]!;
        if (slot.id) {
          const found = existing.slots.find((s) => s.id === slot.id);
          if (found) {
            await tx.meetupSlot.update({
              where: { id: slot.id },
              data: {
                name: slot.name,
                maxPeople: toMeetupPeopleDb(slot.maxPeople),
                sortOrder: i,
              },
            });
            keepIds.add(slot.id);
            continue;
          }
        }
        const created = await tx.meetupSlot.create({
          data: {
            meetupId: id,
            name: slot.name,
            maxPeople: toMeetupPeopleDb(slot.maxPeople),
            sortOrder: i,
          },
        });
        keepIds.add(created.id);
      }

      for (const old of existing.slots) {
        if (keepIds.has(old.id)) continue;
        if (old._count.joins > 0) {
          throw new Error(`SLOT_HAS_JOINS:${old.name}`);
        }
        await tx.meetupSlot.delete({ where: { id: old.id } });
      }

      const row = await tx.meetup.findUniqueOrThrow({ where: { id } });
      await ensureMeetupProductCourse(tx, {
        ...row,
        productCourseId: row.productCourseId,
      });
    });

    const row = await loadMeetup(id);
    return NextResponse.json({ meetup: serialize(row!) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("SLOT_HAS_JOINS:")) {
      const name = error.message.slice("SLOT_HAS_JOINS:".length);
      return NextResponse.json(
        { error: `分档「${name}」已有报名，不能删除` },
        { status: 400 },
      );
    }
    console.error("[meetup:patch]", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

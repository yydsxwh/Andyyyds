/**
 * 站长约搭单条管理
 * GET    —— 详情（含分档）
 * PATCH  —— 编辑字段 / 改状态
 * DELETE —— 硬删除（级联报名；关联可售壳及订单一并清理）
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

type Ctx = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: "请先登录", status: 401 as const };
  if (!canManageMeetups(session.role)) {
    return { error: "仅站长可管理约搭", status: 403 as const };
  }
  return { session };
}

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;
  const meetup = await prisma.meetup.findUnique({
    where: { id },
    include: {
      host: { select: { id: true, name: true } },
      slots: {
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { joins: true } } },
      },
      _count: { select: { joins: true } },
    },
  });
  if (!meetup) {
    return NextResponse.json({ error: "活动不存在" }, { status: 404 });
  }

  return NextResponse.json({
    meetup: {
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
      latitude: meetup.latitude ?? null,
      longitude: meetup.longitude ?? null,
      maxPeople: fromMeetupPeopleDb(meetup.maxPeople),
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
      hostId: meetup.hostId,
      hostName: meetup.host.name,
      productCourseId: meetup.productCourseId,
      joinCount: meetup._count.joins,
      slots: meetup.slots.map((s) => ({
        id: s.id,
        name: s.name,
        maxPeople: fromMeetupPeopleDb(s.maxPeople),
        joinCount: s._count.joins,
        sortOrder: s.sortOrder,
      })),
    },
  });
}

const statusOnlySchema = z.object({
  status: z.string().trim(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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

  try {
    const raw = await req.json();

    // 快捷：仅改状态（列表取消/重开）
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
      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.meetup.update({
          where: { id },
          data: { status: nextStatus },
        });
        await ensureMeetupProductCourse(tx, row);
        return row;
      });
      return NextResponse.json({ ok: true, status: updated.status });
    }

    const body = meetupWriteSchema.parse(raw);
    const parsed = parseMeetupWriteBody(body, { allowPastStart: true });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const data = parsed.data;

    const occupiedJoins = await prisma.meetupJoin.findMany({
      where: { meetupId: id },
      select: { partySize: true },
    });
    const occupied = sumMeetupPartySize(occupiedJoins);

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

      // 分档：更新已有、新建；有人报名的档不可删
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

    return NextResponse.json({ ok: true });
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
    console.error("[studio:meetup:patch]", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  // 有已付订单时默认拒绝硬删，避免误清履约；站长确认后带 force=1
  const force = searchParams.get("force") === "1";

  const existing = await prisma.meetup.findUnique({
    where: { id },
    select: { id: true, productCourseId: true, status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "活动不存在" }, { status: 404 });
  }

  try {
    const productCourseId = existing.productCourseId;
    let paidOrderCount = 0;
    if (productCourseId) {
      paidOrderCount = await prisma.order.count({
        where: { courseId: productCourseId, status: "PAID" },
      });
    }

    // 有成交时优先引导「取消」软隐藏；确需清空才 force
    if (paidOrderCount > 0 && !force) {
      return NextResponse.json(
        {
          error: `该活动有 ${paidOrderCount} 笔已付订单。请先「取消」活动；若仍要硬删除（会清除订单），请再次确认强制删除。`,
          paidOrderCount,
          needForce: true,
        },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // 先删活动（报名/分档级联）；壳商品外键 SetNull
      await tx.meetup.delete({ where: { id } });
      let deletedOrders = 0;
      if (productCourseId) {
        // Order 无 Cascade，须先清订单再删壳，避免站长删活动被外键卡住
        const orders = await tx.order.deleteMany({
          where: { courseId: productCourseId },
        });
        deletedOrders = orders.count;
        await tx.course.delete({ where: { id: productCourseId } }).catch(() => {
          /* 壳可能已被其它路径删掉 */
        });
      }
      return { deletedOrders };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[studio:meetup:delete]", error);
    return NextResponse.json(
      { error: "删除失败，请稍后重试或先取消活动" },
      { status: 500 },
    );
  }
}

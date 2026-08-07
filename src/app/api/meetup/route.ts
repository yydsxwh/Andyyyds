/**
 * GET  /api/meetup —— 广场列表（可按分类筛选）
 * POST /api/meetup —— 发起约搭（任意登录用户，不限角色；可设价、分档、安心文案、富媒体）
 *
 * 站长全站 CRUD 在 /api/studio/meetups，勿把创建收紧成仅 ADMIN。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isMeetupCategory,
  MEETUP_MAX_PEOPLE,
  MEETUP_MAX_PRICE_CENTS,
  MEETUP_MIN_PEOPLE,
  yuanToMeetupPriceCents,
} from "@/lib/meetup";
import {
  meetupBlocksToHtml,
  parseMeetupContentBlocks,
  sanitizeMeetupContentHtml,
} from "@/lib/meetup-content";
import {
  normalizeMeetupSlotInputs,
  parseJsonStringArray,
  stringifyJsonStringArray,
} from "@/lib/meetup-meta";
import { ensureMeetupProductCourse } from "@/lib/meetup-product";

const slotSchema = z.object({
  name: z.string().trim().min(1).max(40),
  maxPeople: z.number().int().min(1).max(MEETUP_MAX_PEOPLE),
});

const createSchema = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(2000).optional().default(""),
  contentHtml: z.string().max(100_000).optional().default(""),
  contentBlocks: z.array(z.unknown()).max(40).optional(),
  priceYuan: z.union([z.number(), z.string()]).optional(),
  category: z.string().trim(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional().nullable(),
  place: z.string().trim().min(1).max(120),
  maxPeople: z.number().int().min(MEETUP_MIN_PEOPLE).max(MEETUP_MAX_PEOPLE),
  coverUrl: z.string().trim().max(500).optional().default(""),
  tags: z.array(z.string()).max(12).optional(),
  feeIncludes: z.string().trim().max(500).optional().default(""),
  refundPolicy: z.string().trim().max(500).optional().default(""),
  autoRefund: z.boolean().optional().default(false),
  gallery: z.array(z.string()).max(12).optional(),
  contactUrl: z.string().trim().max(500).optional().default(""),
  slots: z.array(slotSchema).max(8).optional(),
});

function serializeMeetup(row: {
  id: string;
  title: string;
  description: string;
  contentHtml?: string;
  priceCents?: number;
  category: string;
  startsAt: Date;
  endsAt?: Date | null;
  place: string;
  maxPeople: number;
  coverUrl: string;
  tagsJson?: string;
  feeIncludes?: string;
  refundPolicy?: string;
  autoRefund?: boolean;
  galleryJson?: string;
  contactUrl?: string;
  status: string;
  hostId: string;
  productCourseId?: string | null;
  createdAt: Date;
  host: { id: string; name: string; avatarUrl: string };
  slots?: {
    id: string;
    name: string;
    maxPeople: number;
    sortOrder: number;
    joins?: { id: string; userId: string }[];
    _count?: { joins: number };
  }[];
  joins: {
    id: string;
    userId: string;
    slotId?: string | null;
    createdAt: Date;
    user?: { id: string; name: string; avatarUrl: string };
  }[];
  _count?: { joins: number };
}) {
  const joinCount = row._count?.joins ?? row.joins.length;
  const priceCents = Math.max(0, Math.floor(row.priceCents || 0));
  const slots = (row.slots || []).map((s) => {
    const count =
      s._count?.joins ??
      row.joins.filter((j) => j.slotId === s.id).length;
    return {
      id: s.id,
      name: s.name,
      maxPeople: s.maxPeople,
      sortOrder: s.sortOrder,
      joinCount: count,
    };
  });
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    contentHtml: row.contentHtml || "",
    priceCents,
    category: row.category,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    place: row.place,
    maxPeople: row.maxPeople,
    coverUrl: row.coverUrl || "",
    tags: parseJsonStringArray(row.tagsJson),
    feeIncludes: row.feeIncludes || "",
    refundPolicy: row.refundPolicy || "",
    autoRefund: Boolean(row.autoRefund),
    gallery: parseJsonStringArray(row.galleryJson),
    contactUrl: row.contactUrl || "",
    status: row.status,
    hostId: row.hostId,
    productCourseId: row.productCourseId || null,
    slots,
    host: {
      id: row.host.id,
      name: row.host.name,
      avatarUrl: row.host.avatarUrl || "",
    },
    joinCount,
    spotsLeft: Math.max(row.maxPeople - joinCount, 0),
    createdAt: row.createdAt.toISOString(),
    joins: row.joins.map((j) => ({
      id: j.id,
      userId: j.userId,
      slotId: j.slotId || null,
      createdAt: j.createdAt.toISOString(),
      user: j.user
        ? {
            id: j.user.id,
            name: j.user.name,
            avatarUrl: j.user.avatarUrl || "",
          }
        : undefined,
    })),
  };
}

const meetupInclude = {
  host: { select: { id: true, name: true, avatarUrl: true } },
  slots: { orderBy: { sortOrder: "asc" as const } },
  joins: {
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
  _count: { select: { joins: true } },
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category")?.trim() || "";
  const includePast = searchParams.get("past") === "1";

  const where: {
    category?: string;
    status?: { not: string };
    startsAt?: { gte: Date };
  } = {
    status: { not: "CANCELLED" },
  };
  if (category && isMeetupCategory(category)) {
    where.category = category;
  }
  if (!includePast) {
    where.startsAt = { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) };
  }

  const rows = await prisma.meetup.findMany({
    where,
    include: meetupInclude,
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return NextResponse.json({ meetups: rows.map(serializeMeetup) });
}

function isSafeUrl(url: string): boolean {
  if (!url) return true;
  return /^https?:\/\//i.test(url) || url.startsWith("/");
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录后再发起约搭" }, { status: 401 });
  }

  try {
    const body = createSchema.parse(await req.json());
    if (!isMeetupCategory(body.category)) {
      return NextResponse.json({ error: "分类无效" }, { status: 400 });
    }

    const startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "开始时间无效" }, { status: 400 });
    }
    if (startsAt.getTime() < Date.now() - 30 * 60 * 1000) {
      return NextResponse.json(
        { error: "开始时间不能早于当前时间" },
        { status: 400 },
      );
    }

    let endsAt: Date | null = null;
    if (body.endsAt) {
      endsAt = new Date(body.endsAt);
      if (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
        return NextResponse.json(
          { error: "结束时间须晚于开始时间" },
          { status: 400 },
        );
      }
    }

    const coverUrl = body.coverUrl?.trim() || "";
    if (coverUrl && !isSafeUrl(coverUrl)) {
      return NextResponse.json(
        { error: "封面请填写 http(s) 链接或站内路径" },
        { status: 400 },
      );
    }

    const contactUrl = body.contactUrl?.trim() || "";
    if (contactUrl && !isSafeUrl(contactUrl)) {
      return NextResponse.json({ error: "联系链接无效" }, { status: 400 });
    }

    const gallery = (body.gallery || [])
      .map((u) => u.trim())
      .filter((u) => isSafeUrl(u))
      .slice(0, 12);

    const priceCents = yuanToMeetupPriceCents(body.priceYuan ?? 0);
    if (priceCents > MEETUP_MAX_PRICE_CENTS) {
      return NextResponse.json({ error: "报名费过高" }, { status: 400 });
    }

    const blocks = body.contentBlocks
      ? parseMeetupContentBlocks(body.contentBlocks)
      : null;
    const contentHtml = sanitizeMeetupContentHtml(
      blocks && blocks.length > 0
        ? meetupBlocksToHtml(blocks)
        : body.contentHtml || "",
    );

    const slotInputs = normalizeMeetupSlotInputs(body.slots, body.maxPeople);
    const maxPeople = Math.min(
      MEETUP_MAX_PEOPLE,
      Math.max(
        MEETUP_MIN_PEOPLE,
        slotInputs.reduce((sum, s) => sum + s.maxPeople, 0),
      ),
    );

    const meetup = await prisma.$transaction(async (tx) => {
      const created = await tx.meetup.create({
        data: {
          title: body.title,
          description: body.description || "",
          contentHtml,
          priceCents,
          category: body.category,
          startsAt,
          endsAt,
          place: body.place,
          maxPeople,
          coverUrl,
          tagsJson: stringifyJsonStringArray(body.tags || []),
          feeIncludes: body.feeIncludes || "",
          refundPolicy: body.refundPolicy || "",
          autoRefund: Boolean(body.autoRefund),
          galleryJson: stringifyJsonStringArray(gallery),
          contactUrl,
          status: "OPEN",
          hostId: session.id,
          slots: {
            create: slotInputs.map((s, i) => ({
              name: s.name,
              maxPeople: s.maxPeople,
              sortOrder: i,
            })),
          },
        },
        include: { slots: { orderBy: { sortOrder: "asc" } } },
      });

      // 发起人占第一档一席，本人不付报名费
      const hostSlotId = created.slots[0]?.id || null;
      await tx.meetupJoin.create({
        data: {
          meetupId: created.id,
          userId: session.id,
          slotId: hostSlotId,
        },
      });

      await ensureMeetupProductCourse(tx, {
        id: created.id,
        title: created.title,
        description: created.description,
        contentHtml: created.contentHtml,
        coverUrl: created.coverUrl,
        priceCents: created.priceCents,
        hostId: created.hostId,
        status: created.status,
      });

      return tx.meetup.findUniqueOrThrow({
        where: { id: created.id },
        include: meetupInclude,
      });
    });

    return NextResponse.json({ meetup: serializeMeetup(meetup) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "请完整填写约搭信息" }, { status: 400 });
    }
    console.error("[meetup:create]", error);
    return NextResponse.json({ error: "发起失败，请稍后重试" }, { status: 500 });
  }
}

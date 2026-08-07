/**
 * GET  /api/meetup —— 广场列表（可按分类筛选）
 * POST /api/meetup —— 发起约搭（需登录）
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isMeetupCategory,
  MEETUP_MAX_PEOPLE,
  MEETUP_MIN_PEOPLE,
} from "@/lib/meetup";

const createSchema = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(2000).optional().default(""),
  category: z.string().trim(),
  startsAt: z.string().min(1),
  place: z.string().trim().min(1).max(120),
  maxPeople: z.number().int().min(MEETUP_MIN_PEOPLE).max(MEETUP_MAX_PEOPLE),
  coverUrl: z.string().trim().max(500).optional().default(""),
});

function serializeMeetup(row: {
  id: string;
  title: string;
  description: string;
  category: string;
  startsAt: Date;
  place: string;
  maxPeople: number;
  coverUrl: string;
  status: string;
  hostId: string;
  createdAt: Date;
  host: { id: string; name: string; avatarUrl: string };
  joins: { id: string; userId: string; createdAt: Date; user?: { id: string; name: string; avatarUrl: string } }[];
  _count?: { joins: number };
}) {
  const joinCount = row._count?.joins ?? row.joins.length;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    startsAt: row.startsAt.toISOString(),
    place: row.place,
    maxPeople: row.maxPeople,
    coverUrl: row.coverUrl || "",
    status: row.status,
    hostId: row.hostId,
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category")?.trim() || "";
  const includePast = searchParams.get("past") === "1";

  const where: {
    category?: string;
    status?: { not: string };
    startsAt?: { gte: Date };
  } = {
    // 广场默认不展示已取消；过去的活动仍可按需打开
    status: { not: "CANCELLED" },
  };
  if (category && isMeetupCategory(category)) {
    where.category = category;
  }
  if (!includePast) {
    // 默认只列尚未开始或刚开始不久的活动，避免广场被历史淹没
    where.startsAt = { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) };
  }

  const rows = await prisma.meetup.findMany({
    where,
    include: {
      host: { select: { id: true, name: true, avatarUrl: true } },
      joins: {
        select: { id: true, userId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { joins: true } },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return NextResponse.json({ meetups: rows.map(serializeMeetup) });
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
    // 不允许发「已经过了很久」的局，避免误填导致广场噪音
    if (startsAt.getTime() < Date.now() - 30 * 60 * 1000) {
      return NextResponse.json(
        { error: "开始时间不能早于当前时间" },
        { status: 400 },
      );
    }

    const coverUrl = body.coverUrl?.trim() || "";
    if (coverUrl && !/^https?:\/\//i.test(coverUrl) && !coverUrl.startsWith("/")) {
      return NextResponse.json(
        { error: "封面请填写 http(s) 链接或站内路径" },
        { status: 400 },
      );
    }

    // 发起人自动占一席：创建 MeetupJoin，避免「满员不含自己」的歧义
    const meetup = await prisma.$transaction(async (tx) => {
      const created = await tx.meetup.create({
        data: {
          title: body.title,
          description: body.description || "",
          category: body.category,
          startsAt,
          place: body.place,
          maxPeople: body.maxPeople,
          coverUrl,
          status: "OPEN",
          hostId: session.id,
        },
      });
      await tx.meetupJoin.create({
        data: { meetupId: created.id, userId: session.id },
      });
      return tx.meetup.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          host: { select: { id: true, name: true, avatarUrl: true } },
          joins: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          _count: { select: { joins: true } },
        },
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

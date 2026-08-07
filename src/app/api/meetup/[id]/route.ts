/**
 * GET   /api/meetup/[id] —— 详情
 * PATCH /api/meetup/[id] —— 发起人改状态（截止 / 满员 / 取消 / 重开）
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMeetupStatus, statusAfterJoinCountChange } from "@/lib/meetup";

const patchSchema = z.object({
  status: z.string().trim(),
});

async function loadMeetup(id: string) {
  return prisma.meetup.findUnique({
    where: { id },
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
}

function serialize(row: NonNullable<Awaited<ReturnType<typeof loadMeetup>>>) {
  const joinCount = row._count.joins;
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
  const row = await loadMeetup(id);
  if (!row) {
    return NextResponse.json({ error: "活动不存在" }, { status: 404 });
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
  try {
    const body = patchSchema.parse(await req.json());
    if (!isMeetupStatus(body.status)) {
      return NextResponse.json({ error: "状态无效" }, { status: 400 });
    }

    const existing = await prisma.meetup.findUnique({
      where: { id },
      include: { _count: { select: { joins: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "活动不存在" }, { status: 404 });
    }
    if (existing.hostId !== session.id) {
      return NextResponse.json({ error: "仅发起人可管理活动" }, { status: 403 });
    }

    let nextStatus = body.status;
    // 重开时按当前人数决定 OPEN / FULL，避免「重开却已超员」
    if (body.status === "OPEN") {
      nextStatus = statusAfterJoinCountChange({
        currentStatus: "OPEN",
        joinCount: existing._count.joins,
        maxPeople: existing.maxPeople,
      });
    }

    await prisma.meetup.update({
      where: { id },
      data: { status: nextStatus },
    });

    const row = await loadMeetup(id);
    return NextResponse.json({ meetup: serialize(row!) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    console.error("[meetup:patch]", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

/**
 * POST   /api/meetup/[id]/join —— 报名
 * DELETE /api/meetup/[id]/join —— 取消报名（发起人不可退出，应改用取消活动）
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canJoinMeetup, statusAfterJoinCountChange } from "@/lib/meetup";

async function loadDetail(id: string) {
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

function serialize(row: NonNullable<Awaited<ReturnType<typeof loadDetail>>>) {
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

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录后再报名" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const meetup = await tx.meetup.findUnique({
        where: { id },
        include: { _count: { select: { joins: true } } },
      });
      if (!meetup) {
        return { error: "活动不存在", status: 404 as const };
      }
      if (!canJoinMeetup(meetup.status)) {
        return {
          error:
            meetup.status === "FULL"
              ? "已满员，换一场试试"
              : meetup.status === "CANCELLED"
                ? "活动已取消"
                : "报名已截止",
          status: 400 as const,
        };
      }
      if (meetup._count.joins >= meetup.maxPeople) {
        // 并发下可能状态尚未切到 FULL
        await tx.meetup.update({
          where: { id },
          data: { status: "FULL" },
        });
        return { error: "已满员，换一场试试", status: 400 as const };
      }

      const existing = await tx.meetupJoin.findUnique({
        where: { meetupId_userId: { meetupId: id, userId: session.id } },
      });
      if (existing) {
        return { error: "你已报名该活动", status: 400 as const };
      }

      await tx.meetupJoin.create({
        data: { meetupId: id, userId: session.id },
      });

      const joinCount = meetup._count.joins + 1;
      const nextStatus = statusAfterJoinCountChange({
        currentStatus: meetup.status,
        joinCount,
        maxPeople: meetup.maxPeople,
      });
      if (nextStatus !== meetup.status) {
        await tx.meetup.update({
          where: { id },
          data: { status: nextStatus },
        });
      }

      return { ok: true as const };
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    const row = await loadDetail(id);
    return NextResponse.json({ meetup: serialize(row!) });
  } catch (error) {
    console.error("[meetup:join]", error);
    return NextResponse.json({ error: "报名失败" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const meetup = await tx.meetup.findUnique({
        where: { id },
        include: { _count: { select: { joins: true } } },
      });
      if (!meetup) {
        return { error: "活动不存在", status: 404 as const };
      }
      if (meetup.hostId === session.id) {
        // 发起人占席不能退出，否则局无人负责；应改用「取消活动」
        return {
          error: "发起人不能退出，如需结束请取消活动",
          status: 400 as const,
        };
      }
      if (meetup.status === "CANCELLED") {
        return { error: "活动已取消", status: 400 as const };
      }

      const join = await tx.meetupJoin.findUnique({
        where: { meetupId_userId: { meetupId: id, userId: session.id } },
      });
      if (!join) {
        return { error: "你尚未报名", status: 400 as const };
      }

      await tx.meetupJoin.delete({ where: { id: join.id } });

      const joinCount = Math.max(meetup._count.joins - 1, 0);
      const nextStatus = statusAfterJoinCountChange({
        currentStatus: meetup.status,
        joinCount,
        maxPeople: meetup.maxPeople,
      });
      if (nextStatus !== meetup.status) {
        await tx.meetup.update({
          where: { id },
          data: { status: nextStatus },
        });
      }

      return { ok: true as const };
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    const row = await loadDetail(id);
    return NextResponse.json({ meetup: serialize(row!) });
  } catch (error) {
    console.error("[meetup:leave]", error);
    return NextResponse.json({ error: "取消报名失败" }, { status: 500 });
  }
}

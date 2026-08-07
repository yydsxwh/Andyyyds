/**
 * POST   /api/meetup/[id]/join —— 免费报名（可带 slotId）
 * DELETE /api/meetup/[id]/join —— 取消报名（发起人不可退出）
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  canJoinMeetup,
  isMeetupPaid,
  statusAfterJoinCountChange,
} from "@/lib/meetup";
import { ensureMeetupProductCourse } from "@/lib/meetup-product";

const joinBodySchema = z.object({
  slotId: z.string().trim().min(1).optional(),
});

async function loadDetail(id: string) {
  return prisma.meetup.findUnique({
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
      _count: { select: { joins: true } },
    },
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录后再报名" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let slotId: string | undefined;
  try {
    const raw = await req.json().catch(() => ({}));
    slotId = joinBodySchema.parse(raw).slotId;
  } catch {
    slotId = undefined;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const meetup = await tx.meetup.findUnique({
        where: { id },
        include: {
          _count: { select: { joins: true } },
          slots: { orderBy: { sortOrder: "asc" } },
        },
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
      if (isMeetupPaid(meetup.priceCents)) {
        const productCourseId =
          meetup.productCourseId ||
          (await ensureMeetupProductCourse(tx, meetup));
        return {
          error: "本活动需支付报名费，请使用「上车」报名并支付",
          status: 400 as const,
          code: "MEETUP_PAID_REQUIRED" as const,
          productCourseId,
        };
      }
      if (meetup._count.joins >= meetup.maxPeople) {
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

      let resolvedSlotId: string | null = slotId || null;
      if (meetup.slots.length > 0) {
        if (!resolvedSlotId) {
          // 未选档时进第一个有空位的档
          for (const slot of meetup.slots) {
            const count = await tx.meetupJoin.count({
              where: { slotId: slot.id },
            });
            if (count < slot.maxPeople) {
              resolvedSlotId = slot.id;
              break;
            }
          }
          if (!resolvedSlotId) {
            return { error: "各分档均已满员", status: 400 as const };
          }
        } else {
          const slot = meetup.slots.find((s) => s.id === resolvedSlotId);
          if (!slot) {
            return { error: "分档不存在", status: 400 as const };
          }
          const count = await tx.meetupJoin.count({
            where: { slotId: slot.id },
          });
          if (count >= slot.maxPeople) {
            return { error: `「${slot.name}」已满员`, status: 400 as const };
          }
        }
      } else {
        resolvedSlotId = null;
      }

      await tx.meetupJoin.create({
        data: {
          meetupId: id,
          userId: session.id,
          slotId: resolvedSlotId,
        },
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
        {
          error: result.error,
          code: "code" in result ? result.code : undefined,
          productCourseId:
            "productCourseId" in result ? result.productCourseId : undefined,
        },
        { status: result.status },
      );
    }

    const row = await loadDetail(id);
    return NextResponse.json({ ok: true, meetupId: row?.id });
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[meetup:leave]", error);
    return NextResponse.json({ error: "取消报名失败" }, { status: 500 });
  }
}

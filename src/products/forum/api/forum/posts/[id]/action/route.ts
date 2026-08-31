/**
 * POST /api/forum/posts/[id]/action
 * body: { type: LIKE | FAVORITE | WATCH | SHARE }
 * SHARE 只计数；其余三项可反复点取消。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FORUM_CLOSED, forumMemberMay, isForumActionType } from "@/lib/forum";
import { getForumSiteConfig } from "@/lib/forum-settings";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  type: z.enum(["LIKE", "FAVORITE", "WATCH", "SHARE"]),
});

function countField(type: "LIKE" | "FAVORITE" | "WATCH") {
  if (type === "LIKE") return "likeCount" as const;
  if (type === "FAVORITE") return "favoriteCount" as const;
  return "watchCount" as const;
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await getSession();
  const { id } = await ctx.params;
  try {
    const { type } = schema.parse(await req.json());
    const post = await prisma.forumPost.findUnique({ where: { id } });
    if (!post || post.status !== "PUBLISHED") {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    if (type === "SHARE") {
      const updated = await prisma.forumPost.update({
        where: { id },
        data: { shareCount: { increment: 1 } },
        select: { shareCount: true },
      });
      return NextResponse.json({ ok: true, shareCount: updated.shareCount });
    }

    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    const flags = await getForumSiteConfig();
    if (!forumMemberMay(session, flags.allowMemberInteract)) {
      return NextResponse.json({ error: FORUM_CLOSED.interact }, { status: 403 });
    }
    if (!isForumActionType(type)) {
      return NextResponse.json({ error: "未知操作" }, { status: 400 });
    }

    const field = countField(type);
    const existing = await prisma.forumAction.findUnique({
      where: {
        postId_userId_type: { postId: id, userId: session.id, type },
      },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.forumAction.delete({ where: { id: existing.id } }),
        prisma.forumPost.update({
          where: { id },
          data: { [field]: { decrement: 1 } },
        }),
      ]);
      return NextResponse.json({ ok: true, active: false });
    }

    await prisma.$transaction([
      prisma.forumAction.create({
        data: { postId: id, userId: session.id, type },
      }),
      prisma.forumPost.update({
        where: { id },
        data: { [field]: { increment: 1 } },
      }),
    ]);
    return NextResponse.json({ ok: true, active: true });
  } catch {
    return NextResponse.json({ error: "操作失败" }, { status: 400 });
  }
}

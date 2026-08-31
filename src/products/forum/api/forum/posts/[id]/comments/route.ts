/**
 * POST /api/forum/posts/[id]/comments
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FORUM_CLOSED, FORUM_COMMENT_MAX, forumMemberMay } from "@/lib/forum";
import { getForumSiteConfig } from "@/lib/forum-settings";
import { resolveStoredAccessUrl } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  body: z.string().trim().min(1).max(FORUM_COMMENT_MAX),
});

export async function POST(req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录后再评论" }, { status: 401 });
  }
  const flags = await getForumSiteConfig();
  if (!forumMemberMay(session, flags.allowMemberComment)) {
    return NextResponse.json({ error: FORUM_CLOSED.comment }, { status: 403 });
  }
  const { id } = await ctx.params;
  const post = await prisma.forumPost.findUnique({ where: { id } });
  if (!post || post.status !== "PUBLISHED") {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }
  try {
    const { body } = schema.parse(await req.json());
    const comment = await prisma.$transaction(async (tx) => {
      const row = await tx.forumComment.create({
        data: { postId: id, authorId: session.id, body },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      });
      await tx.forumPost.update({
        where: { id },
        data: { commentCount: { increment: 1 } },
      });
      return row;
    });
    return NextResponse.json({
      comment: {
        ...comment,
        author: {
          ...comment.author,
          avatarUrl: comment.author.avatarUrl
            ? await resolveStoredAccessUrl(comment.author.avatarUrl)
            : "",
        },
      },
    });
  } catch {
    return NextResponse.json({ error: "评论失败" }, { status: 400 });
  }
}

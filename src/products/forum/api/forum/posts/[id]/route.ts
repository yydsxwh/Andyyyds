/**
 * GET    /api/forum/posts/[id]
 * PATCH  作者改正文；站长可隐藏
 * DELETE 作者或站长删除
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  FORUM_BODY_MAX,
  FORUM_CLOSED,
  FORUM_MEDIA_MAX,
  FORUM_PLACE_MAX,
  FORUM_TITLE_MAX,
  forumMemberMay,
  isOwnedForumMediaUrl,
  parseForumCoords,
  parseForumMedia,
  serializeForumMedia,
} from "@/lib/forum";
import { getForumSiteConfig } from "@/lib/forum-settings";
import { canManageForum } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

const mediaSchema = z.object({
  kind: z.enum(["image", "video"]),
  url: z.string().trim().min(1).max(2000),
});

const patchSchema = z.object({
  zoneId: z.string().min(1).optional(),
  title: z.string().trim().max(FORUM_TITLE_MAX).optional(),
  body: z.string().trim().max(FORUM_BODY_MAX).optional(),
  place: z.string().trim().max(FORUM_PLACE_MAX).optional(),
  latitude: z.union([z.number(), z.string(), z.null()]).optional(),
  longitude: z.union([z.number(), z.string(), z.null()]).optional(),
  media: z.array(mediaSchema).max(FORUM_MEDIA_MAX).optional(),
  status: z.enum(["PUBLISHED", "HIDDEN", "DRAFT"]).optional(),
});

async function loadPost(id: string) {
  return prisma.forumPost.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      zone: { select: { id: true, key: true, name: true } },
      university: { select: { id: true, name: true, slug: true, enabled: true } },
      comments: {
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
        take: 200,
      },
    },
  });
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await getSession();
  const post = await loadPost(id);
  if (!post) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }
  const isOwner = session?.id === post.authorId;
  const isMod = session ? canManageForum(session) : false;
  if (post.status !== "PUBLISHED" && !isOwner && !isMod) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }

  let my: { liked: boolean; favorited: boolean; watching: boolean } = {
    liked: false,
    favorited: false,
    watching: false,
  };
  if (session) {
    const actions = await prisma.forumAction.findMany({
      where: { postId: id, userId: session.id },
      select: { type: true },
    });
    my = {
      liked: actions.some((a) => a.type === "LIKE"),
      favorited: actions.some((a) => a.type === "FAVORITE"),
      watching: actions.some((a) => a.type === "WATCH"),
    };
  }

  return NextResponse.json({ post, my });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const post = await prisma.forumPost.findUnique({ where: { id } });
  if (!post) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }
  const isMod = canManageForum(session);
  const isOwner = post.authorId === session.id;
  if (!isOwner && !isMod) {
    return NextResponse.json({ error: "无权修改" }, { status: 403 });
  }
  try {
    const body = patchSchema.parse(await req.json());
    if (body.status === "DRAFT" && post.status !== "DRAFT") {
      return NextResponse.json(
        { error: "已发布的帖子不能改回草稿" },
        { status: 400 },
      );
    }
    if (body.status === "PUBLISHED" || post.status === "DRAFT") {
      const flags = await getForumSiteConfig();
      if (!forumMemberMay(session, flags.allowMemberPost) && body.status === "PUBLISHED") {
        return NextResponse.json({ error: FORUM_CLOSED.post }, { status: 403 });
      }
    }
    let mediaJson: string | undefined;
    if (body.media) {
      const media = body.media.filter((item) =>
        isOwnedForumMediaUrl(item.url, session.id),
      );
      if (media.length !== body.media.length) {
        return NextResponse.json(
          { error: "附件无效，请重新上传后再保存" },
          { status: 400 },
        );
      }
      mediaJson = serializeForumMedia(media);
    }
    let latitude = post.latitude;
    let longitude = post.longitude;
    if (body.latitude !== undefined || body.longitude !== undefined) {
      const coords = parseForumCoords(
        body.latitude === undefined ? post.latitude : body.latitude,
        body.longitude === undefined ? post.longitude : body.longitude,
      );
      if (coords.error) {
        return NextResponse.json({ error: coords.error }, { status: 400 });
      }
      latitude = coords.latitude;
      longitude = coords.longitude;
    }
    if (body.zoneId) {
      const zone = await prisma.forumZone.findFirst({
        where: {
          id: body.zoneId,
          universityId: post.universityId,
          enabled: true,
        },
      });
      if (!zone) {
        return NextResponse.json({ error: "专区不存在或已关闭" }, { status: 400 });
      }
    }
    const nextStatus = body.status || post.status;
    const nextBody = body.body !== undefined ? body.body : post.body;
    const nextMediaRaw = mediaJson ?? post.mediaJson;
    if (nextStatus === "PUBLISHED") {
      if (!String(nextBody || "").trim() && parseForumMedia(nextMediaRaw).length === 0) {
        return NextResponse.json(
          { error: "请填写文字，或上传图片/视频" },
          { status: 400 },
        );
      }
    }
    const updated = await prisma.forumPost.update({
      where: { id },
      data: {
        zoneId: body.zoneId,
        title: body.title,
        body: body.body,
        place: body.place,
        latitude,
        longitude,
        mediaJson,
        status: body.status,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        zone: { select: { id: true, key: true, name: true } },
        university: { select: { id: true, name: true, slug: true } },
      },
    });
    return NextResponse.json({ post: updated });
  } catch {
    return NextResponse.json({ error: "修改失败" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const post = await prisma.forumPost.findUnique({ where: { id } });
  if (!post) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }
  if (post.authorId !== session.id && !canManageForum(session)) {
    return NextResponse.json({ error: "无权删除" }, { status: 403 });
  }
  await prisma.forumPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

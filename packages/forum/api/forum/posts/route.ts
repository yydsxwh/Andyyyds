/**
 * GET  /api/forum/posts?universityId=&zoneId=&take=
 * POST /api/forum/posts 本校成员发帖（图文/视频合一）
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import {
  FORUM_AUDIENCE_PUBLIC,
  FORUM_BODY_MAX,
  FORUM_CLOSED,
  FORUM_LIST_TAKE,
  FORUM_MEDIA_MAX,
  FORUM_PLACE_MAX,
  FORUM_TITLE_MAX,
  forumMemberMay,
  isOwnedForumMediaUrl,
  parseForumCoords,
  serializeForumMedia,
} from "@andyyyds/forum/lib/forum";
import {
  canSetSchoolRestrictedAudience,
  forumAudienceVisibleWhere,
  parseForumAudience,
} from "@andyyyds/forum/lib/forum-school";
import {
  FORUM_BROADCAST_MAX,
  forumBroadcastPostData,
  resolveForumBroadcastTargets,
  uniqueForumUniversityIds,
} from "@andyyyds/forum/lib/forum-broadcast";
import { getForumSiteConfig } from "@andyyyds/forum/lib/forum-settings";
import {
  canPostInForumSpace,
  isCampusForumSpace,
} from "@andyyyds/forum/lib/forum-space";
import { canManageForum } from "@andyyyds/shared/roles";

const mediaSchema = z.object({
  kind: z.enum(["image", "video"]),
  url: z.string().trim().min(1).max(2000),
});

const createSchema = z.object({
  universityId: z.string().min(1),
  zoneId: z.string().min(1),
  title: z.string().trim().max(FORUM_TITLE_MAX).optional(),
  body: z.string().trim().max(FORUM_BODY_MAX).optional(),
  place: z.string().trim().max(FORUM_PLACE_MAX).optional(),
  latitude: z.union([z.number(), z.string(), z.null()]).optional(),
  longitude: z.union([z.number(), z.string(), z.null()]).optional(),
  media: z.array(mediaSchema).max(FORUM_MEDIA_MAX).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  audience: z.enum(["PUBLIC", "SCHOOL_VERIFIED"]).optional(),
  /** 站长发布时额外同步的高校；草稿忽略。非站长提交会被丢掉 */
  syncUniversityIds: z.array(z.string().min(1)).max(FORUM_BROADCAST_MAX).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const universityId = url.searchParams.get("universityId") || "";
  const zoneId = url.searchParams.get("zoneId") || "";
  const take = Math.min(
    FORUM_LIST_TAKE,
    Math.max(1, Number(url.searchParams.get("take") || FORUM_LIST_TAKE) || FORUM_LIST_TAKE),
  );
  const session = await getSession();
  const isAdminUser = session ? canManageForum(session) : false;

  const posts = await prisma.forumPost.findMany({
    where: {
      ...(universityId ? { universityId } : {}),
      ...(zoneId ? { zoneId } : {}),
      ...(isAdminUser ? { status: { in: ["PUBLISHED", "HIDDEN"] } } : { status: "PUBLISHED" }),
      ...forumAudienceVisibleWhere({
        id: session?.id,
        isAdmin: isAdminUser,
        forumVerifiedUniversityIds: session?.forumVerifiedUniversityIds,
      }),
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      zone: { select: { id: true, key: true, name: true } },
      university: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json({ posts });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录后再发帖" }, { status: 401 });
  }
  const flags = await getForumSiteConfig();
  if (!forumMemberMay(session, flags.allowMemberPost)) {
    return NextResponse.json({ error: FORUM_CLOSED.post }, { status: 403 });
  }
  try {
    const body = createSchema.parse(await req.json());
    const uni = await prisma.forumUniversity.findUnique({
      where: { id: body.universityId },
    });
    if (!uni || !uni.enabled) {
      return NextResponse.json({ error: "分区已关闭" }, { status: 400 });
    }
    if (!canPostInForumSpace(session, uni)) {
      return NextResponse.json(
        {
          error: isCampusForumSpace(uni.kind)
            ? "完成该校实名认证后才能发帖"
            : "请先登录后再发帖",
        },
        { status: 403 },
      );
    }
    const zone = await prisma.forumZone.findFirst({
      where: {
        id: body.zoneId,
        universityId: body.universityId,
        enabled: true,
      },
    });
    if (!zone) {
      return NextResponse.json({ error: "专区不存在或已关闭" }, { status: 400 });
    }
    const title = (body.title || "").trim();
    const text = (body.body || "").trim();
    const place = (body.place || "").trim();
    const coords = parseForumCoords(body.latitude, body.longitude);
    if (coords.error) {
      return NextResponse.json({ error: coords.error }, { status: 400 });
    }
    const media = (body.media || []).filter((item) =>
      isOwnedForumMediaUrl(item.url, session.id),
    );
    const status = body.status === "DRAFT" ? "DRAFT" : "PUBLISHED";
    const audience = parseForumAudience(body.audience);
    if (audience !== FORUM_AUDIENCE_PUBLIC && !isCampusForumSpace(uni.kind)) {
      return NextResponse.json(
        { error: "仅高校分区可设仅本校可见" },
        { status: 403 },
      );
    }
    if (
      audience !== FORUM_AUDIENCE_PUBLIC &&
      !canSetSchoolRestrictedAudience(session, body.universityId)
    ) {
      return NextResponse.json(
        { error: "仅本校认证用户可见的帖子，需要先完成该校实名认证" },
        { status: 403 },
      );
    }
    if (status === "PUBLISHED" && !text && media.length === 0) {
      return NextResponse.json(
        { error: "请填写文字，或上传图片/视频" },
        { status: 400 },
      );
    }
    if ((body.media || []).length !== media.length) {
      return NextResponse.json(
        { error: "附件无效，请重新上传后再发布" },
        { status: 400 },
      );
    }
    const isAdminUser = canManageForum(session);
    const extraIds =
      isAdminUser && status === "PUBLISHED" && isCampusForumSpace(uni.kind)
        ? uniqueForumUniversityIds(body.syncUniversityIds, body.universityId)
        : [];
    const broadcast =
      extraIds.length > 0
        ? await resolveForumBroadcastTargets({
            extraUniversityIds: extraIds,
            sourceZoneKey: zone.key,
          })
        : { targets: [], skipped: [] };
    const mediaJson = serializeForumMedia(media);
    const content = {
      authorId: session.id,
      title,
      body: text,
      place,
      latitude: coords.latitude,
      longitude: coords.longitude,
      mediaJson,
      audience,
    };
    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.forumPost.create({
        data: {
          universityId: body.universityId,
          zoneId: body.zoneId,
          authorId: session.id,
          kind: "POST",
          title,
          body: text,
          place,
          latitude: coords.latitude,
          longitude: coords.longitude,
          mediaJson,
          status,
          audience,
        },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          zone: { select: { id: true, key: true, name: true } },
          university: { select: { id: true, name: true, slug: true } },
        },
      });
      if (broadcast.targets.length > 0) {
        await tx.forumPost.createMany({
          data: broadcast.targets.map((campus) =>
            forumBroadcastPostData(campus, content),
          ),
        });
      }
      return created;
    });
    return NextResponse.json({
      post,
      synced: broadcast.targets.length,
      skipped: broadcast.skipped,
    });
  } catch {
    return NextResponse.json({ error: "发布失败" }, { status: 400 });
  }
}

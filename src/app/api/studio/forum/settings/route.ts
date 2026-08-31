/**
 * GET / PATCH 大学论坛全站开关与顶部公告。仅站长。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  FORUM_NOTICE_ANIMATIONS,
  FORUM_NOTICE_BODY_MAX,
  FORUM_NOTICE_HREF_MAX,
  FORUM_NOTICE_MEDIA_MAX,
  FORUM_NOTICE_THEMES,
  FORUM_NOTICE_TITLE_MAX,
  isOwnedForumMediaUrl,
  parseForumNotice,
  type ForumSiteConfig,
} from "@/lib/forum";
import {
  getForumSiteConfig,
  getSignedForumNotice,
  saveForumSiteConfig,
} from "@/lib/forum-settings";
import { canManageForum } from "@/lib/roles";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";

const mediaSchema = z.object({
  kind: z.enum(["image", "video"]),
  url: z.string().trim().min(1).max(2000),
});

const patchSchema = z.object({
  allowMemberPost: z.boolean().optional(),
  allowMemberComment: z.boolean().optional(),
  allowMemberInteract: z.boolean().optional(),
  allowMemberMessage: z.boolean().optional(),
  notice: z
    .object({
      enabled: z.boolean().optional(),
      title: z.string().max(FORUM_NOTICE_TITLE_MAX).optional(),
      body: z.string().max(FORUM_NOTICE_BODY_MAX).optional(),
      href: z.string().max(FORUM_NOTICE_HREF_MAX).optional(),
      theme: z.enum(FORUM_NOTICE_THEMES).optional(),
      animation: z.enum(FORUM_NOTICE_ANIMATIONS).optional(),
      media: z.array(mediaSchema).max(FORUM_NOTICE_MEDIA_MAX).optional(),
    })
    .optional(),
});

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!canManageForum(session)) {
      return NextResponse.json({ error: "仅站长可管理大学论坛" }, { status: 403 });
    }
    const config = await getForumSiteConfig();
    const noticePreview = await getSignedForumNotice(config.notice);
    return NextResponse.json({ config, noticePreview });
  } catch (error) {
    const { status, error: message } = studioErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAdmin();
    if (!canManageForum(session)) {
      return NextResponse.json({ error: "仅站长可管理大学论坛" }, { status: 403 });
    }
    const body = patchSchema.parse(await req.json());
    const current = await getForumSiteConfig();
    let media = current.notice.media;
    if (body.notice?.media) {
      media = body.notice.media.filter((item) =>
        isOwnedForumMediaUrl(item.url, session.id),
      );
      if (media.length !== body.notice.media.length) {
        return NextResponse.json(
          { error: "公告附件无效，请重新上传后再保存" },
          { status: 400 },
        );
      }
    }
    const nextNotice = parseForumNotice({
      ...current.notice,
      ...body.notice,
      media,
    });
    const next: ForumSiteConfig = {
      allowMemberPost: body.allowMemberPost ?? current.allowMemberPost,
      allowMemberComment: body.allowMemberComment ?? current.allowMemberComment,
      allowMemberInteract: body.allowMemberInteract ?? current.allowMemberInteract,
      allowMemberMessage: body.allowMemberMessage ?? current.allowMemberMessage,
      notice: nextNotice,
    };
    const config = await saveForumSiteConfig(next);
    const noticePreview = await getSignedForumNotice(config.notice);
    return NextResponse.json({ config, noticePreview });
  } catch (error) {
    const { status, error: message } = studioErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * 大学论坛全站配置：读写 SiteSettings.forumJson。
 * 仅服务端引用（依赖 site-settings / prisma），勿从客户端组件 import。
 */

import { prisma } from "@andyyyds/shared/db";
import {
  parseForumSiteConfig,
  serializeForumSiteConfig,
  type ForumNoticeConfig,
  type ForumSiteConfig,
} from "@andyyyds/forum/lib/forum";
import { signForumMedia } from "@andyyyds/forum/lib/forum-media";
import {
  getSiteSettings,
  invalidateSiteSettingsCache,
} from "@andyyyds/shared/site-settings";

export type PublicForumNotice = ForumNoticeConfig;

export async function getForumSiteConfig(): Promise<ForumSiteConfig> {
  const row = await getSiteSettings();
  return parseForumSiteConfig(row.forumJson);
}

export async function saveForumSiteConfig(config: ForumSiteConfig): Promise<ForumSiteConfig> {
  const json = serializeForumSiteConfig(config);
  await prisma.siteSettings.upsert({
    where: { id: "default" },
    create: { id: "default", forumJson: json },
    update: { forumJson: json },
  });
  invalidateSiteSettingsCache();
  return parseForumSiteConfig(json);
}

/** 前台顶部公告：未开启或无内容则不展示 */
export async function getPublicForumNotice(): Promise<PublicForumNotice | null> {
  const config = await getForumSiteConfig();
  const notice = config.notice;
  if (!notice.enabled) return null;
  const hasText = Boolean(notice.title.trim() || notice.body.trim());
  if (!hasText && notice.media.length === 0) return null;
  return {
    ...notice,
    media: await signForumMedia(notice.media),
  };
}

export async function getSignedForumNotice(
  notice: ForumNoticeConfig,
): Promise<PublicForumNotice> {
  return {
    ...notice,
    media: await signForumMedia(notice.media),
  };
}

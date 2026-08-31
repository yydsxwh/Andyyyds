/**
 * 课时媒体形态：组课时资料可落成 DOCUMENT/IMAGE 等；
 * 学习页按类型走播放或预览/下载，勿一律当视频。
 */

import { MEDIA_KIND_LABEL, isMediaKind } from "@andyyyds/shared/media";

export const LESSON_FILE_TYPES = [
  "DOCUMENT",
  "IMAGE",
  "AUDIO",
  "OTHER",
] as const;

export type LessonFileType = (typeof LESSON_FILE_TYPES)[number];

export function isLessonFileType(type: string): type is LessonFileType {
  return (LESSON_FILE_TYPES as readonly string[]).includes(type);
}

/** 需要签发访问 URL 的课时（视频点播 + 可下载文件） */
export function lessonNeedsAccessUrl(type: string) {
  return type === "VIDEO" || isLessonFileType(type);
}

export function lessonTypeLabel(type: string) {
  if (type === "ARTICLE") return "图文";
  if (type === "LIVE") return "直播";
  if (isMediaKind(type)) return MEDIA_KIND_LABEL[type];
  return type;
}

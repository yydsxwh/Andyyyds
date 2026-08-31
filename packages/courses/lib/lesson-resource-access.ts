/**
 * 课件下载防盗链：短时 JWT + 登录报名校验。
 * 不做 DRM 声称；目标是杜绝永久公开直链与匿名热链。
 */

import { SignJWT, jwtVerify } from "jose";

/** 下载令牌有效期：够移动端点开，又难以长期转发 */
export const LESSON_RESOURCE_TOKEN_TTL = "8m";
export const LESSON_RESOURCE_OSS_TTL_SEC = 8 * 60;

export type LessonResourceDownloadToken = {
  resourceId: string;
  userId: string;
  enrollmentId: string;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is missing");
  return new TextEncoder().encode(secret);
}

export async function signLessonResourceDownloadToken(
  payload: LessonResourceDownloadToken,
) {
  return new SignJWT({
    resourceId: payload.resourceId,
    userId: payload.userId,
    enrollmentId: payload.enrollmentId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(LESSON_RESOURCE_TOKEN_TTL)
    .sign(getSecret());
}

export async function verifyLessonResourceDownloadToken(
  token: string,
): Promise<LessonResourceDownloadToken | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const resourceId = String(payload.resourceId || "");
    const userId = String(payload.userId || "");
    const enrollmentId = String(payload.enrollmentId || "");
    if (!resourceId || !userId || !enrollmentId) return null;
    return { resourceId, userId, enrollmentId };
  } catch {
    return null;
  }
}

/**
 * Content-Disposition 文件名嵌入截断 userId，泄露后便于溯源；
 * 不依赖客户端诚实上报。
 */
export function downloadFileNameForUser(
  originalName: string,
  userId: string,
): string {
  const safeBase =
    originalName.replace(/[^\w.\u4e00-\u9fa5-]+/g, "_").slice(0, 80) ||
    "resource.bin";
  const uid = userId.slice(0, 8);
  const dot = safeBase.lastIndexOf(".");
  if (dot > 0) {
    return `${safeBase.slice(0, dot)}_${uid}${safeBase.slice(dot)}`;
  }
  return `${safeBase}_${uid}`;
}

/** 观看进度百分比：positionSec / durationSec，完成则按 100 */
export function videoWatchPercent(input: {
  positionSec: number;
  durationSec: number;
  completed: boolean;
}): number {
  if (input.completed) return 100;
  const duration = Math.max(0, input.durationSec || 0);
  if (duration <= 0) return 0;
  const pos = Math.max(0, input.positionSec || 0);
  return Math.min(100, Math.round((pos / duration) * 100));
}

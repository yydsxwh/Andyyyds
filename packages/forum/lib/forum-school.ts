/**
 * 高校实名认证与帖子可见范围。
 *
 * 每人只能占两档：一所本科、一所研究生（可同一所学校）。
 * 通过后可发「仅本校认证用户可见」帖，也能看到别人的本校贴。
 * 站长审核 PENDING；校园邮箱命中该校后缀则当场通过。
 */

import type { Prisma } from "@prisma/client";
import {
  emailMatchesUniversityDomains,
  FORUM_AUDIENCE_PUBLIC,
  FORUM_AUDIENCE_SCHOOL,
  FORUM_CAMPUS_EMAIL_MAX,
  FORUM_REAL_NAME_MAX,
  FORUM_STUDENT_ID_MAX,
  isForumPostAudience,
  parseEmailDomains,
  type ForumPostAudience,
} from "@andyyyds/forum/lib/forum";
import { isAdmin, type RoleInput } from "@andyyyds/shared/roles";

export const FORUM_DEGREE_LEVELS = ["UNDERGRAD", "GRADUATE"] as const;
export type ForumDegreeLevel = (typeof FORUM_DEGREE_LEVELS)[number];

export const FORUM_VERIFY_STATUSES = ["PENDING", "VERIFIED", "REJECTED"] as const;
export type ForumVerifyStatus = (typeof FORUM_VERIFY_STATUSES)[number];

export const FORUM_DEGREE_LABEL: Record<ForumDegreeLevel, string> = {
  UNDERGRAD: "本科",
  GRADUATE: "研究生",
};

export const FORUM_VERIFY_STATUS_LABEL: Record<ForumVerifyStatus, string> = {
  PENDING: "审核中",
  VERIFIED: "已认证",
  REJECTED: "未通过",
};

export const FORUM_AUDIENCE_LABEL: Record<ForumPostAudience, string> = {
  PUBLIC: "所有人可见",
  SCHOOL_VERIFIED: "仅本校认证用户可见",
};

export type ForumSchoolSlot = {
  degreeLevel: ForumDegreeLevel;
  universityId: string;
  universityName?: string;
  universitySlug?: string;
  status: ForumVerifyStatus;
  realName?: string;
  studentId?: string;
  campusEmail?: string;
  reviewNote?: string;
};

export type ForumSchoolIdentity = {
  verifiedUniversityIds: string[];
  slots: ForumSchoolSlot[];
};

export function isForumDegreeLevel(value: string): value is ForumDegreeLevel {
  return (FORUM_DEGREE_LEVELS as readonly string[]).includes(value);
}

export function isForumVerifyStatus(value: string): value is ForumVerifyStatus {
  return (FORUM_VERIFY_STATUSES as readonly string[]).includes(value);
}

export function parseForumAudience(raw: string | null | undefined): ForumPostAudience {
  const value = String(raw || "").trim();
  return isForumPostAudience(value) ? value : FORUM_AUDIENCE_PUBLIC;
}

export function isSchoolRestrictedAudience(raw: string | null | undefined): boolean {
  return parseForumAudience(raw) === FORUM_AUDIENCE_SCHOOL;
}

export function verifiedUniversityIdsFromSlots(
  slots: Array<{ universityId: string; status: string }>,
): string[] {
  const ids = new Set<string>();
  for (const slot of slots) {
    if (slot.status === "VERIFIED" && slot.universityId) ids.add(slot.universityId);
  }
  return [...ids];
}

export function slotForDegree(
  slots: ForumSchoolSlot[],
  degree: ForumDegreeLevel,
): ForumSchoolSlot | undefined {
  return slots.find((slot) => slot.degreeLevel === degree);
}

export function slotForUniversity(
  slots: ForumSchoolSlot[],
  universityId: string,
): ForumSchoolSlot | undefined {
  return slots.find((slot) => slot.universityId === universityId);
}

/** 该校已通过实名认证（本科或研究生任一档） */
export function isVerifiedForUniversity(
  identity: Pick<ForumSchoolIdentity, "verifiedUniversityIds"> | null | undefined,
  universityId: string,
): boolean {
  return Boolean(identity?.verifiedUniversityIds.includes(universityId));
}

export function canViewSchoolRestrictedPost(
  post: { authorId: string; universityId: string; audience?: string | null },
  viewer: {
    id?: string | null;
    isAdmin?: boolean;
    forumVerifiedUniversityIds?: string[] | null;
  } | null,
): boolean {
  if (!isSchoolRestrictedAudience(post.audience)) return true;
  if (!viewer) return false;
  if (viewer.isAdmin) return true;
  if (viewer.id && viewer.id === post.authorId) return true;
  return Boolean(viewer.forumVerifiedUniversityIds?.includes(post.universityId));
}

export function canSetSchoolRestrictedAudience(
  session: RoleInput & { forumVerifiedUniversityIds?: string[] | null },
  universityId: string,
): boolean {
  if (isAdmin(session)) return true;
  return Boolean(session.forumVerifiedUniversityIds?.includes(universityId));
}

/**
 * 列表查询：未认证用户看不到「仅本校可见」帖，作者自己和站长除外。
 */
export function forumAudienceVisibleWhere(viewer: {
  id?: string | null;
  isAdmin?: boolean;
  forumVerifiedUniversityIds?: string[] | null;
} | null): Prisma.ForumPostWhereInput {
  if (viewer?.isAdmin) return {};
  const verified = viewer?.forumVerifiedUniversityIds || [];
  const or: Prisma.ForumPostWhereInput[] = [
    { audience: FORUM_AUDIENCE_PUBLIC },
    { audience: { not: FORUM_AUDIENCE_SCHOOL } },
  ];
  if (viewer?.id) or.push({ authorId: viewer.id });
  if (verified.length > 0) {
    or.push({
      audience: FORUM_AUDIENCE_SCHOOL,
      universityId: { in: verified },
    });
  }
  return { OR: or };
}

export function normalizeRealName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, FORUM_REAL_NAME_MAX);
}

export function normalizeStudentId(raw: string): string {
  return raw.replace(/\s+/g, "").trim().slice(0, FORUM_STUDENT_ID_MAX);
}

export function normalizeCampusEmail(raw: string): string {
  return raw.trim().toLowerCase().slice(0, FORUM_CAMPUS_EMAIL_MAX);
}

export function validateSchoolVerifyInput(input: {
  realName: string;
  studentId: string;
  campusEmail?: string;
}): string | null {
  if (input.realName.length < 2) return "请填写真实姓名";
  if (input.studentId.length < 4) return "请填写学号";
  if (input.campusEmail && !input.campusEmail.includes("@")) {
    return "校园邮箱格式不正确";
  }
  return null;
}

/**
 * 有学校邮箱后缀配置时：账号邮箱或填写的校园邮箱命中则当场通过。
 * 未配置后缀：与旧「加入分区」相同，提交实名信息后直接通过。
 */
export function decideForumVerifyStatus(args: {
  session: RoleInput & { email?: string };
  emailDomains: string;
  campusEmail: string;
}): ForumVerifyStatus {
  if (isAdmin(args.session)) return "VERIFIED";
  const domains = parseEmailDomains(args.emailDomains);
  if (domains.length === 0) return "VERIFIED";
  const emails = [args.campusEmail, args.session.email || ""].filter(Boolean);
  if (
    emails.some((email) =>
      emailMatchesUniversityDomains(email, args.emailDomains),
    )
  ) {
    return "VERIFIED";
  }
  return "PENDING";
}

/**
 * 课程网课内容访问：学员靠报名；站长可预览全站；授课老师可预览名下课程。
 */

import { isAdmin } from "@andyyyds/shared/roles";

/** 是否可不购买直接看完全部课时（预览 / 质检） */
export function canPreviewAllLessons(input: {
  role: string;
  userId: string;
  teacherId: string;
}): boolean {
  if (isAdmin(input.role)) return true;
  return input.userId === input.teacherId;
}

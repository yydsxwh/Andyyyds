/**
 * 课时课件：归属校验与序列化（工作室上传 / 学习页列表共用）
 */

import { prisma } from "@andyyyds/shared/db";
import { canViewAllStudioData } from "@andyyyds/shared/roles";

export type LessonResourceListItem = {
  id: string;
  lessonId: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  createdAt: string;
};

export async function getOwnedLessonInCourse(input: {
  courseId: string;
  lessonId: string;
  sessionId: string;
  role: string;
}) {
  const seeAll = canViewAllStudioData(input.role);
  const lesson = await prisma.lesson.findFirst({
    where: {
      id: input.lessonId,
      chapter: {
        courseId: input.courseId,
        course: seeAll ? undefined : { teacherId: input.sessionId },
      },
    },
    include: {
      chapter: {
        include: {
          course: { select: { id: true, teacherId: true, productType: true } },
        },
      },
    },
  });
  return lesson;
}

export async function getOwnedResourceInCourse(input: {
  courseId: string;
  resourceId: string;
  sessionId: string;
  role: string;
}) {
  const seeAll = canViewAllStudioData(input.role);
  return prisma.lessonResource.findFirst({
    where: {
      id: input.resourceId,
      lesson: {
        chapter: {
          courseId: input.courseId,
          course: seeAll ? undefined : { teacherId: input.sessionId },
        },
      },
    },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          chapter: { select: { courseId: true } },
        },
      },
    },
  });
}

export function serializeLessonResource(r: {
  id: string;
  lessonId: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  createdAt: Date;
}): LessonResourceListItem {
  return {
    id: r.id,
    lessonId: r.lessonId,
    title: r.title,
    fileName: r.fileName,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt.toISOString(),
  };
}

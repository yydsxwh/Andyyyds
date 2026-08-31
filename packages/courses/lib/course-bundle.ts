/**
 * 专栏套餐：COLUMN 引用多门 COURSE；购买专栏后开通所含单课学习权限。
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@andyyyds/shared/db";
import { joinMeetupAfterPurchase } from "@andyyyds/meetup/lib/meetup-product";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type BundleCourseSummary = {
  id: string;
  title: string;
  slug: string;
  coverUrl: string;
  price: number;
  status: string;
  productType: string;
};

/**
 * 校验并按顺序返回可打包进专栏的单课（须为本站教师名下 COURSE）。
 */
export async function resolveBundleCourses(input: {
  ownerId: string;
  courseIds: string[];
  /** 编辑专栏时排除自身，防止自引用 */
  excludeColumnId?: string;
}): Promise<BundleCourseSummary[]> {
  const ids = input.courseIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) {
    throw new Error("请至少选择一门单课加入专栏套餐");
  }
  if (input.excludeColumnId && ids.includes(input.excludeColumnId)) {
    throw new Error("专栏不能包含自身");
  }

  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) {
    throw new Error("套餐内单课不能重复");
  }

  const courses = await prisma.course.findMany({
    where: {
      id: { in: unique },
      teacherId: input.ownerId,
      productType: "COURSE",
    },
    select: {
      id: true,
      title: true,
      slug: true,
      coverUrl: true,
      price: true,
      status: true,
      productType: true,
    },
  });

  if (courses.length !== unique.length) {
    throw new Error("部分单课不存在、无权使用，或不是可打包的单课");
  }

  const byId = new Map(courses.map((c) => [c.id, c]));
  return ids.map((id) => byId.get(id)!);
}

/** 替换专栏的套餐成员（先清空再写入） */
export async function replaceColumnBundleItems(
  db: DbClient,
  columnId: string,
  courseIds: string[],
) {
  await db.courseBundleItem.deleteMany({ where: { columnId } });
  if (courseIds.length === 0) return;
  await db.courseBundleItem.createMany({
    data: courseIds.map((courseId, index) => ({
      columnId,
      courseId,
      sortOrder: index + 1,
    })),
  });
}

/**
 * 为用户开通某个商品的学习权限；若是专栏再开通所含单课；
 * 若是约搭壳则同步写入 MeetupJoin（付费报名履约入口）。
 * 已有 enrollment 则跳过，不重复增加 studentCount。
 */
export async function grantProductAccess(
  db: DbClient,
  input: { userId: string; productId: string },
) {
  await ensureEnrollment(db, input.userId, input.productId);

  const product = await db.course.findUnique({
    where: { id: input.productId },
    select: {
      id: true,
      productType: true,
      bundleItems: {
        orderBy: { sortOrder: "asc" },
        select: { courseId: true },
      },
    },
  });
  if (!product) return;

  if (product.productType === "MEETUP") {
    await joinMeetupAfterPurchase(db, {
      userId: input.userId,
      productCourseId: product.id,
    });
    return;
  }

  if (product.productType !== "COLUMN") return;

  for (const item of product.bundleItems) {
    await ensureEnrollment(db, input.userId, item.courseId);
  }
}

async function ensureEnrollment(
  db: DbClient,
  userId: string,
  courseId: string,
) {
  const existing = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return;
  await db.enrollment.create({
    data: { userId, courseId },
  });
  const course = await db.course.update({
    where: { id: courseId },
    data: { studentCount: { increment: 1 } },
    select: {
      id: true,
      title: true,
      teacherId: true,
      productType: true,
    },
  });
  // 课程/专栏/资料：开通后自动进班级群（商城实体货与约搭壳不建班级群）
  if (
    course.productType === "COURSE" ||
    course.productType === "COLUMN" ||
    course.productType === "MATERIAL"
  ) {
    try {
      const { ensureCourseGroupAndJoin } = await import(
        "@andyyyds/shared/chat/group-service"
      );
      await ensureCourseGroupAndJoin({
        courseId: course.id,
        teacherId: course.teacherId,
        courseTitle: course.title,
        userId,
      });
    } catch (err) {
      console.error("[course:chat-group]", err);
    }
  }
}

export async function listColumnBundleCourses(columnId: string) {
  const items = await prisma.courseBundleItem.findMany({
    where: { columnId },
    orderBy: { sortOrder: "asc" },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          coverUrl: true,
          price: true,
          status: true,
          subtitle: true,
          productType: true,
        },
      },
    },
  });
  return items.map((item) => item.course);
}

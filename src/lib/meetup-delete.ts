/**
 * 约搭硬删除（服务端）
 *
 * 为何集中：站长后台与前台（发起人/站长）共用同一套履约安全规则——
 * 有已付订单时默认拒绝，须 force=1 才清订单+可售壳，避免误删成交数据。
 */

import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type MeetupHardDeleteBlocked = {
  blocked: true;
  paidOrderCount: number;
  error: string;
};

export type MeetupHardDeleteOk = {
  blocked: false;
  deletedOrders: number;
};

export type MeetupHardDeleteResult =
  | MeetupHardDeleteBlocked
  | MeetupHardDeleteOk;

/**
 * 硬删活动：级联报名/分档；再清壳上订单与 Course 壳。
 * @param force 有已付订单时须为 true，否则返回 blocked（对应 HTTP 409）
 */
export async function hardDeleteMeetup(
  db: PrismaClient,
  input: { meetupId: string; productCourseId: string | null; force: boolean },
): Promise<MeetupHardDeleteResult> {
  const { meetupId, productCourseId, force } = input;

  let paidOrderCount = 0;
  if (productCourseId) {
    paidOrderCount = await db.order.count({
      where: { courseId: productCourseId, status: "PAID" },
    });
  }

  // 有成交时优先引导「取消」软隐藏；确需清空才 force
  if (paidOrderCount > 0 && !force) {
    return {
      blocked: true,
      paidOrderCount,
      error: `该活动有 ${paidOrderCount} 笔已付订单。请先「取消」活动；若仍要硬删除（会清除订单），请再次确认强制删除。`,
    };
  }

  const deletedOrders = await db.$transaction(async (tx: Db) => {
    // 先删活动（报名/分档级联）；壳商品外键 SetNull
    await tx.meetup.delete({ where: { id: meetupId } });
    let count = 0;
    if (productCourseId) {
      // Order 无 Cascade，须先清订单再删壳，避免外键卡住
      const orders = await tx.order.deleteMany({
        where: { courseId: productCourseId },
      });
      count = orders.count;
      await tx.course.delete({ where: { id: productCourseId } }).catch(() => {
        /* 壳可能已被其它路径删掉 */
      });
    }
    return count;
  });

  return { blocked: false, deletedOrders };
}

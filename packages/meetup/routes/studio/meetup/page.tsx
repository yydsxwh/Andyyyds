import { redirect } from "next/navigation";
import {
  StudioMeetupPanel,
  type StudioMeetupRow,
} from "@andyyyds/meetup/components/studio-meetup-panel";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { fromMeetupPeopleDb } from "@andyyyds/meetup/lib/meetup";
import { canManageMeetups } from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "约搭管理",
};

/**
 * 站长约搭管理：全站活动列表，增删改与取消。
 * 与产品管理 / 商城商品并列，仅 ADMIN。
 */
export default async function StudioMeetupPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageMeetups(session.role)) redirect("/studio");

  const rows = await prisma.meetup.findMany({
    include: {
      host: { select: { name: true } },
      _count: { select: { joins: true, slots: true } },
    },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  // 已付订单数：硬删前展示，避免误清履约数据
  const courseIds = rows
    .map((m) => m.productCourseId)
    .filter((id): id is string => Boolean(id));
  const paidByCourse = new Map<string, number>();
  if (courseIds.length > 0) {
    const paidGroups = await prisma.order.groupBy({
      by: ["courseId"],
      where: { courseId: { in: courseIds }, status: "PAID" },
      _count: { _all: true },
    });
    for (const g of paidGroups) {
      paidByCourse.set(g.courseId, g._count._all);
    }
  }

  const meetups: StudioMeetupRow[] = rows.map((m) => ({
    id: m.id,
    title: m.title,
    category: m.category,
    status: m.status,
    priceCents: m.priceCents,
    place: m.place,
    startsAt: m.startsAt.toISOString(),
    timezone: m.timezone || "Asia/Shanghai",
    maxPeople: fromMeetupPeopleDb(m.maxPeople),
    joinCount: m._count.joins,
    slotCount: m._count.slots,
    coverUrl: m.coverUrl || "",
    hostName: m.host.name,
    paidOrderCount: m.productCourseId
      ? paidByCourse.get(m.productCourseId) || 0
      : 0,
    updatedAt: m.updatedAt.toISOString(),
  }));

  return (
    <div className="container space-y-6 py-10 sm:py-12">
      <StudioNav current="meetup" area="admin" />
      <div>
        <h1 className="text-3xl font-semibold">约搭管理</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          管理全站约搭活动：创建、编辑、取消与删除。前台用户仍可发起自己的局；站长可改任何人的活动。
          删除会清除报名，并清理关联可售壳与订单（有成交时请谨慎）。
        </p>
      </div>
      <div className="surface rounded-[28px] p-4 sm:p-6">
        <StudioMeetupPanel initialMeetups={meetups} />
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { CoursesSubnav } from "@/components/courses-subnav";
import {
  StudioMyMeetupPanel,
  type MyMeetupRow,
} from "@/components/studio-my-meetup-panel";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fromMeetupPeopleDb } from "@/lib/meetup";
import {
  canCreateSellableProducts,
  canManageCourses,
} from "@/lib/roles";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "我的约搭",
};

/**
 * 创作者「我的约搭」：只列当前登录用户发起的活动。
 * 与站长「约搭管理」(/studio/meetup) 分离——那边是全站；这里是发起人自管。
 * 约搭是活动不是课程，故独立入口，不进「我的课程」列表。
 */
export default async function StudioMyMeetupPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageCourses(session.role)) {
    redirect("/studio");
  }

  const canCreate = canCreateSellableProducts(session.role);

  const rows = await prisma.meetup.findMany({
    where: { hostId: session.id },
    include: {
      _count: { select: { joins: true, slots: true } },
    },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const meetups: MyMeetupRow[] = rows.map((m) => ({
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
    updatedAt: m.updatedAt.toISOString(),
  }));

  return (
    <div className="container space-y-6 py-10 sm:py-12">
      <StudioNav current="courses" />
      <div>
        <h1 className="text-3xl font-semibold">我的约搭</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          管理你发起的约搭活动：查看前台、编辑、截止报名、取消或删除。约搭不是课程，不会出现在「我的课程」里。
        </p>
      </div>

      <CoursesSubnav current="meetup-mine" canCreate={canCreate} />

      <div className="surface rounded-[28px] p-4 sm:p-6">
        <StudioMyMeetupPanel initialMeetups={meetups} />
      </div>
    </div>
  );
}

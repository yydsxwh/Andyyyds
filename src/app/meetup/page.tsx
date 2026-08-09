import Link from "next/link";
import { MeetupCard } from "@/components/meetup-card";
import { MeetupPlazaToolbar } from "@/components/meetup-plaza-toolbar";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildMeetupPlazaWhere,
  fromMeetupPeopleDb,
  MEETUP_PLAZA_TAKE,
  parseMeetupSort,
  parseOptionalCoord,
  sortMeetupPlazaRows,
} from "@/lib/meetup";
import { canManageMeetups } from "@/lib/roles";
import { getHideAllPricesFlag } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "约搭",
  description: "找人一起玩：运动、美食、游戏、学习、出行结伴广场",
};

export default async function MeetupPlazaPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    sort?: string;
    lat?: string;
    lng?: string;
  }>;
}) {
  const params = await searchParams;
  const category = params.category?.trim() || "";
  const sort = parseMeetupSort(params.sort);
  const userLat = parseOptionalCoord(params.lat, "lat");
  const userLng = parseOptionalCoord(params.lng, "lng");
  const session = await getSession();
  // 站长可编辑广场任意卡片；普通用户仅编辑 hostId === 自己的局（未登录不显示）
  const isMeetupAdmin = session ? canManageMeetups(session.role) : false;

  // 与 GET /api/meetup 同一套规则：未取消（含历史）可见；排序见 sort
  const where = buildMeetupPlazaWhere({ category });

  // 取数用开场时间作候选池，再在内存按 sort 重排（综合/距离不便纯 SQL）
  const [rows, hideAllPrices] = await Promise.all([
    prisma.meetup.findMany({
      where,
      include: {
        host: { select: { id: true, name: true, avatarUrl: true } },
        productCourse: { select: { hidePrice: true } },
        _count: { select: { joins: true } },
      },
      orderBy:
        sort === "latest"
          ? [{ createdAt: "desc" }, { startsAt: "desc" }]
          : [{ startsAt: "desc" }, { createdAt: "desc" }],
      take: MEETUP_PLAZA_TAKE,
    }),
    getHideAllPricesFlag(),
  ]);

  const meetups = sortMeetupPlazaRows(
    rows.map((m) => ({
      ...m,
      maxPeople: fromMeetupPeopleDb(m.maxPeople),
      joinCount: m._count.joins,
    })),
    { sort, userLat, userLng },
  );

  return (
    <NavPageTemplateShell type="meetup">
    <div className="container py-10 sm:py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="brand-mark text-3xl font-semibold sm:text-4xl">约搭</h1>
          <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--muted)]">
            找人一起出门玩：发局、报名、组队集合。支持免费或收费报名、图文视频详情与分享分销。
          </p>
        </div>
        {session ? (
          <Link href="/meetup/new" className="btn btn-primary min-h-11 shrink-0">
            发起约搭
          </Link>
        ) : (
          <Link
            href={`/login?next=${encodeURIComponent("/meetup/new")}`}
            className="btn btn-primary min-h-11 shrink-0"
          >
            登录后发起
          </Link>
        )}
      </div>

      <MeetupPlazaToolbar
        category={category}
        sort={sort}
        userLat={userLat}
        userLng={userLng}
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {meetups.map((m) => (
          <MeetupCard
            key={m.id}
            canEdit={
              isMeetupAdmin || Boolean(session && session.id === m.hostId)
            }
            hideAllPrices={hideAllPrices}
            meetup={{
              id: m.id,
              title: m.title,
              category: m.category,
              startsAt: m.startsAt,
              timezone: m.timezone,
              place: m.place,
              maxPeople: m.maxPeople,
              coverUrl: m.coverUrl || undefined,
              status: m.status,
              joinCount: m.joinCount,
              host: { name: m.host.name },
              hostId: m.hostId,
              priceCents: m.priceCents,
              hidePrice: Boolean(m.productCourse?.hidePrice),
            }}
          />
        ))}
      </div>

      {meetups.length === 0 ? (
        <div className="surface surface-pad px-6 py-16 text-center">
          <p className="text-[var(--muted)]">暂无约搭活动</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            当第一个发起人，喊上搭子一起出门
          </p>
          {session ? (
            <Link href="/meetup/new" className="btn btn-primary mt-6 inline-flex min-h-11">
              发起约搭
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
    </NavPageTemplateShell>
  );
}

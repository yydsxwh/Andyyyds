import Link from "next/link";
import { MeetupCard } from "@/components/meetup-card";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildMeetupPlazaWhere,
  MEETUP_CATEGORIES,
  MEETUP_PLAZA_TAKE,
} from "@/lib/meetup";
import { typoRoleClass, typoRoleStyle } from "@/lib/site-typography";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "约搭",
  description: "找人一起玩：运动、美食、游戏、学习、出行结伴广场",
};

export default async function MeetupPlazaPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const category = params.category?.trim() || "";
  const session = await getSession();

  // 与 GET /api/meetup 同一套规则：未取消的约搭（含满员/已截止）在广场可见
  const where = buildMeetupPlazaWhere({ category });

  const meetups = await prisma.meetup.findMany({
    where,
    include: {
      host: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { joins: true } },
    },
    // 近期开场优先，方便手机端先看到仍相关的局
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    take: MEETUP_PLAZA_TAKE,
  });

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

      {/* 分类筛选胶囊：字号/字体走装扮「筛选标签」，窄屏可点、可换行 */}
      <div className="mb-8 flex flex-wrap gap-2">
        <Link
          href="/meetup"
          className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 touch-manipulation ${typoRoleClass("filterTag")} ${
            !category
              ? "bg-[var(--brand)] text-white"
              : "border border-[var(--line)] bg-white/70"
          }`}
          style={typoRoleStyle("filterTag")}
        >
          全部
        </Link>
        {MEETUP_CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={`/meetup?category=${c.key}`}
            className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 touch-manipulation ${typoRoleClass("filterTag")} ${
              category === c.key
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--line)] bg-white/70"
            }`}
            style={typoRoleStyle("filterTag")}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {meetups.map((m) => (
          <MeetupCard
            key={m.id}
            meetup={{
              id: m.id,
              title: m.title,
              category: m.category,
              startsAt: m.startsAt,
              place: m.place,
              maxPeople: m.maxPeople,
              coverUrl: m.coverUrl || undefined,
              status: m.status,
              joinCount: m._count.joins,
              host: { name: m.host.name },
              priceCents: m.priceCents,
            }}
          />
        ))}
      </div>

      {meetups.length === 0 ? (
        <div className="surface rounded-[28px] px-6 py-16 text-center">
          {/* 文案与查询一致：这里是「近期未取消」为空，不是「进行中」过滤为空 */}
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { MeetupActions } from "@/components/meetup-actions";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  formatMeetupWhen,
  meetupCategoryLabel,
  meetupStatusLabel,
} from "@/lib/meetup";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: { title: true },
  });
  return {
    title: meetup?.title ? `${meetup.title} · 约搭` : "约搭详情",
  };
}

export default async function MeetupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    include: {
      host: { select: { id: true, name: true, avatarUrl: true } },
      joins: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!meetup) notFound();

  const alreadyJoined = session
    ? meetup.joins.some((j) => j.userId === session.id)
    : false;
  const spotsLeft = Math.max(meetup.maxPeople - meetup.joins.length, 0);

  return (
    <div className="container py-10 sm:py-12">
      <Link href="/meetup" className="text-sm text-[var(--brand)]">
        ← 返回约搭广场
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          {meetup.coverUrl ? (
            <div className="surface overflow-hidden rounded-[28px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={meetup.coverUrl}
                alt=""
                className="aspect-[16/9] w-full object-cover"
              />
            </div>
          ) : null}

          <div className="surface rounded-[28px] p-5 sm:p-8">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--brand)]/10 px-3 py-1 text-xs text-[var(--brand)]">
                {meetupCategoryLabel(meetup.category)}
              </span>
              <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                {meetupStatusLabel(meetup.status)}
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">
              {meetup.title}
            </h1>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-[var(--muted)]">时间</dt>
                <dd>{formatMeetupWhen(meetup.startsAt)}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-[var(--muted)]">地点</dt>
                <dd className="break-words">{meetup.place}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-[var(--muted)]">人数</dt>
                <dd>
                  {meetup.joins.length}/{meetup.maxPeople}
                  {spotsLeft > 0 && meetup.status === "OPEN"
                    ? `（还可报名 ${spotsLeft} 人）`
                    : ""}
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-[var(--muted)]">发起人</dt>
                <dd>{meetup.host.name}</dd>
              </div>
            </dl>
            {meetup.description ? (
              <div className="mt-6 border-t border-[var(--line)] pt-6">
                <h2 className="text-sm font-medium text-[var(--muted)]">活动说明</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                  {meetup.description}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="surface rounded-[28px] p-5 sm:p-6">
            <h2 className="text-lg font-semibold">报名</h2>
            <div className="mt-4">
              <MeetupActions
                meetupId={meetup.id}
                status={meetup.status}
                hostId={meetup.hostId}
                currentUserId={session?.id ?? null}
                alreadyJoined={alreadyJoined}
              />
            </div>
          </div>

          <div className="surface rounded-[28px] p-5 sm:p-6">
            <h2 className="text-lg font-semibold">
              已报名（{meetup.joins.length}）
            </h2>
            <ul className="mt-4 space-y-3">
              {meetup.joins.map((j) => (
                <li
                  key={j.id}
                  className="flex min-h-11 items-center justify-between gap-3 text-sm"
                >
                  <span className="font-medium">{j.user.name}</span>
                  {j.userId === meetup.hostId ? (
                    <span className="text-xs text-[var(--brand)]">发起人</span>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">搭子</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

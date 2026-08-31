import Link from "next/link";
import { notFound } from "next/navigation";
import { ForumAccountBar } from "@andyyyds/forum/components/forum-account-bar";
import { ForumAdBanner } from "@andyyyds/forum/components/forum-ad-banner";
import { ForumFeedCard } from "@andyyyds/forum/components/forum-feed-card";
import { ForumComposeFab, ForumJoinBar } from "@andyyyds/forum/components/forum-join-bar";
import { ForumNoticeBar } from "@andyyyds/forum/components/forum-notice-bar";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { canPostInUniversity, forumMemberMay, parseForumMedia } from "@andyyyds/forum/lib/forum";
import { forumAudienceVisibleWhere } from "@andyyyds/forum/lib/forum-school";
import { signForumMedia } from "@andyyyds/forum/lib/forum-media";
import { getForumSiteConfig, getPublicForumNotice } from "@andyyyds/forum/lib/forum-settings";
import { canManageForum } from "@andyyyds/shared/roles";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";

export const dynamic = "force-dynamic";

function campusHref(path: string, zoneKey: string, keyword: string) {
  const params = new URLSearchParams();
  if (zoneKey) params.set("zone", zoneKey);
  if (keyword) params.set("q", keyword);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export default async function ForumUniversityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ zone?: string; q?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const university = await prisma.forumUniversity.findUnique({
    where: { slug },
    include: {
      zones: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!university || !university.enabled) notFound();

  const session = await getSession();
  const isAdminUser = session ? canManageForum(session) : false;
  const [flags, notice] = await Promise.all([
    getForumSiteConfig(),
    getPublicForumNotice(),
  ]);
  const allowPost = forumMemberMay(session, flags.allowMemberPost);
  const isMember = Boolean(
    session && canPostInUniversity(session, university.id),
  );
  const isVerified = Boolean(
    session?.forumVerifiedUniversityIds.includes(university.id),
  );
  const verifySlots = session
    ? (
        await prisma.forumSchoolVerification.findMany({
          where: { userId: session.id },
          include: { university: { select: { name: true, slug: true } } },
        })
      ).map((row) => ({
        degreeLevel: row.degreeLevel,
        universityId: row.universityId,
        universityName: row.university.name,
        universitySlug: row.university.slug,
        status: row.status,
        realName: row.realName,
        studentId: row.studentId,
        campusEmail: row.campusEmail,
        reviewNote: row.reviewNote,
      }))
    : [];
  const zoneKey = query.zone?.trim() || "";
  const keyword = query.q?.trim().slice(0, 40) || "";
  const activeZone = university.zones.find(
    (z) => z.enabled && (z.key === zoneKey || z.id === zoneKey),
  );

  const posts = await prisma.forumPost.findMany({
    where: {
      universityId: university.id,
      status: "PUBLISHED",
      ...(activeZone ? { zoneId: activeZone.id } : {}),
      AND: [
        forumAudienceVisibleWhere({
          id: session?.id,
          isAdmin: isAdminUser,
          forumVerifiedUniversityIds: session?.forumVerifiedUniversityIds,
        }),
        keyword
          ? {
              OR: [
                { title: { contains: keyword } },
                { body: { contains: keyword } },
                { place: { contains: keyword } },
              ],
            }
          : {},
      ],
    },
    include: {
      author: { select: { name: true, avatarUrl: true } },
      zone: { select: { name: true } },
      university: { select: { slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const adImageUrl = university.adImageUrl
    ? await resolveStoredAccessUrl(university.adImageUrl)
    : "";
  const cards = await Promise.all(
    posts.map(async (post) => ({
      ...post,
      createdAt: post.createdAt.toISOString(),
      author: {
        ...post.author,
        avatarUrl: post.author.avatarUrl
          ? await resolveStoredAccessUrl(post.author.avatarUrl)
          : "",
      },
      media: await signForumMedia(parseForumMedia(post.mediaJson)),
    })),
  );
  const path = `/forum/${university.slug}`;
  const showFab = (isMember || isAdminUser) && allowPost;

  return (
    <NavPageTemplateShell type="forum">
      <div className="container space-y-4 py-5 pb-24 sm:py-8">
        {notice ? <ForumNoticeBar notice={notice} /> : null}
        <ForumAdBanner
          imageUrl={adImageUrl}
          href={university.adHref}
          alt={university.adAlt}
        />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/forum" className="text-sm text-[var(--brand)]">
              ← 全部高校
            </Link>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
              {university.name}
            </h1>
            <p className="mt-1 max-w-xl truncate text-sm text-[var(--muted)]">
              {university.slogan || university.description || "本校同学的交流专区"}
            </p>
            <div className="mt-2 max-w-xl">
              <ForumAccountBar
                loggedIn={Boolean(session)}
                name={session?.name}
                loginNext={path}
              />
            </div>
            {session ? (
              <Link
                href="/forum/mine"
                className="mt-1 inline-flex min-h-11 items-center text-sm text-[var(--brand)]"
              >
                我的帖子 / 收藏 / 草稿
              </Link>
            ) : null}
          </div>
          <ForumJoinBar
            universityId={university.id}
            universitySlug={university.slug}
            universityName={university.name}
            loggedIn={Boolean(session)}
            isMember={isMember}
            isVerified={isVerified}
            isAdminUser={isAdminUser}
            loginNext={path}
            allowPost={allowPost}
            hideComposeOnMobile
            slots={verifySlots}
          />
        </div>

        <form className="relative mx-auto w-full max-w-xl" action={path} method="get">
          {activeZone ? (
            <input type="hidden" name="zone" value={activeZone.key} />
          ) : null}
          <input
            id="forum-campus-search"
            name="q"
            defaultValue={keyword}
            maxLength={40}
            placeholder="搜索本校帖子"
            aria-label="搜索本校帖子"
            className="min-h-11 w-full rounded-full border border-[var(--line)] bg-[var(--line)]/25 py-2 pl-4 pr-14 text-sm"
          />
          <button
            type="submit"
            className="absolute right-1 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)]"
            aria-label="搜索"
          >
            <SearchIcon />
          </button>
        </form>

        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1">
          <ZoneTab
            href={campusHref(path, "", keyword)}
            active={!activeZone}
            label="推荐"
          />
          {university.zones
            .filter((z) => z.enabled)
            .map((zone) => (
              <ZoneTab
                key={zone.id}
                href={campusHref(path, zone.key, keyword)}
                active={activeZone?.id === zone.id}
                label={zone.name}
              />
            ))}
        </nav>

        {posts.length === 0 ? (
          <p className="rounded-[24px] border border-dashed border-[var(--line)] px-5 py-16 text-center text-sm text-[var(--muted)]">
            {keyword
              ? "没有搜到相关帖子，换个词试试。"
              : "这一栏还没有内容，认证本校后发第一篇吧。"}
          </p>
        ) : (
          <div className="forum-feed-masonry">
            {cards.map((post) => (
              <ForumFeedCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
      {showFab ? <ForumComposeFab slug={university.slug} /> : null}
    </NavPageTemplateShell>
  );
}

function ZoneTab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 shrink-0 items-center px-3 text-sm ${
        active
          ? "border-b-2 border-[var(--brand)] font-semibold text-[var(--brand)]"
          : "border-b-2 border-transparent text-[var(--ink)]"
      }`}
    >
      {label}
    </Link>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20 16.5 16.5" />
    </svg>
  );
}

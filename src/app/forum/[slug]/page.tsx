import Link from "next/link";
import { notFound } from "next/navigation";
import { ForumAccountBar } from "@/components/forum-account-bar";
import { ForumAdBanner } from "@/components/forum-ad-banner";
import { ForumJoinBar } from "@/components/forum-join-bar";
import { ForumNoticeBar } from "@/components/forum-notice-bar";
import { ForumPostCard } from "@/components/forum-post-card";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { forumMemberMay, parseForumMedia } from "@/lib/forum";
import { signForumMedia } from "@/lib/forum-media";
import { getForumSiteConfig, getPublicForumNotice } from "@/lib/forum-settings";
import { canManageForum } from "@/lib/roles";
import { resolveStoredAccessUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ForumUniversityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ zone?: string }>;
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
    session && session.forumUniversityId === university.id,
  );
  let otherCampusName = "";
  if (
    session?.forumUniversityId &&
    session.forumUniversityId !== university.id
  ) {
    const other = await prisma.forumUniversity.findUnique({
      where: { id: session.forumUniversityId },
      select: { name: true },
    });
    otherCampusName = other?.name || "";
  }
  const zoneKey = query.zone?.trim() || "";
  const activeZone = university.zones.find(
    (z) => z.enabled && (z.key === zoneKey || z.id === zoneKey),
  );

  const posts = await prisma.forumPost.findMany({
    where: {
      universityId: university.id,
      status: "PUBLISHED",
      ...(activeZone ? { zoneId: activeZone.id } : {}),
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

  return (
    <NavPageTemplateShell type="forum">
      <div className="container space-y-5 py-8 sm:py-10">
        {notice ? <ForumNoticeBar notice={notice} /> : null}
        <ForumAdBanner
          imageUrl={adImageUrl}
          href={university.adHref}
          alt={university.adAlt}
        />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/forum" className="text-sm text-[var(--brand)]">
              ← 全部高校
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">{university.name}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
              {university.slogan || university.description || "本校同学的交流专区"}
            </p>
            <div className="mt-3 max-w-xl">
              <ForumAccountBar
                loggedIn={Boolean(session)}
                name={session?.name}
                loginNext={path}
              />
            </div>
            {session ? (
              <Link
                href="/forum/mine"
                className="mt-2 inline-flex min-h-11 items-center text-sm text-[var(--brand)]"
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
            isAdminUser={isAdminUser}
            loginNext={path}
            otherCampusName={otherCampusName}
            allowPost={allowPost}
          />
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <FilterChip href={path} active={!activeZone} label="全部" />
          {university.zones
            .filter((z) => z.enabled)
            .map((zone) => (
              <FilterChip
                key={zone.id}
                href={`${path}?zone=${encodeURIComponent(zone.key)}`}
                active={activeZone?.id === zone.id}
                label={zone.name}
              />
            ))}
        </div>

        <div className="space-y-3">
          {posts.length === 0 ? (
            <p className="surface rounded-[24px] px-5 py-10 text-center text-sm text-[var(--muted)]">
              这一栏还没有内容，加入本校后发第一篇吧。
            </p>
          ) : (
            cards.map((post) => (
              <ForumPostCard key={post.id} post={post} />
            ))
          )}
        </div>
      </div>
    </NavPageTemplateShell>
  );
}

function FilterChip({
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
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm ${
        active
          ? "bg-[var(--brand)] text-white"
          : "bg-[var(--line)]/40 text-[var(--ink)]"
      }`}
    >
      {label}
    </Link>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ForumNoticeBar } from "@andyyyds/forum/components/forum-notice-bar";
import { ForumPostCard } from "@andyyyds/forum/components/forum-post-card";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { parseForumMedia } from "@andyyyds/forum/lib/forum";
import { canViewSchoolRestrictedPost } from "@andyyyds/forum/lib/forum-school";
import { signForumMedia } from "@andyyyds/forum/lib/forum-media";
import { getPublicForumNotice } from "@andyyyds/forum/lib/forum-settings";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "我的论坛",
  description: "我发布的帖子、草稿、收藏和蹲蹲后续",
};

const TABS = [
  { key: "posts", label: "我的帖子" },
  { key: "drafts", label: "草稿" },
  { key: "favorites", label: "收藏" },
  { key: "watching", label: "蹲蹲后续" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function isTab(value: string): value is TabKey {
  return TABS.some((tab) => tab.key === value);
}

export default async function ForumMinePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/forum/mine");
  const notice = await getPublicForumNotice();

  const query = await searchParams;
  const requested = query.tab || "";
  const tab: TabKey = isTab(requested) ? requested : "posts";

  const include = {
    author: { select: { name: true, avatarUrl: true } },
    zone: { select: { name: true, parent: { select: { name: true } } } },
    university: { select: { slug: true } },
  } as const;

  const rawPosts =
    tab === "posts"
      ? await prisma.forumPost.findMany({
          where: { authorId: session.id, status: { not: "DRAFT" } },
          include,
          orderBy: { createdAt: "desc" },
          take: 60,
        })
      : tab === "drafts"
        ? await prisma.forumPost.findMany({
            where: { authorId: session.id, status: "DRAFT" },
            include,
            orderBy: { updatedAt: "desc" },
            take: 60,
          })
        : (
            await prisma.forumAction.findMany({
              where: {
                userId: session.id,
                type: tab === "favorites" ? "FAVORITE" : "WATCH",
              },
              include: { post: { include } },
              orderBy: { createdAt: "desc" },
              take: 60,
            })
          )
            .map((row) => row.post)
            .filter(
              (post) =>
                post.status === "PUBLISHED" &&
                canViewSchoolRestrictedPost(post, {
                  id: session.id,
                  isAdmin: false,
                  forumVerifiedUniversityIds: session.forumVerifiedUniversityIds,
                }),
            );

  const posts = await Promise.all(
    rawPosts.map(async (post) => ({
      ...post,
      createdAt:
        tab === "drafts"
          ? post.updatedAt.toISOString()
          : post.createdAt.toISOString(),
      author: {
        ...post.author,
        avatarUrl: post.author.avatarUrl
          ? await resolveStoredAccessUrl(post.author.avatarUrl)
          : "",
      },
      media: await signForumMedia(parseForumMedia(post.mediaJson)),
      href:
        tab === "drafts"
          ? `/forum/${post.university.slug}/new?draft=${encodeURIComponent(post.id)}`
          : undefined,
      hideStats: tab === "drafts",
    })),
  );

  const emptyText =
    tab === "posts"
      ? "还没有发过帖子。"
      : tab === "drafts"
        ? "还没有草稿。发帖时点「保存草稿」，下次打开该高校发帖页就能继续改。"
        : tab === "favorites"
          ? "还没有收藏。打开帖子点「收藏」就会出现在这里。"
          : "还没有蹲后续。打开帖子点「蹲蹲后续」，方便回来看评论。";

  return (
    <NavPageTemplateShell type="forum">
      <div className="container space-y-5 py-8 sm:py-10">
        {notice ? <ForumNoticeBar notice={notice} /> : null}
        <div>
          <Link href="/forum" className="text-sm text-[var(--brand)]">
            ← 论坛
          </Link>
          <h1 className="mt-2 text-3xl font-semibold">我的论坛</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            查看自己发的内容、草稿，以及收藏和蹲蹲后续的帖子。
          </p>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {TABS.map((item) => (
            <Link
              key={item.key}
              href={item.key === "posts" ? "/forum/mine" : `/forum/mine?tab=${item.key}`}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm ${
                tab === item.key
                  ? "bg-[var(--brand)] text-white"
                  : "bg-[var(--line)]/40"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="space-y-3">
          {posts.length === 0 ? (
            <p className="surface rounded-[24px] px-5 py-10 text-center text-sm text-[var(--muted)]">
              {emptyText}
            </p>
          ) : (
            posts.map((post) => <ForumPostCard key={post.id} post={post} />)
          )}
        </div>
      </div>
    </NavPageTemplateShell>
  );
}

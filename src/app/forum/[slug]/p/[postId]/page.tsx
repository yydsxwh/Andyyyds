import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ForumPlaceLinks } from "@/components/forum-place-links";
import { ForumMediaGallery } from "@/components/forum-media-gallery";
import { ForumNoticeBar } from "@/components/forum-notice-bar";
import { ForumPostManage } from "@/components/forum-post-manage";
import { ForumThreadClient } from "@/components/forum-thread-client";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { UserAvatar } from "@/components/user-avatar";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  displayPostTitle,
  excerptBody,
  formatForumTime,
  forumMemberMay,
  parseForumMedia,
} from "@/lib/forum";
import { signForumMedia } from "@/lib/forum-media";
import { getForumSiteConfig, getPublicForumNotice } from "@/lib/forum-settings";
import { getHideSocialChatFlag } from "@/lib/site-settings";
import { canManageForum } from "@/lib/roles";
import { getPublicSiteUrl } from "@/lib/payments";
import { resolveStoredAccessUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

type PageParams = { slug: string; postId: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { slug, postId } = await params;
  const post = await prisma.forumPost.findUnique({
    where: { id: postId },
    select: {
      title: true,
      body: true,
      status: true,
      university: { select: { slug: true, name: true, enabled: true } },
    },
  });
  if (
    !post ||
    post.university.slug !== slug ||
    !post.university.enabled ||
    post.status !== "PUBLISHED"
  ) {
    return { title: "帖子" };
  }
  const title = displayPostTitle(post.title, post.body);
  const description =
    excerptBody(post.body, 80) || `${post.university.name}大学论坛`;
  const site = await getPublicSiteUrl();
  const url = `${site}/forum/${slug}/p/${postId}`;
  const image = `${site}/brand/icon-192.png`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: `${post.university.name}大学论坛`,
      images: [{ url: image, width: 192, height: 192 }],
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function ForumPostPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { slug, postId } = await params;
  const session = await getSession();
  const post = await prisma.forumPost.findUnique({
    where: { id: postId },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      zone: { select: { name: true, key: true } },
      university: { select: { id: true, name: true, slug: true, enabled: true } },
      comments: {
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 200,
      },
    },
  });
  if (!post || post.university.slug !== slug || !post.university.enabled) {
    notFound();
  }
  const isOwner = session?.id === post.authorId;
  const isMod = session ? canManageForum(session) : false;
  if (post.status === "DRAFT") {
    if (isOwner || isMod) {
      redirect(`/forum/${slug}/new?draft=${encodeURIComponent(postId)}`);
    }
    notFound();
  }
  if (post.status !== "PUBLISHED" && !isOwner && !isMod) notFound();

  const myActions = session
    ? await prisma.forumAction.findMany({
        where: { postId, userId: session.id },
        select: { type: true },
      })
    : [];

  const authorAvatar = post.author.avatarUrl
    ? await resolveStoredAccessUrl(post.author.avatarUrl)
    : "";
  const comments = await Promise.all(
    post.comments.map(async (c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      author: {
        ...c.author,
        avatarUrl: c.author.avatarUrl
          ? await resolveStoredAccessUrl(c.author.avatarUrl)
          : "",
      },
    })),
  );
  const media = await signForumMedia(parseForumMedia(post.mediaJson));
  const site = await getPublicSiteUrl();
  const path = `/forum/${slug}/p/${postId}`;
  const shareUrl = `${site}${path}`;
  const shareTitle = displayPostTitle(post.title, post.body);
  const shareSummary = excerptBody(post.body, 80);
  // 第三方分享页会把图片地址写进外链，不能用带签名的 OSS 临时地址
  const shareImage = `${site}/brand/icon-192.png`;
  const [flags, notice, hideSocial] = await Promise.all([
    getForumSiteConfig(),
    getPublicForumNotice(),
    getHideSocialChatFlag(),
  ]);
  const allowComment = forumMemberMay(session, flags.allowMemberComment);
  const allowInteract = forumMemberMay(session, flags.allowMemberInteract);
  const allowMessage = forumMemberMay(
    session,
    flags.allowMemberMessage && !hideSocial,
  );

  return (
    <NavPageTemplateShell type="forum">
      <article className="container max-w-2xl space-y-6 py-8 sm:py-10">
        {notice ? <ForumNoticeBar notice={notice} /> : null}
        <Link href={`/forum/${slug}`} className="text-sm text-[var(--brand)]">
          ← {post.university.name}
        </Link>
        <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
          <UserAvatar
            name={post.author.name}
            src={authorAvatar || null}
            size="sm"
          />
          <span>{post.author.name}</span>
          <span>·</span>
          <span>{post.zone.name}</span>
          <span className="ml-auto">{formatForumTime(post.createdAt)}</span>
        </div>
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {displayPostTitle(post.title, post.body)}
        </h1>
        {post.status === "HIDDEN" ? (
          <p className="text-sm text-amber-700">此帖已隐藏，仅作者和站长可见。</p>
        ) : null}
        {post.place.trim() ? <ForumPlaceLinks place={post.place} /> : null}
        {post.body.trim() ? (
          <div className="whitespace-pre-wrap text-sm leading-7 sm:text-base">
            {post.body}
          </div>
        ) : null}
        <ForumMediaGallery items={media} />
        <ForumPostManage
          postId={post.id}
          universitySlug={slug}
          status={post.status}
          canManage={isOwner || isMod}
        />
        <ForumThreadClient
          postId={post.id}
          shareUrl={shareUrl}
          shareTitle={shareTitle}
          shareSummary={shareSummary}
          campusName={post.university.name}
          shareImage={shareImage}
          loggedIn={Boolean(session)}
          loginNext={path}
          initialComments={comments}
          counts={{
            likeCount: post.likeCount,
            favoriteCount: post.favoriteCount,
            commentCount: post.commentCount,
            watchCount: post.watchCount,
            shareCount: post.shareCount,
          }}
          my={{
            liked: myActions.some((a) => a.type === "LIKE"),
            favorited: myActions.some((a) => a.type === "FAVORITE"),
            watching: myActions.some((a) => a.type === "WATCH"),
          }}
          allowComment={allowComment}
          allowInteract={allowInteract}
          allowMessage={allowMessage}
          authorId={post.authorId}
          currentUserId={session?.id || ""}
        />
      </article>
    </NavPageTemplateShell>
  );
}

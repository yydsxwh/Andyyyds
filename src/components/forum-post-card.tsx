import Link from "next/link";
import { ForumMediaGallery } from "@/components/forum-media-gallery";
import { UserAvatar } from "@/components/user-avatar";
import {
  displayPostTitle,
  excerptBody,
  formatForumTime,
  type ForumMediaItem,
} from "@/lib/forum";

export type ForumPostCardData = {
  id: string;
  title: string;
  body: string;
  likeCount: number;
  commentCount: number;
  watchCount: number;
  createdAt: string | Date;
  author: { name: string; avatarUrl: string | null };
  zone: { name: string };
  university: { slug: string };
  media?: ForumMediaItem[];
  place?: string;
  href?: string;
  hideStats?: boolean;
};

export function ForumPostCard({ post }: { post: ForumPostCardData }) {
  const href = post.href || `/forum/${post.university.slug}/p/${post.id}`;
  return (
    <Link
      href={href}
      className="surface block rounded-[24px] p-4 transition hover:-translate-y-0.5 sm:p-5"
    >
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <UserAvatar name={post.author.name} src={post.author.avatarUrl} size="sm" />
        <span className="truncate">{post.author.name}</span>
        <span>·</span>
        <span>{post.zone.name}</span>
        <span className="ml-auto">{formatForumTime(post.createdAt)}</span>
      </div>
      <h3 className="mt-3 text-base font-semibold sm:text-lg">
        {displayPostTitle(post.title, post.body)}
      </h3>
      {post.place?.trim() ? (
        <p className="mt-2 truncate text-xs text-[var(--muted)]">📍 {post.place}</p>
      ) : null}
      {post.body.trim() ? (
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          {excerptBody(post.body)}
        </p>
      ) : null}
      <ForumMediaGallery items={post.media || []} compact />
      {post.hideStats ? (
        <p className="mt-3 text-xs text-[var(--brand)]">继续编辑草稿</p>
      ) : (
        <p className="mt-3 text-xs text-[var(--muted)]">
          {post.likeCount} 赞 · {post.commentCount} 评 · {post.watchCount} 人在蹲
        </p>
      )}
    </Link>
  );
}

import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import {
  displayPostTitle,
  excerptBody,
  type ForumMediaItem,
} from "@/lib/forum";
import type { ForumPostCardData } from "@/components/forum-post-card";

/** 无图帖的色块封面，避免瀑布流里全是空白卡片 */
const QUOTE_TONES = [
  "bg-[#efe8ff] text-[#3b2d6b]",
  "bg-[#fff1e0] text-[#5c3d1a]",
  "bg-[#e8f6ff] text-[#0b4a6f]",
  "bg-[#fde8ef] text-[#6b2d45]",
  "bg-[#eaf7ee] text-[#1e4d32]",
] as const;

function quoteTone(id: string) {
  let n = 0;
  for (const ch of id) n = (n + ch.charCodeAt(0)) % QUOTE_TONES.length;
  return QUOTE_TONES[n];
}

function coverMedia(items: ForumMediaItem[]) {
  return items.find((item) => item.kind === "image") || items[0] || null;
}

/**
 * 高校分区瀑布流卡片：封面为主、标题两行、头像+点赞。
 * 整卡可点进帖子，不依赖 hover；微信里两列同样可点。
 */
export function ForumFeedCard({ post }: { post: ForumPostCardData }) {
  const href = post.href || `/forum/${post.university.slug}/p/${post.id}`;
  const media = post.media || [];
  const cover = coverMedia(media);
  const extra = Math.max(0, media.length - 1);
  const title = displayPostTitle(post.title, post.body);
  const caption =
    title === "无标题" && cover
      ? excerptBody(post.body, 40)
      : title === "无标题"
        ? excerptBody(post.body, 72) || post.zone.name
        : title;

  return (
    <Link
      href={href}
      className="forum-feed-card block overflow-hidden rounded-[14px] active:opacity-80"
    >
      <div className="relative">
        {cover?.kind === "video" ? (
          <div className="relative bg-black">
            <video
              src={cover.url}
              className="aspect-[3/4] w-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white">
                <PlayIcon />
              </span>
            </span>
          </div>
        ) : cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt=""
            className="block max-h-[26rem] min-h-[8.5rem] w-full object-cover"
          />
        ) : (
          <div
            className={`flex min-h-[10.5rem] flex-col justify-end px-3 pb-3 pt-8 ${quoteTone(post.id)}`}
          >
            <span className="pointer-events-none absolute left-2 top-1 text-5xl font-serif leading-none opacity-30">
              “
            </span>
            <p className="relative line-clamp-5 text-[15px] font-semibold leading-snug">
              {excerptBody(post.body, 90) || title}
            </p>
          </div>
        )}
        {post.place?.trim() ? (
          <span className="absolute bottom-2 left-2 max-w-[90%] truncate rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
            📍 {post.place}
          </span>
        ) : null}
        {extra > 0 ? (
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white">
            +{extra}
          </span>
        ) : null}
      </div>
      {cover && caption ? (
        <p className="mt-2 line-clamp-2 px-1 text-[13px] font-medium leading-5 text-[var(--ink)]">
          {caption}
        </p>
      ) : null}
      <div className="mt-2 flex items-center gap-1.5 px-1 pb-1.5">
        <UserAvatar
          name={post.author.name}
          src={post.author.avatarUrl}
          size="xs"
        />
        <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--muted)]">
          {post.author.name}
        </span>
        {post.hideStats ? (
          <span className="shrink-0 text-[11px] text-[var(--brand)]">草稿</span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-[var(--muted)]">
            <HeartIcon />
            {post.likeCount}
          </span>
        )}
      </div>
    </Link>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6 fill-current" aria-hidden>
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 stroke-current"
      fill="none"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 3.8C19 15.6 12 20 12 20Z" />
    </svg>
  );
}

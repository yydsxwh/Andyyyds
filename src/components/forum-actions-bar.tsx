"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ForumBellIcon,
  ForumCommentIcon,
  ForumHeartIcon,
  ForumShareIcon,
  ForumStarIcon,
} from "@/components/forum-action-icons";
import { ForumShareSheet } from "@/components/forum-share-sheet";
import { FORUM_ACTION_LABEL, type ForumActionType } from "@/lib/forum";

type Counts = {
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  watchCount: number;
  shareCount: number;
};

type My = {
  liked: boolean;
  favorited: boolean;
  watching: boolean;
};

type Props = {
  postId: string;
  counts: Counts;
  my: My;
  loggedIn: boolean;
  shareUrl: string;
  shareTitle: string;
  shareSummary?: string;
  campusName?: string;
  shareImage?: string;
  onCommentClick?: () => void;
  allowInteract?: boolean;
};

export function ForumActionsBar({
  postId,
  counts,
  my,
  loggedIn,
  shareUrl,
  shareTitle,
  shareSummary = "",
  campusName = "",
  shareImage = "",
  onCommentClick,
  allowInteract = true,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState({ counts, my });
  const [busy, setBusy] = useState("");
  const [hint, setHint] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  async function run(type: ForumActionType) {
    if (!allowInteract) {
      setHint("站长已关闭普通用户点赞、收藏和蹲后续，仅站长可操作");
      return;
    }
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(shareUrl)}`);
      return;
    }
    setBusy(type);
    setHint("");
    try {
      const res = await fetch(`/api/forum/posts/${postId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHint(data.error || "操作失败");
        return;
      }
      const key =
        type === "LIKE"
          ? "likeCount"
          : type === "FAVORITE"
            ? "favoriteCount"
            : "watchCount";
      const myKey =
        type === "LIKE" ? "liked" : type === "FAVORITE" ? "favorited" : "watching";
      setState((prev) => {
        const active = Boolean(data.active);
        const prevActive = prev.my[myKey];
        let nextCount = prev.counts[key];
        if (active && !prevActive) nextCount += 1;
        if (!active && prevActive) nextCount = Math.max(0, nextCount - 1);
        return {
          counts: { ...prev.counts, [key]: nextCount },
          my: { ...prev.my, [myKey]: active },
        };
      });
    } finally {
      setBusy("");
    }
  }

  async function recordShare() {
    try {
      const res = await fetch(`/api/forum/posts/${postId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "SHARE" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setState((prev) => ({
        ...prev,
        counts: {
          ...prev.counts,
          shareCount: data.shareCount ?? prev.counts.shareCount + 1,
        },
      }));
    } catch {
      /* 计数失败不影响真正发出去 */
    }
  }

  const btn =
    "inline-flex min-h-11 min-w-11 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-2xl px-1.5 text-xs transition-colors sm:gap-1.5 sm:px-2 sm:text-sm";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-label={`点赞 ${state.counts.likeCount}`}
          className={`${btn} ${state.my.liked ? "bg-rose-500/12 text-rose-600" : "bg-[var(--line)]/40"}`}
          disabled={busy === "LIKE" || !allowInteract}
          onClick={() => void run("LIKE")}
        >
          <ForumHeartIcon filled={state.my.liked} />
          <span className="hidden sm:inline">点赞</span>
          <span className="tabular-nums">{state.counts.likeCount}</span>
        </button>
        <button
          type="button"
          aria-label={`收藏 ${state.counts.favoriteCount}`}
          className={`${btn} ${state.my.favorited ? "bg-amber-500/15 text-amber-600" : "bg-[var(--line)]/40"}`}
          disabled={busy === "FAVORITE" || !allowInteract}
          onClick={() => void run("FAVORITE")}
        >
          <ForumStarIcon filled={state.my.favorited} />
          <span className="hidden sm:inline">收藏</span>
          <span className="tabular-nums">{state.counts.favoriteCount}</span>
        </button>
        <button
          type="button"
          aria-label={`评论 ${state.counts.commentCount}`}
          className={`${btn} bg-[var(--line)]/40`}
          onClick={() => {
            if (onCommentClick) onCommentClick();
            else document.getElementById("forum-comment")?.focus();
          }}
        >
          <ForumCommentIcon />
          <span className="hidden sm:inline">评论</span>
          <span className="tabular-nums">{state.counts.commentCount}</span>
        </button>
        <button
          type="button"
          className={`${btn} ${state.my.watching ? "bg-sky-500/12 text-sky-700" : "bg-[var(--line)]/40"}`}
          disabled={busy === "WATCH" || !allowInteract}
          onClick={() => void run("WATCH")}
          title={FORUM_ACTION_LABEL.WATCH}
          aria-label={`${FORUM_ACTION_LABEL.WATCH} ${state.counts.watchCount}`}
        >
          <ForumBellIcon filled={state.my.watching} />
          <span className="hidden sm:inline">蹲蹲后续</span>
          <span className="tabular-nums">{state.counts.watchCount}</span>
        </button>
        <button
          type="button"
          aria-label={`分享 ${state.counts.shareCount}`}
          className={`${btn} bg-[var(--line)]/40`}
          onClick={() => {
            setHint("");
            setShareOpen(true);
          }}
        >
          <ForumShareIcon />
          <span className="hidden sm:inline">分享</span>
          <span className="tabular-nums">{state.counts.shareCount}</span>
        </button>
      </div>
      {hint ? <p className="text-xs text-[var(--muted)]">{hint}</p> : null}
      <ForumShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={shareUrl}
        title={shareTitle}
        summary={shareSummary}
        campusName={campusName}
        imageUrl={shareImage}
        onShared={() => void recordShare()}
      />
    </div>
  );
}

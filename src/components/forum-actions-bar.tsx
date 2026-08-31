"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  onCommentClick?: () => void;
  allowInteract?: boolean;
};

export function ForumActionsBar({
  postId,
  counts,
  my,
  loggedIn,
  shareUrl,
  onCommentClick,
  allowInteract = true,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState({ counts, my });
  const [busy, setBusy] = useState("");
  const [hint, setHint] = useState("");

  async function run(type: ForumActionType | "SHARE") {
    if (type !== "SHARE" && !allowInteract) {
      setHint("站长已关闭普通用户点赞、收藏和蹲后续，仅站长可操作");
      return;
    }
    if (type !== "SHARE" && !loggedIn) {
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
      if (type === "SHARE") {
        setState((prev) => ({
          ...prev,
          counts: {
            ...prev.counts,
            shareCount: data.shareCount ?? prev.counts.shareCount + 1,
          },
        }));
        try {
          if (navigator.share) {
            await navigator.share({ url: shareUrl });
          } else {
            await navigator.clipboard.writeText(shareUrl);
            setHint("链接已复制");
          }
        } catch {
          await navigator.clipboard.writeText(shareUrl);
          setHint("链接已复制");
        }
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

  const btn =
    "inline-flex min-h-11 min-w-11 flex-1 items-center justify-center gap-1 rounded-2xl px-2 text-xs sm:text-sm";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`${btn} ${state.my.liked ? "bg-[var(--brand)]/15 text-[var(--brand)]" : "bg-[var(--line)]/40"}`}
          disabled={busy === "LIKE" || !allowInteract}
          onClick={() => void run("LIKE")}
        >
          点赞 {state.counts.likeCount}
        </button>
        <button
          type="button"
          className={`${btn} ${state.my.favorited ? "bg-[var(--brand)]/15 text-[var(--brand)]" : "bg-[var(--line)]/40"}`}
          disabled={busy === "FAVORITE" || !allowInteract}
          onClick={() => void run("FAVORITE")}
        >
          收藏 {state.counts.favoriteCount}
        </button>
        <button
          type="button"
          className={`${btn} bg-[var(--line)]/40`}
          onClick={() => {
            if (onCommentClick) onCommentClick();
            else document.getElementById("forum-comment")?.focus();
          }}
        >
          评论 {state.counts.commentCount}
        </button>
        <button
          type="button"
          className={`${btn} ${state.my.watching ? "bg-[var(--brand)]/15 text-[var(--brand)]" : "bg-[var(--line)]/40"}`}
          disabled={busy === "WATCH" || !allowInteract}
          onClick={() => void run("WATCH")}
          title={FORUM_ACTION_LABEL.WATCH}
        >
          蹲蹲后续 {state.counts.watchCount}
        </button>
        <button
          type="button"
          className={`${btn} bg-[var(--line)]/40`}
          disabled={busy === "SHARE"}
          onClick={() => void run("SHARE")}
        >
          分享 {state.counts.shareCount}
        </button>
      </div>
      {hint ? <p className="text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

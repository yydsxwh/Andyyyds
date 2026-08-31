"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StartConsultChatButton } from "@/components/chat/start-consult-chat-button";
import { UserAvatar } from "@/components/user-avatar";
import { ForumActionsBar } from "@/components/forum-actions-bar";
import { CHAT_SOURCE } from "@/lib/chat/constants";
import { FORUM_CLOSED, formatForumTime } from "@/lib/forum";

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
};

type Props = {
  postId: string;
  shareUrl: string;
  shareTitle: string;
  shareSummary?: string;
  campusName?: string;
  shareImage?: string;
  loggedIn: boolean;
  loginNext: string;
  initialComments: Comment[];
  counts: {
    likeCount: number;
    favoriteCount: number;
    commentCount: number;
    watchCount: number;
    shareCount: number;
  };
  my: { liked: boolean; favorited: boolean; watching: boolean };
  allowComment?: boolean;
  allowInteract?: boolean;
  allowMessage?: boolean;
  authorId?: string;
  currentUserId?: string;
};

export function ForumThreadClient({
  postId,
  shareUrl,
  shareTitle,
  shareSummary = "",
  campusName = "",
  shareImage = "",
  loggedIn,
  loginNext,
  initialComments,
  counts,
  my,
  allowComment = true,
  allowInteract = true,
  allowMessage = false,
  authorId = "",
  currentUserId = "",
}: Props) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [commentCount, setCommentCount] = useState(counts.commentCount);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(loginNext)}`);
      return;
    }
    if (!allowComment) {
      setError(FORUM_CLOSED.comment);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/forum/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "评论失败");
        return;
      }
      setComments((prev) => [
        ...prev,
        {
          ...data.comment,
          createdAt: data.comment.createdAt || new Date().toISOString(),
        },
      ]);
      setCommentCount((n) => n + 1);
      setBody("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <ForumActionsBar
        postId={postId}
        counts={{ ...counts, commentCount }}
        my={my}
        loggedIn={loggedIn}
        shareUrl={shareUrl}
        shareTitle={shareTitle}
        shareSummary={shareSummary}
        campusName={campusName}
        shareImage={shareImage}
        allowInteract={allowInteract}
      />

      {allowMessage && authorId && authorId !== currentUserId ? (
        <StartConsultChatButton
          peerUserId={authorId}
          source={CHAT_SOURCE.FORUM_DM}
          loginHref="/login"
          className="btn btn-secondary inline-flex min-h-11 w-full items-center justify-center px-4 text-sm sm:w-auto"
        >
          私信作者
        </StartConsultChatButton>
      ) : null}

      <section>
        <h2 className="text-base font-semibold">评论</h2>
        {allowComment ? (
          <form className="mt-3 space-y-2" onSubmit={(e) => void submit(e)}>
            <textarea
              id="forum-comment"
              className="min-h-24 w-full rounded-2xl border border-[var(--line)] bg-transparent px-3 py-3"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              placeholder={loggedIn ? "说点什么，蹲后续的同学也能看到" : "登录后评论"}
            />
            {error ? <p className="text-sm text-[var(--brand)]">{error}</p> : null}
            <button
              className="btn btn-primary min-h-11 px-5"
              type="submit"
              disabled={busy || !body.trim()}
            >
              {busy ? "发送中…" : "发表评论"}
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {FORUM_CLOSED.comment}
          </p>
        )}
        <ul className="mt-4 space-y-4">
          {comments.length === 0 ? (
            <li className="text-sm text-[var(--muted)]">还没有评论，来蹲个后续吧。</li>
          ) : null}
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <UserAvatar
                name={c.author.name}
                src={c.author.avatarUrl}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{c.author.name}</span>
                  <span className="ml-2 text-xs text-[var(--muted)]">
                    {formatForumTime(c.createdAt)}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

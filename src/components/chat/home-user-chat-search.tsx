"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CHAT_SOURCE } from "@andyyyds/shared/chat/constants";

type UserHit = {
  id: string;
  name: string;
  avatarUrl: string;
  role: string;
};

/**
 * 首页：按昵称搜索用户并发起私聊请求（对方确认后才能聊）。
 */
export function HomeUserChatSearch({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<UserHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (!loggedIn) return;
    const query = q.trim();
    if (query.length < 1) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        setSearching(true);
        setError("");
        try {
          const res = await fetch(
            `/api/chat/users/search?q=${encodeURIComponent(query)}`,
          );
          const data = (await res.json()) as { users?: UserHit[]; error?: string };
          if (!res.ok) {
            setError(data.error || "搜索失败");
            setHits([]);
            return;
          }
          setHits(data.users || []);
        } catch {
          setError("搜索失败");
        } finally {
          setSearching(false);
        }
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [q, loggedIn]);

  async function startChat(peerUserId: string) {
    setBusyId(peerUserId);
    setError("");
    setHint("");
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          peerUserId,
          source: CHAT_SOURCE.USER_SEARCH,
        }),
      });
      const data = (await res.json()) as {
        conversationId?: string;
        created?: boolean;
        error?: string;
      };
      if (res.status === 401) {
        router.push("/login?next=/");
        return;
      }
      if (!res.ok || !data.conversationId) {
        setError(data.error || "发起失败");
        return;
      }
      setHint(
        data.created
          ? "已发送私聊请求，等待对方确认"
          : "已有进行中的会话，正在打开",
      );
      router.push(`/messages/${data.conversationId}`);
    } catch {
      setError("网络错误");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="pt-2 sm:pt-3">
      <div className="w-full max-w-6xl px-3 sm:px-5 lg:px-8">
        <div className="surface rounded-[28px] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">找人私聊</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                输入昵称搜索用户；对方确认接受后即可聊天
              </p>
            </div>
            <Link
              href="/messages"
              className="min-h-11 inline-flex items-center text-sm text-[var(--brand)] touch-manipulation"
            >
              我的消息 →
            </Link>
          </div>

          {!loggedIn ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              <Link href="/login?next=/" className="text-[var(--brand)]">
                登录
              </Link>
              后可搜索用户并发起私聊
            </p>
          ) : (
            <>
              <input
                className="field mt-4 min-h-11 w-full rounded-full"
                placeholder="搜索用户昵称"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                enterKeyHint="search"
                autoComplete="off"
              />
              {searching ? (
                <p className="mt-2 text-xs text-[var(--muted)]">搜索中…</p>
              ) : null}
              {error ? (
                <p className="mt-2 text-xs text-[var(--fire)]">{error}</p>
              ) : null}
              {hint ? (
                <p className="mt-2 text-xs text-[var(--brand-strong)]">{hint}</p>
              ) : null}
              {q.trim() && !searching && hits.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">未找到匹配用户</p>
              ) : null}
              <ul className="mt-3 space-y-2">
                {hits.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/70 px-3 py-2"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand)]/15 text-sm font-medium text-[var(--brand-strong)]">
                      {u.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (u.name || "?").slice(0, 1)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{u.name}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary min-h-11 shrink-0 px-4 touch-manipulation"
                      disabled={busyId === u.id}
                      onClick={() => void startChat(u.id)}
                    >
                      {busyId === u.id ? "…" : "私聊"}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

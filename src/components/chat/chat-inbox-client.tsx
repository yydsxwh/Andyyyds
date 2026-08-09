"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useChatRealtime } from "@/components/chat/use-chat-realtime";

export type InboxRow = {
  id: string;
  status: string;
  title: string;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unreadCount: number;
  peer: { id: string; name: string; avatarUrl: string } | null;
};

export function ChatInboxClient({
  initialConversations,
}: {
  initialConversations: InboxRow[];
}) {
  const [rows, setRows] = useState(initialConversations);

  const reload = useCallback(async () => {
    const res = await fetch("/api/chat/conversations");
    if (!res.ok) return;
    const data = (await res.json()) as { conversations: InboxRow[] };
    setRows(data.conversations || []);
  }, []);

  useChatRealtime({
    onEvent: () => {
      void reload();
    },
  });

  useEffect(() => {
    const t = setInterval(() => void reload(), 12000);
    return () => clearInterval(t);
  }, [reload]);

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--muted)]">
        暂无会话。可在首页搜索昵称发起私聊，或在产品页点「站内私聊咨询」。
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((c) => (
        <li key={c.id}>
          <Link
            href={`/messages/${c.id}`}
            className="flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] px-3 py-3 touch-manipulation active:bg-black/5"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand)]/15 text-sm font-medium text-[var(--brand-strong)]">
              {c.peer?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.peer.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                (c.title || "?").slice(0, 1)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{c.title}</span>
                {c.status === "PENDING" ? (
                  <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                    待确认
                  </span>
                ) : null}
                {c.status === "REJECTED" ? (
                  <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                    已拒绝
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                {c.lastMessagePreview || "暂无消息"}
              </p>
            </div>
            {c.unreadCount > 0 ? (
              <span className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-[var(--fire)] px-1.5 text-xs text-white">
                {c.unreadCount > 99 ? "99+" : c.unreadCount}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

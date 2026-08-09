"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useChatRealtime } from "@/components/chat/use-chat-realtime";

/** 顶栏「消息」入口 + 未读角标 */
export function ChatUnreadBadge() {
  const [count, setCount] = useState(0);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/unread");
      if (!res.ok) return;
      const data = (await res.json()) as { count?: number };
      setCount(Number(data.count) || 0);
    } catch {
      /* ignore */
    }
  }, []);

  useChatRealtime({
    onEvent: () => {
      void reload();
    },
  });

  useEffect(() => {
    void reload();
    const t = setInterval(() => void reload(), 20000);
    return () => clearInterval(t);
  }, [reload]);

  return (
    <Link
      href="/messages"
      className="relative inline-flex min-h-[var(--control-h)] min-w-[var(--control-h)] items-center justify-center rounded-full px-2 text-sm text-[var(--ink)] touch-manipulation active:bg-black/5"
      title="消息"
    >
      消息
      {count > 0 ? (
        <span className="absolute right-0 top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--fire)] px-1 text-[10px] leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

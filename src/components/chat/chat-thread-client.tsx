"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChatRealtime } from "@/components/chat/use-chat-realtime";
import { CHAT_MEMBER_ROLE, CHAT_STATUS } from "@/lib/chat/constants";

type Msg = {
  id: string;
  senderId: string;
  type: string;
  body: string;
  mediaUrl: string;
  createdAt: string;
  sender?: { id: string; name: string; avatarUrl: string };
};

type Conversation = {
  id: string;
  status: string;
  title: string;
  memberRole: string;
  peer: { id: string; name: string; avatarUrl: string } | null;
};

export function ChatThreadClient({
  conversationId,
  currentUserId,
  initialConversation,
  initialMessages,
}: {
  conversationId: string;
  currentUserId: string;
  initialConversation: Conversation;
  initialMessages: Msg[];
}) {
  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const scrollBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const reloadMessages = useCallback(async () => {
    const res = await fetch(`/api/chat/conversations/${conversationId}/messages`);
    if (!res.ok) return;
    const data = (await res.json()) as { messages: Msg[] };
    setMessages(data.messages || []);
  }, [conversationId]);

  const reloadConversation = useCallback(async () => {
    const res = await fetch(`/api/chat/conversations/${conversationId}`);
    if (!res.ok) return;
    const data = (await res.json()) as { conversation: Conversation };
    if (data.conversation) setConversation(data.conversation);
  }, [conversationId]);

  useChatRealtime({
    onEvent: (ev) => {
      if (ev.conversationId && ev.conversationId !== conversationId) return;
      void reloadMessages();
      void reloadConversation();
    },
  });

  useEffect(() => {
    const t = setInterval(() => {
      void reloadMessages();
      void reloadConversation();
    }, 8000);
    return () => clearInterval(t);
  }, [reloadMessages, reloadConversation]);

  useEffect(() => {
    scrollBottom();
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        },
      );
      const data = (await res.json()) as { message?: Msg; error?: string };
      if (!res.ok) {
        setError(data.error || "发送失败");
        return;
      }
      setText("");
      if (data.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === data.message!.id)
            ? prev
            : [...prev, data.message!],
        );
      } else {
        await reloadMessages();
      }
    } catch {
      setError("网络错误");
    } finally {
      setSending(false);
    }
  }

  async function accept() {
    setActing(true);
    setError("");
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/accept`,
        { method: "POST" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "接受失败");
        return;
      }
      await reloadConversation();
      await reloadMessages();
    } finally {
      setActing(false);
    }
  }

  async function reject() {
    setActing(true);
    setError("");
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/reject`,
        { method: "POST" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "拒绝失败");
        return;
      }
      await reloadConversation();
      await reloadMessages();
    } finally {
      setActing(false);
    }
  }

  const canChat = conversation.status === CHAT_STATUS.ACTIVE;
  const isRecipientPending =
    conversation.status === CHAT_STATUS.PENDING &&
    conversation.memberRole === CHAT_MEMBER_ROLE.RECIPIENT;
  const isRequesterPending =
    conversation.status === CHAT_STATUS.PENDING &&
    conversation.memberRole === CHAT_MEMBER_ROLE.REQUESTER;

  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="mb-3 flex items-center gap-3">
        <Link
          href="/messages"
          className="min-h-11 inline-flex items-center px-1 text-sm text-[var(--brand)] touch-manipulation"
        >
          ← 消息
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {conversation.title}
        </h1>
      </div>

      {isRecipientPending ? (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <p className="font-medium text-amber-900">有人请求与你私聊</p>
          <p className="mt-1 text-amber-800/90">
            确认接受后双方才能发送消息；也可拒绝。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary min-h-11 px-5 touch-manipulation"
              disabled={acting}
              onClick={() => void accept()}
            >
              接受聊天
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-5 touch-manipulation"
              disabled={acting}
              onClick={() => void reject()}
            >
              拒绝
            </button>
          </div>
        </div>
      ) : null}

      {isRequesterPending ? (
        <div className="mb-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--muted)]">
          已发送私聊请求，等待对方确认接受后即可聊天。
        </div>
      ) : null}

      {conversation.status === CHAT_STATUS.REJECTED ? (
        <div className="mb-3 rounded-2xl border border-[var(--line)] bg-slate-50 px-4 py-3 text-sm text-[var(--muted)]">
          对方已拒绝本次私聊请求。
        </div>
      ) : null}

      <div className="surface flex-1 space-y-3 overflow-y-auto rounded-[24px] p-3 sm:p-4">
        {messages.map((m) => {
          if (m.type === "SYSTEM") {
            return (
              <div
                key={m.id}
                className="px-2 text-center text-xs text-[var(--muted)]"
              >
                {m.body}
              </div>
            );
          }
          const mine = m.senderId === currentUserId;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6 ${
                  mine
                    ? "bg-[var(--brand)] text-white"
                    : "bg-white/90 text-[var(--ink)] ring-1 ring-[var(--line)]"
                }`}
              >
                {!mine ? (
                  <div className="mb-0.5 text-[10px] opacity-70">
                    {m.sender?.name || "用户"}
                  </div>
                ) : null}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="mt-2 text-sm text-[var(--fire)]">{error}</p>
      ) : null}

      <div className="sticky bottom-0 mt-3 flex gap-2 bg-[var(--bg)]/95 py-2 backdrop-blur">
        <input
          className="field min-h-12 flex-1 rounded-full"
          placeholder={canChat ? "输入消息…" : "对方接受后才能发消息"}
          value={text}
          disabled={!canChat || sending}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="button"
          className="btn btn-primary min-h-12 shrink-0 px-5 touch-manipulation"
          disabled={!canChat || sending || !text.trim()}
          onClick={() => void send()}
        >
          发送
        </button>
      </div>
    </div>
  );
}

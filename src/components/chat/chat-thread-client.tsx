"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChatRealtime } from "@/components/chat/use-chat-realtime";
import {
  CHAT_JOIN_STATUS,
  CHAT_KIND,
  CHAT_MEMBER_ROLE,
  CHAT_STATUS,
} from "@andyyyds/shared/chat/constants";

type Msg = {
  id: string;
  senderId: string;
  type: string;
  body: string;
  mediaUrl: string;
  mentionIds?: string[];
  recalled?: boolean;
  recalledAt?: string | null;
  readCount?: number;
  createdAt: string;
  sender?: { id: string; name: string; avatarUrl: string };
};

type Member = {
  id: string;
  name: string;
  avatarUrl: string;
  memberRole: string;
};

type Conversation = {
  id: string;
  kind: string;
  status: string;
  title: string;
  memberRole: string;
  joinStatus?: string;
  announcement?: string;
  members?: Member[];
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
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [noticeDraft, setNoticeDraft] = useState("");
  const [showNoticeEditor, setShowNoticeEditor] = useState(false);
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [recallingId, setRecallingId] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
          body: JSON.stringify({ body, mentionIds }),
        },
      );
      const data = (await res.json()) as { message?: Msg; error?: string };
      if (!res.ok) {
        setError(data.error || "发送失败");
        return;
      }
      setText("");
      setMentionIds([]);
      setShowMentions(false);
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

  async function acceptDirect() {
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

  async function rejectDirect() {
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

  async function acceptGroup() {
    setActing(true);
    setError("");
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/join`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accept" }),
        },
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

  async function rejectGroup() {
    setActing(true);
    setError("");
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/join`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reject" }),
        },
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

  async function deleteLocal(messageId: string) {
    const ok = window.confirm(
      "从你的聊天记录中删除这条消息？对方仍可见。",
    );
    if (!ok) return;
    setDeletingId(messageId);
    setError("");
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/messages/${messageId}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "删除失败");
        return;
      }
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch {
      setError("网络错误");
    } finally {
      setDeletingId("");
    }
  }

  async function recall(messageId: string) {
    const ok = window.confirm("撤回这条消息？双方会话中都将显示为已撤回。");
    if (!ok) return;
    setRecallingId(messageId);
    setError("");
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/messages/${messageId}/recall`,
        { method: "POST" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "撤回失败");
        return;
      }
      await reloadMessages();
    } catch {
      setError("网络错误");
    } finally {
      setRecallingId("");
    }
  }

  async function saveAnnouncement() {
    setActing(true);
    setError("");
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/announcement`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: noticeDraft }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "设置失败");
        return;
      }
      setShowNoticeEditor(false);
      await reloadConversation();
      await reloadMessages();
    } finally {
      setActing(false);
    }
  }

  function addMention(m: Member) {
    if (mentionIds.includes(m.id)) return;
    setMentionIds((prev) => [...prev, m.id]);
    setText((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}@${m.name} `);
    setShowMentions(false);
  }

  const isGroup = conversation.kind === CHAT_KIND.GROUP;
  const canChat =
    (!isGroup && conversation.status === CHAT_STATUS.ACTIVE) ||
    (isGroup &&
      (conversation.joinStatus || CHAT_JOIN_STATUS.ACTIVE) ===
        CHAT_JOIN_STATUS.ACTIVE);
  const isRecipientPending =
    !isGroup &&
    conversation.status === CHAT_STATUS.PENDING &&
    conversation.memberRole === CHAT_MEMBER_ROLE.RECIPIENT;
  const isRequesterPending =
    !isGroup &&
    conversation.status === CHAT_STATUS.PENDING &&
    conversation.memberRole === CHAT_MEMBER_ROLE.REQUESTER;
  const isGroupInvitePending =
    isGroup && conversation.joinStatus === CHAT_JOIN_STATUS.PENDING;
  const canManageGroup =
    isGroup &&
    canChat &&
    (conversation.memberRole === CHAT_MEMBER_ROLE.OWNER ||
      conversation.memberRole === CHAT_MEMBER_ROLE.ADMIN);
  const members = conversation.members || [];

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
          {isGroup && members.length ? (
            <span className="ml-1 text-sm font-normal text-[var(--muted)]">
              ({members.length})
            </span>
          ) : null}
        </h1>
        {canManageGroup ? (
          <button
            type="button"
            className="min-h-11 shrink-0 px-2 text-sm text-[var(--brand)] touch-manipulation"
            onClick={() => {
              setNoticeDraft(conversation.announcement || "");
              setShowNoticeEditor(true);
            }}
          >
            公告
          </button>
        ) : null}
      </div>

      {conversation.announcement ? (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div className="text-xs font-medium text-amber-800">群公告</div>
          <p className="mt-1 whitespace-pre-wrap">{conversation.announcement}</p>
        </div>
      ) : null}

      {isRecipientPending ? (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <p className="font-medium text-amber-900">有人请求与你私聊</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary min-h-11 px-5 touch-manipulation"
              disabled={acting}
              onClick={() => void acceptDirect()}
            >
              接受聊天
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-5 touch-manipulation"
              disabled={acting}
              onClick={() => void rejectDirect()}
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

      {isGroupInvitePending ? (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <p className="font-medium text-amber-900">邀请你加入群聊</p>
          <p className="mt-1 text-amber-800/90">同意后即可在群内发言。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary min-h-11 px-5 touch-manipulation"
              disabled={acting}
              onClick={() => void acceptGroup()}
            >
              同意进群
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-5 touch-manipulation"
              disabled={acting}
              onClick={() => void rejectGroup()}
            >
              拒绝
            </button>
          </div>
        </div>
      ) : null}

      {conversation.status === CHAT_STATUS.REJECTED ? (
        <div className="mb-3 rounded-2xl border border-[var(--line)] bg-slate-50 px-4 py-3 text-sm text-[var(--muted)]">
          对方已拒绝本次私聊请求。
        </div>
      ) : null}

      {showNoticeEditor ? (
        <div className="mb-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
          <div className="text-sm font-medium">编辑群公告</div>
          <textarea
            className="field mt-2 min-h-24 w-full"
            maxLength={1000}
            value={noticeDraft}
            onChange={(e) => setNoticeDraft(e.target.value)}
            placeholder="公告内容，清空则取消公告展示"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="btn btn-primary min-h-11 px-4 touch-manipulation"
              disabled={acting}
              onClick={() => void saveAnnouncement()}
            >
              保存
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-4 touch-manipulation"
              onClick={() => setShowNoticeEditor(false)}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      <div className="surface flex-1 space-y-3 overflow-y-auto rounded-[24px] p-3 sm:p-4">
        {messages.map((m) => {
          if (m.type === "SYSTEM" || m.type === "NOTICE") {
            return (
              <div
                key={m.id}
                className="px-2 text-center text-xs text-[var(--muted)]"
              >
                {m.type === "NOTICE" ? (
                  <span className="font-medium text-amber-800">[公告] </span>
                ) : null}
                <span>{m.body}</span>
                <button
                  type="button"
                  className="ml-2 inline-flex min-h-9 min-w-9 items-center justify-center text-[11px] underline touch-manipulation"
                  disabled={deletingId === m.id}
                  onClick={() => void deleteLocal(m.id)}
                >
                  {deletingId === m.id ? "…" : "删"}
                </button>
              </div>
            );
          }
          if (m.recalled) {
            return (
              <div
                key={m.id}
                className="px-2 text-center text-xs text-[var(--muted)]"
              >
                {m.senderId === currentUserId ? "你" : m.sender?.name || "对方"}
                撤回了一条消息
              </div>
            );
          }
          const mine = m.senderId === currentUserId;
          const canRecall =
            mine ||
            conversation.memberRole === CHAT_MEMBER_ROLE.OWNER ||
            conversation.memberRole === CHAT_MEMBER_ROLE.ADMIN;
          return (
            <div
              key={m.id}
              className={`flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}
            >
              {mine ? (
                <div className="mb-1 flex flex-col gap-1">
                  {canRecall ? (
                    <button
                      type="button"
                      className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full text-[11px] text-[var(--muted)] touch-manipulation"
                      disabled={recallingId === m.id}
                      onClick={() => void recall(m.id)}
                    >
                      {recallingId === m.id ? "…" : "撤"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full text-[11px] text-[var(--muted)] touch-manipulation"
                    disabled={deletingId === m.id}
                    onClick={() => void deleteLocal(m.id)}
                  >
                    {deletingId === m.id ? "…" : "删"}
                  </button>
                </div>
              ) : null}
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-6 ${
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
                {mine && typeof m.readCount === "number" && m.readCount > 0 ? (
                  <div
                    className={`mt-1 text-[10px] ${mine ? "text-white/80" : "text-[var(--muted)]"}`}
                  >
                    {isGroup ? `${m.readCount} 人已读` : "已读"}
                  </div>
                ) : null}
              </div>
              {!mine ? (
                <button
                  type="button"
                  className="mb-1 inline-flex min-h-9 min-w-9 items-center justify-center rounded-full text-[11px] text-[var(--muted)] touch-manipulation"
                  disabled={deletingId === m.id}
                  onClick={() => void deleteLocal(m.id)}
                >
                  {deletingId === m.id ? "…" : "删"}
                </button>
              ) : null}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="mt-2 text-sm text-[var(--fire)]">{error}</p>
      ) : null}

      {isGroup && canChat && showMentions ? (
        <div className="mt-2 max-h-40 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--card)] p-2">
          {members
            .filter((m) => m.id !== currentUserId)
            .map((m) => (
              <button
                key={m.id}
                type="button"
                className="flex min-h-11 w-full items-center px-2 text-left text-sm touch-manipulation active:bg-black/5"
                onClick={() => addMention(m)}
              >
                @{m.name}
              </button>
            ))}
        </div>
      ) : null}

      <div className="sticky bottom-0 mt-3 flex gap-2 bg-[var(--bg)]/95 py-2 backdrop-blur">
        {isGroup && canChat ? (
          <button
            type="button"
            className="btn btn-secondary min-h-12 shrink-0 px-3 touch-manipulation"
            onClick={() => setShowMentions((v) => !v)}
          >
            @
          </button>
        ) : null}
        <input
          className="field min-h-12 flex-1 rounded-full"
          placeholder={canChat ? "输入消息…" : "接受后才能发消息"}
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

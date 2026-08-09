"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChatSource } from "@/lib/chat/constants";

type Props = {
  peerUserId: string;
  source: ChatSource;
  relatedCourseId?: string;
  relatedMeetupId?: string;
  /** 未登录时跳转 */
  loginHref?: string;
  className?: string;
  children?: React.ReactNode;
};

/**
 * 产品/约搭咨询：向发起者发起私聊请求，跳转会话页等待对方确认。
 */
export function StartConsultChatButton({
  peerUserId,
  source,
  relatedCourseId,
  relatedMeetupId,
  loginHref = "/login",
  className,
  children,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          peerUserId,
          source,
          relatedCourseId,
          relatedMeetupId,
        }),
      });
      const data = (await res.json()) as {
        conversationId?: string;
        error?: string;
      };
      if (res.status === 401) {
        const next = encodeURIComponent(
          typeof window !== "undefined" ? window.location.pathname : "/",
        );
        router.push(`${loginHref}?next=${next}`);
        return;
      }
      if (!res.ok || !data.conversationId) {
        setError(data.error || "发起私聊失败");
        return;
      }
      router.push(`/messages/${data.conversationId}`);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        className={
          className ||
          "btn btn-secondary inline-flex min-h-11 w-full items-center justify-center touch-manipulation"
        }
        disabled={loading || !peerUserId}
        onClick={() => void onClick()}
      >
        {loading ? "发起中…" : children || "站内私聊咨询"}
      </button>
      {error ? (
        <p className="mt-1 text-center text-xs text-[var(--fire)]">{error}</p>
      ) : null}
    </div>
  );
}

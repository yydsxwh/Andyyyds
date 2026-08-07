"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HOST_STATUS_ACTIONS, canJoinMeetup } from "@/lib/meetup";

type Props = {
  meetupId: string;
  status: string;
  hostId: string;
  currentUserId: string | null;
  alreadyJoined: boolean;
};

export function MeetupActions({
  meetupId,
  status,
  hostId,
  currentUserId,
  alreadyJoined,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const isHost = Boolean(currentUserId && currentUserId === hostId);
  const loggedIn = Boolean(currentUserId);

  async function join() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/meetup/${meetupId}/join`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "报名失败");
        return;
      }
      router.refresh();
    } catch {
      setMessage("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function leave() {
    if (!confirm("确定取消报名？")) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/meetup/${meetupId}/join`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "取消失败");
        return;
      }
      router.refresh();
    } catch {
      setMessage("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function setHostStatus(next: string) {
    const label =
      HOST_STATUS_ACTIONS.find((a) => a.key === next)?.label || next;
    if (!confirm(`确定「${label}」？`)) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/meetup/${meetupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "操作失败");
        return;
      }
      router.refresh();
    } catch {
      setMessage("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  if (!loggedIn) {
    return (
      <div className="space-y-3">
        <a
          href={`/login?next=${encodeURIComponent(`/meetup/${meetupId}`)}`}
          className="btn btn-primary inline-flex min-h-11 w-full items-center justify-center sm:w-auto"
        >
          登录后报名
        </a>
        <p className="text-sm text-[var(--muted)]">游客可浏览，报名需登录</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!isHost && canJoinMeetup(status) && !alreadyJoined ? (
        <button
          type="button"
          className="btn btn-primary min-h-11 w-full sm:w-auto"
          disabled={loading}
          onClick={() => void join()}
        >
          {loading ? "处理中…" : "加入约搭"}
        </button>
      ) : null}

      {!isHost && alreadyJoined ? (
        <button
          type="button"
          className="btn btn-secondary min-h-11 w-full sm:w-auto"
          disabled={loading || status === "CANCELLED"}
          onClick={() => void leave()}
        >
          {loading ? "处理中…" : "取消报名"}
        </button>
      ) : null}

      {isHost ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--muted)]">发起人管理</p>
          <div className="flex flex-wrap gap-2">
            {HOST_STATUS_ACTIONS.filter((a) => a.key !== status).map((action) => (
              <button
                key={action.key}
                type="button"
                className={`btn min-h-11 ${
                  action.key === "CANCELLED" ? "btn-fire" : "btn-secondary"
                }`}
                disabled={loading}
                onClick={() => void setHostStatus(action.key)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="text-sm text-[var(--fire)]">{message}</p>
      ) : null}
    </div>
  );
}

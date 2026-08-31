"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HOST_STATUS_ACTIONS, canJoinMeetup } from "@/lib/meetup";
import { confirmAndDeleteMeetup } from "@/lib/meetup-delete-client";

type Props = {
  meetupId: string;
  title?: string;
  status: string;
  hostId: string;
  currentUserId: string | null;
  alreadyJoined: boolean;
  /** 报名费（分）；>0 时非发起人应走 PurchasePanel，本组件仅作兜底提示 */
  priceCents?: number;
  /** 站长可在微信内前台详情改他人活动状态，与发起人管理并列 */
  canManageAsAdmin?: boolean;
};

export function MeetupActions({
  meetupId,
  title = "该活动",
  status,
  hostId,
  currentUserId,
  alreadyJoined,
  priceCents = 0,
  canManageAsAdmin = false,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const isHost = Boolean(currentUserId && currentUserId === hostId);
  const canManageStatus = isHost || canManageAsAdmin;
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

  async function removeMeetup() {
    setLoading(true);
    setMessage("");
    try {
      const result = await confirmAndDeleteMeetup({
        meetupId,
        title,
        via: "public",
      });
      if (result.ok) {
        router.push("/meetup");
        router.refresh();
        return;
      }
      if (result.cancelled) {
        if (result.message) setMessage(result.message);
        return;
      }
      setMessage(result.error || "删除失败");
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
        <p className="text-sm text-[var(--muted)]">
          游客可浏览，报名需登录
          {priceCents > 0 ? "；本活动需支付报名费" : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!isHost && canJoinMeetup(status) && !alreadyJoined ? (
        priceCents > 0 ? (
          <p className="text-sm text-[var(--muted)]">
            本活动需支付报名费，请刷新页面后使用「报名并支付」。
          </p>
        ) : (
          <button
            type="button"
            className="btn btn-primary min-h-11 w-full sm:w-auto"
            disabled={loading}
            onClick={() => void join()}
          >
            {loading ? "处理中…" : "加入约搭"}
          </button>
        )
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

      {canManageStatus ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--muted)]">
            {isHost ? "发起人管理" : "站长管理"}
          </p>
          <div className="flex flex-wrap gap-2">
            {HOST_STATUS_ACTIONS.filter((a) => a.key !== status).map((action) => (
              <button
                key={action.key}
                type="button"
                className={`btn ${
                  action.key === "CANCELLED" ? "btn-danger" : "btn-secondary"
                }`}
                disabled={loading}
                onClick={() => void setHostStatus(action.key)}
              >
                {action.label}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-danger"
              disabled={loading}
              onClick={() => void removeMeetup()}
            >
              删除活动
            </button>
          </div>
          {canManageAsAdmin && !isHost ? (
            <a
              href={`/studio/meetup/${meetupId}/edit`}
              className="inline-flex min-h-11 items-center text-sm text-[var(--brand)]"
            >
              进后台编辑详情 →
            </a>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p className="text-sm text-[var(--fire)]">{message}</p>
      ) : null}
    </div>
  );
}

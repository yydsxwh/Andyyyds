"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  universityId: string;
  universitySlug: string;
  universityName: string;
  loggedIn: boolean;
  isMember: boolean;
  isAdminUser: boolean;
  loginNext: string;
  /** 已加入其它高校时提示切换；空表示尚未加入任何学校 */
  otherCampusName?: string;
  /** 站长或后台仍开放成员发帖时为 true */
  allowPost?: boolean;
};

export function ForumJoinBar({
  universityId,
  universitySlug,
  universityName,
  loggedIn,
  isMember,
  isAdminUser,
  loginNext,
  otherCampusName = "",
  allowPost = true,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function join() {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(loginNext)}`);
      return;
    }
    if (
      otherCampusName &&
      !window.confirm(
        `你已加入「${otherCampusName}」。一人同时只能在一所学校发帖，确定切换到${universityName}？`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/forum/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universityId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "加入失败");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (isMember || isAdminUser) {
    if (!allowPost) {
      return (
        <p className="max-w-xs text-sm leading-6 text-[var(--muted)]">
          站长已关闭普通用户发帖，仅站长可发。
        </p>
      );
    }
    return (
      <a
        href={`/forum/${universitySlug}/new`}
        className="btn btn-primary inline-flex min-h-11 items-center justify-center px-5"
      >
        发帖
      </a>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn btn-primary min-h-11 w-full sm:w-auto sm:px-6"
        disabled={busy}
        onClick={() => void join()}
      >
        {loggedIn
          ? `用当前账号加入${universityName}`
          : "用网站账号登录后加入"}
      </button>
      {error ? <p className="text-sm text-[var(--brand)]">{error}</p> : null}
    </div>
  );
}

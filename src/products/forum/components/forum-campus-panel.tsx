"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Uni = { id: string; name: string; slug: string };

type Props = {
  universities: Uni[];
  currentId: string;
  currentName: string;
};

export function ForumCampusPanel({
  universities,
  currentId,
  currentName,
}: Props) {
  const router = useRouter();
  const [universityId, setUniversityId] = useState(currentId);
  const [message, setMessage] = useState(
    currentName
      ? `当前高校分区：${currentName}（与网站账号同号）`
      : "用当前网站账号加入一所高校后才能发帖，不必另注册。",
  );
  const [busy, setBusy] = useState(false);

  async function join() {
    if (!universityId) return;
    if (
      currentId &&
      universityId !== currentId &&
      !window.confirm(
        `你已加入「${currentName}」。一人同时只能在一所学校发帖，确定切换？`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/forum/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universityId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "加入失败");
        return;
      }
      setMessage(`已加入 ${data.name}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (universities.length === 0) {
    return (
      <section className="surface rounded-[28px] p-5">
        <h2 className="text-lg font-semibold">大学论坛</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          站长尚未开放高校分区。
        </p>
      </section>
    );
  }

  return (
    <section className="surface rounded-[28px] p-5">
      <h2 className="text-lg font-semibold">大学论坛</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{message}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select
          className="min-h-11 flex-1 rounded-2xl border border-[var(--line)] bg-transparent px-3"
          value={universityId}
          onChange={(e) => setUniversityId(e.target.value)}
        >
          <option value="">选择高校分区</option>
          {universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-primary min-h-11 px-5"
          disabled={busy || !universityId}
          onClick={() => void join()}
        >
          {currentId ? "切换分区" : "加入分区"}
        </button>
        {currentId ? (
          <a
            className="btn btn-secondary inline-flex min-h-11 items-center justify-center px-5"
            href={`/forum/${universities.find((u) => u.id === currentId)?.slug || ""}`}
          >
            进入论坛
          </a>
        ) : null}
        <a
          className="btn btn-secondary inline-flex min-h-11 items-center justify-center px-5"
          href="/forum/mine"
        >
          我的帖子
        </a>
        {currentId ? null : (
          <a
            className="btn btn-secondary inline-flex min-h-11 items-center justify-center px-5"
            href="/forum"
          >
            逛论坛
          </a>
        )}
      </div>
    </section>
  );
}

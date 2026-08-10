"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type UserHit = {
  id: string;
  name: string;
  avatarUrl: string;
};

/** 像微信一样选人建群：对方同意后才能进群聊天 */
export function CreateGroupForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<UserHit[]>([]);
  const [selected, setSelected] = useState<UserHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = q.trim();
    if (query.length < 1) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        const res = await fetch(
          `/api/chat/users/search?q=${encodeURIComponent(query)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { users?: UserHit[] };
        setHits(data.users || []);
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  function toggle(u: UserHit) {
    setSelected((prev) => {
      if (prev.some((x) => x.id === u.id)) {
        return prev.filter((x) => x.id !== u.id);
      }
      return [...prev, u];
    });
  }

  async function submit() {
    setError("");
    if (!title.trim()) {
      setError("请填写群名称");
      return;
    }
    if (selected.length < 1) {
      setError("请至少选择一位成员");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/chat/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          inviteeIds: selected.map((u) => u.id),
        }),
      });
      const data = (await res.json()) as {
        conversationId?: string;
        error?: string;
      };
      if (!res.ok || !data.conversationId) {
        setError(data.error || "创建失败");
        return;
      }
      router.push(`/messages/${data.conversationId}`);
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">群名称</label>
        <input
          className="field mt-1 min-h-11 w-full"
          maxLength={40}
          placeholder="例如：周末徒步小队"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <label className="text-sm font-medium">邀请成员</label>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          搜索昵称勾选；对方同意后才能进群聊天
        </p>
        <input
          className="field mt-2 min-h-11 w-full rounded-full"
          placeholder="搜索用户昵称"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((u) => (
            <button
              key={u.id}
              type="button"
              className="inline-flex min-h-9 items-center rounded-full bg-[var(--brand)]/15 px-3 text-sm text-[var(--brand-strong)] touch-manipulation"
              onClick={() => toggle(u)}
            >
              {u.name} ×
            </button>
          ))}
        </div>
      ) : null}

      <ul className="space-y-2">
        {hits.map((u) => {
          const on = selected.some((x) => x.id === u.id);
          return (
            <li key={u.id}>
              <button
                type="button"
                className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left touch-manipulation ${
                  on
                    ? "border-[var(--brand)] bg-[var(--brand)]/10"
                    : "border-[var(--line)] bg-[var(--card)]"
                }`}
                onClick={() => toggle(u)}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)]/15 text-sm">
                  {(u.name || "?").slice(0, 1)}
                </span>
                <span className="flex-1 truncate font-medium">{u.name}</span>
                <span className="text-xs text-[var(--muted)]">
                  {on ? "已选" : "选择"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {error ? <p className="text-sm text-[var(--fire)]">{error}</p> : null}

      <button
        type="button"
        className="btn btn-primary min-h-12 w-full touch-manipulation"
        disabled={loading}
        onClick={() => void submit()}
      >
        {loading ? "创建中…" : "创建群聊"}
      </button>
    </div>
  );
}

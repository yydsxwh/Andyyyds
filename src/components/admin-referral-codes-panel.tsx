"use client";

/**
 * 站长在分销管理中批量查看 / 修改每位用户的邀请码，并看到上级邀请人。
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";
import { ROLE_LABEL, type Role } from "@andyyyds/shared/roles";

export type ReferralAdminRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  referralCode: string;
  referredByName: string;
  referredByCode: string;
};

type Props = {
  initialUsers: ReferralAdminRow[];
};

export function AdminReferralCodesPanel({ initialUsers }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [feedbackId, setFeedbackId] = useState("");
  const [feedback, setFeedback] = useState<SaveStatus>(null);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(keyword) ||
        u.email.toLowerCase().includes(keyword) ||
        u.referralCode.toLowerCase().includes(keyword) ||
        u.referredByName.toLowerCase().includes(keyword) ||
        u.referredByCode.toLowerCase().includes(keyword),
    );
  }, [users, q]);

  async function save(userId: string) {
    const prev = users.find((u) => u.id === userId);
    if (!prev) return;
    const next = (draft[userId] ?? prev.referralCode).trim();
    setBusyId(userId);
    setFeedbackId(userId);
    setFeedback(null);
    const result = await postSave("/api/studio/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, referralCode: next }),
    });
    setBusyId("");
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "保存失败" });
      return;
    }
    const user = result.data.user as { referralCode?: string } | undefined;
    const code = user?.referralCode || next.toUpperCase();
    setUsers((list) =>
      list.map((u) => (u.id === userId ? { ...u, referralCode: code } : u)),
    );
    setDraft((d) => {
      const copy = { ...d };
      delete copy[userId];
      return copy;
    });
    const msg =
      typeof result.data.message === "string"
        ? result.data.message
        : "邀请码已保存成功";
    setFeedback({ kind: "ok", text: msg });
    router.refresh();
  }

  function RowFeedback({ userId }: { userId: string }) {
    if (feedbackId !== userId) return null;
    return <SaveFeedback status={feedback} />;
  }

  return (
    <section className="surface space-y-4 rounded-[28px] p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">全员邀请码管理</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          站长可设置每位用户（含自己）的邀请码；「邀请人」用于核对业绩分成归属。
        </p>
      </div>
      <input
        className="field w-full"
        placeholder="搜索姓名 / 邮箱 / 邀请码 / 邀请人"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="space-y-3 md:hidden">
        {filtered.map((user) => (
          <div key={user.id} className="rounded-2xl border border-[var(--line)] p-4">
            <div className="font-medium">{user.name}</div>
            <div className="text-xs text-[var(--muted)]">{user.email}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              {ROLE_LABEL[user.role as Role] || user.role}
              {" · "}
              邀请人：
              {user.referredByName
                ? `${user.referredByName}（${user.referredByCode}）`
                : "无"}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                className="field min-h-10 min-w-[8rem] flex-1 py-2 text-sm uppercase"
                value={draft[user.id] ?? user.referralCode}
                maxLength={16}
                disabled={busyId === user.id}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [user.id]: e.target.value }))
                }
              />
              <button
                type="button"
                className="btn btn-secondary min-h-10 px-3 text-sm"
                disabled={busyId === user.id}
                onClick={() => void save(user.id)}
              >
                {busyId === user.id ? "…" : "保存"}
              </button>
              <RowFeedback userId={user.id} />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-[var(--muted)]">
            <tr>
              <th className="py-2 pr-3 font-medium">用户</th>
              <th className="py-2 pr-3 font-medium">角色</th>
              <th className="py-2 pr-3 font-medium">邀请人</th>
              <th className="py-2 font-medium">邀请码</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-b border-[var(--line)] last:border-0">
                <td className="py-3 pr-3">
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs text-[var(--muted)]">{user.email}</div>
                </td>
                <td className="py-3 pr-3">
                  {ROLE_LABEL[user.role as Role] || user.role}
                </td>
                <td className="py-3 pr-3 text-[var(--muted)]">
                  {user.referredByName ? (
                    <>
                      {user.referredByName}
                      <div className="text-xs">{user.referredByCode}</div>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className="field min-h-9 w-36 py-1.5 text-xs uppercase"
                      value={draft[user.id] ?? user.referralCode}
                      maxLength={16}
                      disabled={busyId === user.id}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [user.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-secondary min-h-9 px-2.5 text-xs"
                      disabled={busyId === user.id}
                      onClick={() => void save(user.id)}
                    >
                      {busyId === user.id ? "…" : "保存"}
                    </button>
                    <RowFeedback userId={user.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

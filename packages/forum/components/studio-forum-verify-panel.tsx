"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FORUM_DEGREE_LABEL,
  FORUM_VERIFY_STATUS_LABEL,
  type ForumDegreeLevel,
  type ForumVerifyStatus,
} from "@andyyyds/forum/lib/forum-school";

export type StudioForumVerification = {
  id: string;
  degreeLevel: string;
  realName: string;
  studentId: string;
  campusEmail: string;
  proofUrl: string;
  status: string;
  reviewNote: string;
  createdAt: string | Date;
  user: { id: string; name: string; email: string };
  university: { id: string; name: string; slug: string };
};

export function StudioForumVerifyPanel({
  initialRows,
}: {
  initialRows: StudioForumVerification[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function review(id: string, status: "VERIFIED" | "REJECTED") {
    setBusy(id);
    setMessage("");
    try {
      const res = await fetch(`/api/studio/forum/verifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reviewNote: notes[id] || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "审核失败");
        return;
      }
      setRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, ...data.verification } : row)),
      );
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">学校实名认证审核</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          校园邮箱命中该校后缀的会自动通过。其余待审记录在此处理。每人限一所本科、一所研究生。
        </p>
      </div>
      {message ? <p className="text-sm text-[var(--brand)]">{message}</p> : null}
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">暂时没有认证记录。</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const degree = FORUM_DEGREE_LABEL[row.degreeLevel as ForumDegreeLevel] || row.degreeLevel;
            const status =
              FORUM_VERIFY_STATUS_LABEL[row.status as ForumVerifyStatus] || row.status;
            return (
              <li
                key={row.id}
                className="rounded-2xl border border-[var(--line)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {row.realName} · {row.university.name} · {degree}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {row.user.name} · {row.user.email} · 学号 {row.studentId}
                      {row.campusEmail ? ` · ${row.campusEmail}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">状态：{status}</p>
                    {row.reviewNote ? (
                      <p className="mt-1 text-xs text-[var(--brand)]">{row.reviewNote}</p>
                    ) : null}
                  </div>
                  {row.proofUrl ? (
                    <a
                      className="text-sm text-[var(--brand)]"
                      href={row.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      证明材料
                    </a>
                  ) : null}
                </div>
                {row.status === "PENDING" ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      className="min-h-11 flex-1 rounded-2xl border border-[var(--line)] bg-transparent px-3 text-sm"
                      placeholder="驳回原因（可选）"
                      value={notes[row.id] || ""}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-primary min-h-11 px-5"
                      disabled={busy === row.id}
                      onClick={() => void review(row.id, "VERIFIED")}
                    >
                      通过
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary min-h-11 px-5"
                      disabled={busy === row.id}
                      onClick={() => void review(row.id, "REJECTED")}
                    >
                      驳回
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

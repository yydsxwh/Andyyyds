"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  postId: string;
  universitySlug: string;
  status: string;
  canManage: boolean;
};

/** 作者可隐藏/删除自己的帖；站长同样可操作。 */
export function ForumPostManage({
  postId,
  universitySlug,
  status,
  canManage,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  if (!canManage) return null;

  async function patchStatus(next: "PUBLISHED" | "HIDDEN") {
    setBusy(next);
    setError("");
    try {
      const res = await fetch(`/api/forum/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "操作失败");
        return;
      }
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!window.confirm("删除后不可恢复，确定删除这篇内容？")) return;
    setBusy("delete");
    setError("");
    try {
      const res = await fetch(`/api/forum/posts/${postId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "删除失败");
        return;
      }
      router.push(`/forum/${universitySlug}`);
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "PUBLISHED" ? (
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-4 text-sm"
          disabled={Boolean(busy)}
          onClick={() => void patchStatus("HIDDEN")}
        >
          {busy === "HIDDEN" ? "处理中…" : "隐藏"}
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-4 text-sm"
          disabled={Boolean(busy)}
          onClick={() => void patchStatus("PUBLISHED")}
        >
          {busy === "PUBLISHED" ? "处理中…" : "重新公开"}
        </button>
      )}
      <button
        type="button"
        className="btn btn-secondary min-h-11 px-4 text-sm text-red-600"
        disabled={Boolean(busy)}
        onClick={() => void remove()}
      >
        {busy === "delete" ? "删除中…" : "删除"}
      </button>
      {error ? <p className="w-full text-sm text-[var(--brand)]">{error}</p> : null}
    </div>
  );
}

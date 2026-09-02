"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FORUM_DEGREE_LABEL,
  FORUM_VERIFY_STATUS_LABEL,
  type ForumDegreeLevel,
  type ForumVerifyStatus,
} from "@andyyyds/forum/lib/forum-school";
function proofApiPath(
  id: string,
  mode: "preview" | "download" | "meta",
) {
  return `/api/studio/forum/verifications/${id}/proof?mode=${mode}`;
}

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
          点「查看图片」在页内预览学生证，不会直接下载；灯箱里另有下载。每人限一所本科、一所研究生。
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
                  <ProofPreviewButton
                    verificationId={row.id}
                    hasProof={Boolean(row.proofUrl)}
                  />
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

type ProofMeta = {
  exists: boolean;
  location: "local" | "oss" | "external" | "missing";
  storedOnOss: boolean;
};

const PROOF_LOCATION_LABEL: Record<ProofMeta["location"], string> = {
  oss: "文件在阿里云 OSS",
  local: "文件在服务器本地 uploads",
  external: "外链图片",
  missing: "存储里找不到这张图",
};

function ProofPreviewButton({
  verificationId,
  hasProof,
}: {
  verificationId: string;
  hasProof: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!hasProof) {
    return <span className="text-xs text-[var(--muted)]">未上传学生证</span>;
  }
  return (
    <>
      <button
        type="button"
        className="min-h-11 shrink-0 rounded-2xl border border-[var(--line)] px-4 text-sm text-[var(--brand)] touch-manipulation"
        onClick={() => setOpen(true)}
      >
        查看图片
      </button>
      {open ? (
        <ProofImageLightbox
          verificationId={verificationId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ProofImageLightbox({
  verificationId,
  onClose,
}: {
  verificationId: string;
  onClose: () => void;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previewUrl = proofApiPath(verificationId, "preview");
  const downloadUrl = proofApiPath(verificationId, "download");
  const [meta, setMeta] = useState<ProofMeta | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch(proofApiPath(verificationId, "meta"))
      .then(async (res) => {
        const data = (await res.json()) as ProofMeta & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data.error || "无法读取存储信息");
          return;
        }
        setMeta(data);
        if (!data.exists) setLoadError("存储里找不到这张认证照片");
      })
      .catch(() => {
        if (!cancelled) setLoadError("无法探测认证照片是否还在");
      });
    return () => {
      cancelled = true;
    };
  }, [verificationId]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/92"
      role="dialog"
      aria-modal="true"
      aria-label="查看认证图片"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <a
          className="inline-flex min-h-11 items-center rounded-full bg-white/15 px-4 text-sm font-semibold text-white touch-manipulation"
          href={downloadUrl}
        >
          下载
        </a>
        <button
          ref={closeBtnRef}
          type="button"
          className="min-h-11 min-w-11 rounded-full px-4 text-sm font-semibold text-white touch-manipulation"
          onClick={onClose}
        >
          关闭
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {loadError ? (
          <p className="max-w-md text-center text-sm text-white/85">{loadError}</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="学生证"
            className="max-h-[min(80vh,40rem)] w-auto max-w-full object-contain"
            onError={() => setLoadError("预览失败：文件不存在或链接无法显示")}
          />
        )}
        {meta ? (
          <p className="mt-3 max-w-md text-center text-xs leading-5 text-white/70">
            {PROOF_LOCATION_LABEL[meta.location]}
            {meta.storedOnOss ? " · 入库地址指向当前 OSS Bucket" : ""}
            。预览用 inline，下载才带 attachment。
          </p>
        ) : null}
      </div>
    </div>
  );
}

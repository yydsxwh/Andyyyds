"use client";

/**
 * 课时「课件资料」管理：须先保存课时拿到 id 后再上传。
 * 触控友好：大按钮、全宽列表，适配微信内工作室。
 */

import { useCallback, useEffect, useState } from "react";
import { formatBytes } from "@andyyyds/shared/media";
import type { LessonResourceListItem } from "@andyyyds/courses/lib/lesson-resources";

type Props = {
  courseId: string;
  lessonId?: string;
};

export function LessonResourcesEditor({ courseId, lessonId }: Props) {
  const [resources, setResources] = useState<LessonResourceListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/studio/courses/${courseId}/lessons/${lessonId}/resources`,
        { cache: "no-store" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        resources?: LessonResourceListItem[];
      };
      if (!res.ok) {
        setError(data.error || "加载课件失败");
        return;
      }
      setResources(data.resources || []);
    } catch {
      setError("加载课件失败");
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload(file: File | null) {
    if (!lessonId || !file) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("title", file.name.replace(/\.[^.]+$/, "") || file.name);
      const res = await fetch(
        `/api/studio/courses/${courseId}/lessons/${lessonId}/resources`,
        { method: "POST", body: form },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        resource?: LessonResourceListItem;
      };
      if (!res.ok) {
        setError(data.error || "上传失败");
        return;
      }
      if (data.resource) {
        setResources((prev) => [...prev, data.resource!]);
      }
      setMessage("课件已上传");
    } catch {
      setError("上传失败，请检查网络后重试");
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(resourceId: string) {
    if (!confirm("确定删除该课件？学员将无法再下载。")) return;
    setError("");
    try {
      const res = await fetch(
        `/api/studio/courses/${courseId}/resources/${resourceId}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "删除失败");
        return;
      }
      setResources((prev) => prev.filter((r) => r.id !== resourceId));
      setMessage("已删除");
    } catch {
      setError("删除失败");
    }
  }

  if (!lessonId) {
    return (
      <p className="mt-2 rounded-xl border border-dashed border-[var(--line)] px-3 py-2 text-xs text-[var(--muted)]">
        请先保存章节/课时，再为此课上传课件资料。
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-[var(--line)] bg-white/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-[var(--ink)]">课件资料</div>
          <p className="text-[11px] text-[var(--muted)]">
            讲义 / PDF 等，学员报名后可下载；下载会记入学习进度。
          </p>
        </div>
        <label className="btn btn-secondary min-h-10 cursor-pointer px-3 text-xs">
          {uploading ? "上传中…" : "上传文件"}
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              e.target.value = "";
              void onUpload(f);
            }}
          />
        </label>
      </div>

      {loading ? (
        <p className="text-xs text-[var(--muted)]">加载中…</p>
      ) : resources.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">暂无课件</p>
      ) : (
        <ul className="space-y-2">
          {resources.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-2.5 py-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.title}</div>
                <div className="text-[var(--muted)]">
                  {r.fileName}
                  {r.sizeBytes > 0 ? ` · ${formatBytes(r.sizeBytes)}` : ""}
                </div>
              </div>
              <button
                type="button"
                className="min-h-9 shrink-0 rounded-full border border-red-200 px-3 text-red-700"
                onClick={() => void onDelete(r.id)}
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p className="text-xs text-[var(--fire-strong)]">{error}</p>
      ) : null}
      {message && !error ? (
        <p className="text-xs text-[var(--brand)]">{message}</p>
      ) : null}
    </div>
  );
}

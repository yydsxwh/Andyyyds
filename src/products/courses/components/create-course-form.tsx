"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUrlField } from "@/components/image-url-field";
import { DEFAULT_COURSE_COVER_URL } from "@/lib/cover-images";

export function CreateCourseForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [coverUrl, setCoverUrl] = useState(DEFAULT_COURSE_COVER_URL);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const payload = {
      ...Object.fromEntries(form.entries()),
      coverUrl: coverUrl.trim(),
    };
    const res = await fetch("/api/studio/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "创建失败");
      return;
    }
    router.refresh();
    e.currentTarget.reset();
    setCoverUrl(DEFAULT_COURSE_COVER_URL);
  }

  return (
    <form onSubmit={onSubmit} className="surface space-y-3 rounded-[28px] p-6">
      <h2 className="text-lg font-semibold">快速上架一门课</h2>
      <input className="field" name="title" placeholder="课程标题" required />
      <input className="field" name="subtitle" placeholder="一句话卖点" />
      <textarea
        className="field min-h-28"
        name="description"
        placeholder="课程介绍"
        required
      />
      <input
        className="field"
        name="price"
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        placeholder="价格（元，可到分）"
        defaultValue={99}
      />
      <ImageUrlField
        label="封面图"
        value={coverUrl}
        onChange={setCoverUrl}
        showPresets
      />
      {/* 随表单提交；实际值由 state 写入 payload */}
      <input type="hidden" name="coverUrl" value={coverUrl} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="publish" value="1" defaultChecked />
        立即发布
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button className="btn btn-primary" disabled={loading} type="submit">
        {loading ? "创建中..." : "创建课程"}
      </button>
    </form>
  );
}

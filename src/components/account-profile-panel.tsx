"use client";

/**
 * 个人中心：修改昵称与头像。
 * 头像走 /api/account/avatar；保存成功后刷新，顶栏同步显示。
 */

import { useRef, useState } from "react";
import { UserAvatar } from "@/components/user-avatar";

type Props = {
  initialName: string;
  /** 已签名、可直接展示的头像 URL */
  initialAvatarDisplayUrl?: string;
};

export function AccountProfilePanel({
  initialName,
  initialAvatarDisplayUrl = "",
}: Props) {
  const [name, setName] = useState(initialName);
  const [avatarDisplay, setAvatarDisplay] = useState(initialAvatarDisplayUrl);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    const next = name.trim();
    if (!next) {
      setError("请填写昵称");
      return;
    }
    if (next === initialName.trim()) {
      setNotice("昵称未改变");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "保存失败");
      return;
    }
    setNotice("昵称已更新");
    window.location.reload();
  }

  async function onPickAvatar(file: File | null) {
    if (!file) return;
    setError("");
    setNotice("");
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/account/avatar", {
      method: "POST",
      body,
    });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setError(data.error || "头像上传失败");
      return;
    }
    if (typeof data.displayUrl === "string" && data.displayUrl) {
      setAvatarDisplay(data.displayUrl);
    }
    setNotice("头像已更新");
    // 刷新顶栏等服务端组件
    window.location.reload();
  }

  return (
    <section className="surface rounded-[28px] p-5 sm:p-6">
      <h2 className="text-lg font-semibold">个人资料</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        设置头像与昵称；保存后顶栏右上角会同步显示，点击头像可回到本页。
      </p>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
        <UserAvatar
          name={name || initialName}
          src={avatarDisplay || null}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[var(--muted)]">
            支持 png / jpg / webp / gif，不超过 5MB。
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              void onPickAvatar(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="btn btn-secondary mt-3 min-h-11 w-full sm:w-auto"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "上传中…" : avatarDisplay ? "更换头像" : "上传头像"}
          </button>
        </div>
      </div>

      <form
        onSubmit={saveName}
        className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <label className="block min-w-0 flex-1 text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">昵称</span>
          <input
            className="field w-full text-base"
            value={name}
            maxLength={40}
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入昵称"
          />
        </label>
        <button
          type="submit"
          className="btn btn-primary min-h-11 w-full shrink-0 sm:w-auto sm:px-6"
          disabled={loading}
        >
          {loading ? "保存中…" : "保存昵称"}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="mt-2 text-sm text-[var(--brand)]">{notice}</p> : null}
    </section>
  );
}

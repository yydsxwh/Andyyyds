"use client";

/**
 * 单个论坛分区的设置页：资料、广告栏、两级话题专区。
 * 列表页不再展开这块，避免几十所学校把一页撑满。
 */

import { useState } from "react";
import { StudioForumZoneEditor } from "@andyyyds/forum/components/studio-forum-zone-editor";
import type {
  StudioForumUniversity,
  StudioForumZone,
} from "@andyyyds/forum/components/studio-forum-panel";
import {
  FORUM_DESC_MAX,
  FORUM_NAME_MAX,
  FORUM_SLOGAN_MAX,
} from "@andyyyds/forum/lib/forum";
import { parseForumSpaceKind } from "@andyyyds/forum/lib/forum-space";

async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  const res = await fetch("/api/upload/image", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "上传失败");
  return data.url as string;
}

type Props = {
  uni: StudioForumUniversity;
  busy: boolean;
  onPatch: (id: string, payload: Record<string, unknown>) => Promise<boolean>;
  onZonesChange: (zones: StudioForumZone[]) => void;
};

export function StudioForumSpaceEditor({
  uni,
  busy,
  onPatch,
  onZonesChange,
}: Props) {
  const campus = parseForumSpaceKind(uni.kind) === "UNIVERSITY";
  const [name, setName] = useState(uni.name);
  const [slug, setSlug] = useState(uni.slug);
  const [slogan, setSlogan] = useState(uni.slogan);
  const [description, setDescription] = useState(uni.description);
  const [adHref, setAdHref] = useState(uni.adHref);
  const [adAlt, setAdAlt] = useState(uni.adAlt);
  const [adImageUrl, setAdImageUrl] = useState(uni.adImageUrl);
  const [emailDomains, setEmailDomains] = useState(uni.emailDomains);
  const [profileMessage, setProfileMessage] = useState("");
  const [adMessage, setAdMessage] = useState("");
  const [adUploading, setAdUploading] = useState(false);

  async function saveProfile() {
    setProfileMessage("");
    const ok = await onPatch(uni.id, {
      name,
      slug,
      slogan,
      description,
      ...(campus ? { emailDomains } : {}),
    });
    if (ok) setProfileMessage("已保存分区资料。");
  }

  async function saveAd() {
    setAdMessage("");
    const ok = await onPatch(uni.id, {
      adHref,
      adAlt,
      adImageUrl,
    });
    if (ok) setAdMessage("已保存广告栏。");
  }

  async function pickAdImage(file: File | undefined) {
    if (!file) return;
    setAdMessage("");
    setAdUploading(true);
    try {
      const url = await uploadImage(file);
      setAdImageUrl(url);
    } catch (error) {
      setAdMessage(error instanceof Error ? error.message : "广告图上传失败");
    } finally {
      setAdUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">分区资料</h2>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">
            {campus ? "学校名称" : "分区名称"}
          </span>
          <input
            className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
            value={name}
            maxLength={FORUM_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">路径</span>
          <input
            className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
            value={slug}
            maxLength={40}
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">介绍</span>
          <textarea
            className="mt-1 min-h-24 w-full rounded-2xl border border-[var(--line)] bg-transparent px-3 py-2"
            value={description}
            maxLength={FORUM_DESC_MAX}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">口号</span>
          <input
            className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
            value={slogan}
            maxLength={FORUM_SLOGAN_MAX}
            onChange={(e) => setSlogan(e.target.value)}
          />
        </label>
        {campus ? (
          <label className="block text-sm">
            <span className="text-[var(--muted)]">
              本校邮箱后缀（可选；命中则认证当场通过）
            </span>
            <input
              className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
              value={emailDomains}
              onChange={(e) => setEmailDomains(e.target.value)}
            />
          </label>
        ) : null}
        {profileMessage ? (
          <p className="text-sm text-[var(--brand)]">{profileMessage}</p>
        ) : null}
        <button
          type="button"
          className="btn btn-primary min-h-11 px-5"
          disabled={busy || name.trim().length < 2}
          onClick={() => void saveProfile()}
        >
          {busy ? "保存中…" : "保存资料"}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">广告栏</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          只影响该分区页顶部广告。改这里不会动开关或全站公告栏。上传新图后请点「保存广告栏」才会发布。
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">广告跳转链接</span>
            <input
              className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
              value={adHref}
              onChange={(e) => setAdHref(e.target.value)}
              placeholder="https://"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">广告说明</span>
            <input
              className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
              value={adAlt}
              onChange={(e) => setAdAlt(e.target.value)}
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">广告图</span>
          <input
            className="mt-1 block w-full text-sm"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void pickAdImage(file);
            }}
          />
          {adImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={adImageUrl}
              alt={adAlt || "广告预览"}
              className="mt-2 max-h-28 rounded-2xl object-cover"
            />
          ) : (
            <p className="mt-1 text-xs text-[var(--muted)]">
              未上传时前台显示广告栏占位。
            </p>
          )}
        </label>
        {adImageUrl ? (
          <button
            type="button"
            className="btn btn-secondary min-h-11 px-4 text-sm"
            disabled={busy || adUploading}
            onClick={() => setAdImageUrl("")}
          >
            清除广告图
          </button>
        ) : null}
        {adUploading ? (
          <p className="text-sm text-[var(--muted)]">广告图上传中…</p>
        ) : null}
        {adMessage ? (
          <p className="text-sm text-[var(--brand)]">{adMessage}</p>
        ) : null}
        <button
          type="button"
          className="btn btn-primary min-h-11 px-5"
          disabled={busy || adUploading}
          onClick={() => void saveAd()}
        >
          {busy ? "保存中…" : "保存广告栏"}
        </button>
      </section>

      <StudioForumZoneEditor
        zones={uni.zones}
        disabled={busy}
        onZonesChange={onZonesChange}
        onAdd={async (zoneName, parentId) =>
          onPatch(uni.id, { addZone: { name: zoneName, parentId } })
        }
      />
    </div>
  );
}

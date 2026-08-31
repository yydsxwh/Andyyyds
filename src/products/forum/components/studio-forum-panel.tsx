"use client";

/**
 * 站长大学论坛：创建高校分区、广告栏、专区。
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export type StudioForumZone = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
};

export type StudioForumUniversity = {
  id: string;
  name: string;
  slug: string;
  slogan: string;
  description: string;
  logoUrl: string;
  adImageUrl: string;
  adHref: string;
  adAlt: string;
  emailDomains: string;
  enabled: boolean;
  sortOrder: number;
  zones: StudioForumZone[];
  _count: { members: number; posts: number; zones: number };
};

type Props = { initialUniversities: StudioForumUniversity[] };

async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  const res = await fetch("/api/upload/image", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "上传失败");
  return data.url as string;
}

export function StudioForumPanel({ initialUniversities }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialUniversities);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slogan, setSlogan] = useState("");
  const [emailDomains, setEmailDomains] = useState("");
  const [openId, setOpenId] = useState("");

  async function createUniversity(event: React.FormEvent) {
    event.preventDefault();
    setBusy("create");
    setMessage("");
    try {
      const res = await fetch("/api/studio/forum/universities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, slogan, emailDomains }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "创建失败");
        return;
      }
      setRows((prev) => [data.university, ...prev]);
      setName("");
      setSlug("");
      setSlogan("");
      setEmailDomains("");
      setOpenId(data.university.id);
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  async function patchUniversity(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    setBusy(id);
    setMessage("");
    try {
      const res = await fetch(`/api/studio/forum/universities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "保存失败");
        return false;
      }
      setRows((prev) =>
        prev.map((row) => (row.id === id ? data.university : row)),
      );
      return true;
    } finally {
      setBusy("");
    }
  }

  async function removeUniversity(id: string, uniName: string) {
    if (!window.confirm(`删除「${uniName}」？分区内帖子和笔记会一并删除。`)) {
      return;
    }
    setBusy(id);
    setMessage("");
    try {
      const res = await fetch(`/api/studio/forum/universities/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "删除失败");
        return;
      }
      setRows((prev) => prev.filter((row) => row.id !== id));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-8">
      <form className="space-y-3" onSubmit={(e) => void createUniversity(e)}>
        <h2 className="text-lg font-semibold">新建高校分区</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">学校名称</span>
            <input
              className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={40}
              placeholder="如 北京大学"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">路径（可选英文）</span>
            <input
              className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              maxLength={40}
              placeholder="pku"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-[var(--muted)]">一句话介绍</span>
            <input
              className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              maxLength={80}
              placeholder="同学交流、选课、二手、跑腿…"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-[var(--muted)]">
              限制本校邮箱（可选）。留空则任意网站账号（微信 / 登录名 / 手机 / 邮箱）都可加入发帖，论坛不另开号。
            </span>
            <input
              className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
              value={emailDomains}
              onChange={(e) => setEmailDomains(e.target.value)}
              placeholder="stu.pku.edu.cn, pku.edu.cn"
            />
          </label>
        </div>
        <button
          className="btn btn-primary min-h-11 px-5"
          type="submit"
          disabled={busy === "create" || name.trim().length < 2}
        >
          {busy === "create" ? "创建中…" : "创建分区"}
        </button>
      </form>

      {message ? (
        <p className="text-sm text-[var(--brand)]">{message}</p>
      ) : null}

      <div className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">还没有高校分区。</p>
        ) : null}
        {rows.map((uni) => {
          const open = openId === uni.id;
          return (
            <article
              key={uni.id}
              className="rounded-[24px] border border-[var(--line)] p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{uni.name}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    /forum/{uni.slug} · {uni._count.members} 人 ·{" "}
                    {uni._count.posts} 帖 · {uni.enabled ? "展示中" : "已关闭"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    className="btn btn-secondary min-h-11 px-4 text-sm"
                    href={`/forum/${uni.slug}`}
                  >
                    打开前台
                  </a>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-11 px-4 text-sm"
                    onClick={() => setOpenId(open ? "" : uni.id)}
                  >
                    {open ? "收起" : "编辑"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-11 px-4 text-sm"
                    disabled={busy === uni.id}
                    onClick={() =>
                      void patchUniversity(uni.id, { enabled: !uni.enabled })
                    }
                  >
                    {uni.enabled ? "关闭" : "开启"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-11 px-4 text-sm text-red-600"
                    disabled={busy === uni.id}
                    onClick={() => void removeUniversity(uni.id, uni.name)}
                  >
                    删除
                  </button>
                </div>
              </div>

              {open ? (
                <UniversityEditor
                  key={uni.id}
                  uni={uni}
                  busy={busy === uni.id}
                  onPatch={patchUniversity}
                  onToggleZone={async (zoneId, enabled) => {
                    const res = await fetch(`/api/studio/forum/zones/${zoneId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ enabled }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      setMessage(data.error || "专区更新失败");
                      return;
                    }
                    setRows((prev) =>
                      prev.map((row) =>
                        row.id !== uni.id
                          ? row
                          : {
                              ...row,
                              zones: row.zones.map((z) =>
                                z.id === zoneId ? { ...z, enabled } : z,
                              ),
                            },
                      ),
                    );
                  }}
                />
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function UniversityEditor({
  uni,
  busy,
  onPatch,
  onToggleZone,
}: {
  uni: StudioForumUniversity;
  busy: boolean;
  onPatch: (id: string, payload: Record<string, unknown>) => Promise<boolean>;
  onToggleZone: (zoneId: string, enabled: boolean) => Promise<void>;
}) {
  const [slogan, setSlogan] = useState(uni.slogan);
  const [description, setDescription] = useState(uni.description);
  const [adHref, setAdHref] = useState(uni.adHref);
  const [adAlt, setAdAlt] = useState(uni.adAlt);
  const [adImageUrl, setAdImageUrl] = useState(uni.adImageUrl);
  const [emailDomains, setEmailDomains] = useState(uni.emailDomains);
  const [zoneName, setZoneName] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [adMessage, setAdMessage] = useState("");
  const [adUploading, setAdUploading] = useState(false);

  async function saveProfile() {
    setProfileMessage("");
    const ok = await onPatch(uni.id, {
      slogan,
      description,
      emailDomains,
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
    <div className="mt-4 space-y-6 border-t border-[var(--line)] pt-4">
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">分区资料</h4>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">介绍</span>
          <textarea
            className="mt-1 min-h-24 w-full rounded-2xl border border-[var(--line)] bg-transparent px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">口号</span>
          <input
            className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
            value={slogan}
            onChange={(e) => setSlogan(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">本校邮箱后缀（可选限制，不影响账号体系）</span>
          <input
            className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
            value={emailDomains}
            onChange={(e) => setEmailDomains(e.target.value)}
          />
        </label>
        {profileMessage ? (
          <p className="text-sm text-[var(--brand)]">{profileMessage}</p>
        ) : null}
        <button
          type="button"
          className="btn btn-primary min-h-11 px-5"
          disabled={busy}
          onClick={() => void saveProfile()}
        >
          {busy ? "保存中…" : "保存资料"}
        </button>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">广告栏</h4>
        <p className="text-sm leading-6 text-[var(--muted)]">
          只影响该高校分区页顶部广告。改这里不会动开关或全站公告栏。上传新图后请点「保存广告栏」才会发布。
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
            <p className="mt-1 text-xs text-[var(--muted)]">未上传时前台显示广告栏占位。</p>
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

      <div>
        <p className="text-sm font-medium">专区</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {uni.zones.map((zone) => (
            <button
              key={zone.id}
              type="button"
              className={`min-h-11 rounded-full px-3 text-sm ${
                zone.enabled
                  ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                  : "bg-[var(--line)] text-[var(--muted)] line-through"
              }`}
              onClick={() => void onToggleZone(zone.id, !zone.enabled)}
            >
              {zone.name}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="min-h-11 flex-1 rounded-2xl border border-[var(--line)] bg-transparent px-3"
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            maxLength={20}
            placeholder="新专区名称"
          />
          <button
            type="button"
            className="btn btn-secondary min-h-11 px-4"
            disabled={busy || !zoneName.trim()}
            onClick={() => {
              void onPatch(uni.id, { addZone: { name: zoneName.trim() } });
              setZoneName("");
            }}
          >
            添加专区
          </button>
        </div>
      </div>
    </div>
  );
}

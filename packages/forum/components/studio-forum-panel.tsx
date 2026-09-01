"use client";

/**
 * 站长论坛：大学 / 兴趣圈子 / 本地同城分区、广告栏、专区。
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StudioForumUniversityBoard } from "@andyyyds/forum/components/studio-forum-university-board";
import { StudioForumZoneEditor } from "@andyyyds/forum/components/studio-forum-zone-editor";
import {
  guessForumUniversityRegion,
  type ForumUniversityRegion,
} from "@andyyyds/forum/lib/forum-university";
import {
  FORUM_SPACE_KIND_LABEL,
  parseForumSpaceKind,
  type ForumSpaceKind,
} from "@andyyyds/forum/lib/forum-space";

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
  region: string;
  kind: string;
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
  const [region, setRegion] = useState<ForumUniversityRegion>("CHINA");
  const [kind, setKind] = useState<ForumSpaceKind>("UNIVERSITY");
  const [openId, setOpenId] = useState("");
  const visibleRows = rows.filter(
    (row) => parseForumSpaceKind(row.kind) === kind,
  );

  async function createUniversity(event: React.FormEvent) {
    event.preventDefault();
    setBusy("create");
    setMessage("");
    try {
      const res = await fetch("/api/studio/forum/universities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, slogan, emailDomains, region, kind }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "创建失败");
        return;
      }
      setRows((prev) =>
        [...prev, data.university].sort(
          (a, b) =>
            (a.region || "CHINA").localeCompare(b.region || "CHINA") ||
            a.sortOrder - b.sortOrder,
        ),
      );
      setName("");
      setSlug("");
      setSlogan("");
      setEmailDomains("");
      setRegion("CHINA");
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
        prev.map((row) => (row.id === id ? data.university : row)).sort(
          (a, b) =>
            (a.region || "CHINA").localeCompare(b.region || "CHINA") ||
            a.sortOrder - b.sortOrder,
        ),
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

  async function persistLists(chinaIds: string[], internationalIds: string[]) {
    setBusy("order");
    setMessage("");
    try {
      const res = await fetch("/api/studio/forum/universities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chinaIds, internationalIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "保存次序失败");
        return false;
      }
      setRows(data.universities);
      setMessage("展示次序已保存。");
      router.refresh();
      return true;
    } finally {
      setBusy("");
    }
  }

  async function resetDefaultOrder() {
    if (
      !window.confirm(
        "按默认规则重排？中国高校会变成清北复交浙人，其余按校名首拼；并按校名重新划分中国/国际。你拖过的次序会被覆盖。",
      )
    ) {
      return false;
    }
    setBusy("order");
    setMessage("");
    try {
      const res = await fetch("/api/studio/forum/universities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetDefault: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "重排失败");
        return false;
      }
      setRows(data.universities);
      setMessage("已按清北复交浙人 + 首拼恢复默认排序。");
      router.refresh();
      return true;
    } finally {
      setBusy("");
    }
  }

  const nameLabel =
    kind === "CIRCLE" ? "圈子名称" : kind === "CITY" ? "城市名称" : "学校名称";
  const namePlaceholder =
    kind === "CIRCLE"
      ? "如 摄影圈"
      : kind === "CITY"
        ? "如 杭州同城"
        : "如 北京大学";
  const sloganPlaceholder =
    kind === "CIRCLE"
      ? "拍片、后期、约拍…"
      : kind === "CITY"
        ? "吃喝玩乐、租房互助…"
        : "同学交流、选课、二手、跑腿…";

  return (
    <div className="space-y-8">
      <div className="flex gap-2 overflow-x-auto">
        {(["UNIVERSITY", "CIRCLE", "CITY"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm ${
              kind === item
                ? "bg-[var(--brand)] text-white"
                : "bg-[var(--line)]/40"
            }`}
            onClick={() => setKind(item)}
          >
            {FORUM_SPACE_KIND_LABEL[item]}
            <span className="ml-1.5 opacity-80">
              {rows.filter((row) => parseForumSpaceKind(row.kind) === item).length}
            </span>
          </button>
        ))}
      </div>
      <form className="space-y-3" onSubmit={(e) => void createUniversity(e)}>
        <h2 className="text-lg font-semibold">
          新建{FORUM_SPACE_KIND_LABEL[kind]}分区
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{nameLabel}</span>
            <input
              className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (kind === "UNIVERSITY") {
                  setRegion(guessForumUniversityRegion(e.target.value, slug));
                }
              }}
              required
              maxLength={40}
              placeholder={namePlaceholder}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">路径（可选英文）</span>
            <input
              className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                if (kind === "UNIVERSITY") {
                  setRegion(guessForumUniversityRegion(name, e.target.value));
                }
              }}
              maxLength={40}
              placeholder={kind === "UNIVERSITY" ? "pku" : kind === "CITY" ? "hangzhou" : "photo"}
            />
          </label>
          {kind !== "CIRCLE" ? (
            <label className="block text-sm">
              <span className="text-[var(--muted)]">分类</span>
              <select
                className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
                value={region}
                onChange={(e) =>
                  setRegion(e.target.value as ForumUniversityRegion)
                }
              >
                <option value="CHINA">
                  {kind === "CITY" ? "国内城市" : "中国高校"}
                </option>
                <option value="INTERNATIONAL">
                  {kind === "CITY" ? "海外城市" : "国际高校"}
                </option>
              </select>
            </label>
          ) : null}
          <label className="block text-sm sm:col-span-2">
            <span className="text-[var(--muted)]">一句话介绍</span>
            <input
              className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              maxLength={80}
              placeholder={sloganPlaceholder}
            />
          </label>
          {kind === "UNIVERSITY" ? (
            <label className="block text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">
                限制本校邮箱（可选）。填写后，认证时校园邮箱命中后缀可当场通过；否则交站长审核。留空则提交实名信息后直接通过。
              </span>
              <input
                className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
                value={emailDomains}
                onChange={(e) => setEmailDomains(e.target.value)}
                placeholder="stu.pku.edu.cn, pku.edu.cn"
              />
            </label>
          ) : null}
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

      {visibleRows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          还没有{FORUM_SPACE_KIND_LABEL[kind]}分区。
        </p>
      ) : kind === "UNIVERSITY" ? (
        <StudioForumUniversityBoard
          rows={visibleRows}
          busy={busy}
          openId={openId}
          onOpen={setOpenId}
          onReorder={persistLists}
          onResetDefault={resetDefaultOrder}
          onMoveRegion={(id, nextRegion) =>
            patchUniversity(id, { region: nextRegion })
          }
          onToggleEnabled={(uni) =>
            void patchUniversity(uni.id, { enabled: !uni.enabled })
          }
          onRemove={(uni) => void removeUniversity(uni.id, uni.name)}
        >
          {(uni) => (
            <UniversityEditor
              key={uni.id}
              uni={uni}
              busy={busy === uni.id}
              onPatch={patchUniversity}
              onZonesChange={(zones) =>
                setRows((prev) =>
                  prev.map((row) =>
                    row.id === uni.id ? { ...row, zones } : row,
                  ),
                )
              }
            />
          )}
        </StudioForumUniversityBoard>
      ) : (
        <div className="space-y-3">
          {visibleRows
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
            .map((uni) => (
              <div
                key={uni.id}
                className="rounded-[24px] border border-[var(--line)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="min-h-11 text-left text-base font-semibold"
                    onClick={() =>
                      setOpenId((current) => (current === uni.id ? "" : uni.id))
                    }
                  >
                    {uni.name}
                    <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                      {uni._count.posts} 帖 · {uni.enabled ? "已开" : "已关"}
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary min-h-11 px-3 text-sm"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void patchUniversity(uni.id, { enabled: !uni.enabled })
                      }
                    >
                      {uni.enabled ? "关闭" : "开启"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary min-h-11 px-3 text-sm"
                      disabled={Boolean(busy)}
                      onClick={() => void removeUniversity(uni.id, uni.name)}
                    >
                      删除
                    </button>
                  </div>
                </div>
                {openId === uni.id ? (
                  <UniversityEditor
                    uni={uni}
                    busy={busy === uni.id}
                    onPatch={patchUniversity}
                    onZonesChange={(zones) =>
                      setRows((prev) =>
                        prev.map((row) =>
                          row.id === uni.id ? { ...row, zones } : row,
                        ),
                      )
                    }
                  />
                ) : null}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function UniversityEditor({
  uni,
  busy,
  onPatch,
  onZonesChange,
}: {
  uni: StudioForumUniversity;
  busy: boolean;
  onPatch: (id: string, payload: Record<string, unknown>) => Promise<boolean>;
  onZonesChange: (zones: StudioForumZone[]) => void;
}) {
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
      slogan,
      description,
      ...(parseForumSpaceKind(uni.kind) === "UNIVERSITY" ? { emailDomains } : {}),
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
        {parseForumSpaceKind(uni.kind) === "UNIVERSITY" ? (
          <label className="block text-sm">
            <span className="text-[var(--muted)]">本校邮箱后缀（可选；命中则认证当场通过）</span>
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
          disabled={busy}
          onClick={() => void saveProfile()}
        >
          {busy ? "保存中…" : "保存资料"}
        </button>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">广告栏</h4>
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

      <StudioForumZoneEditor
        zones={uni.zones}
        disabled={busy}
        onZonesChange={onZonesChange}
        onAdd={async (name) => onPatch(uni.id, { addZone: { name } })}
      />
    </div>
  );
}

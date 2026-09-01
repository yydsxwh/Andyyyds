"use client";

/**
 * 站长论坛：大学 / 兴趣圈子 / 本地同城分区、广告栏、专区。
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StudioForumUniversityBoard } from "@andyyyds/forum/components/studio-forum-university-board";
import {
  guessForumUniversityRegion,
  type ForumUniversityRegion,
} from "@andyyyds/forum/lib/forum-university";
import {
  FORUM_SPACE_KIND_LABEL,
  parseForumSpaceKind,
  studioForumSpaceEditPath,
  type ForumSpaceKind,
} from "@andyyyds/forum/lib/forum-space";

export type StudioForumZone = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
  parentId?: string | null;
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
  const [listQuery, setListQuery] = useState("");
  const visibleRows = rows.filter((row) => {
    if (parseForumSpaceKind(row.kind) !== kind) return false;
    const q = listQuery.trim().toLowerCase();
    if (!q) return true;
    return row.name.toLowerCase().includes(q) || row.slug.toLowerCase().includes(q);
  });

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
      router.push(studioForumSpaceEditPath(data.university.id));
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
                本校邮箱后缀（可选，仅作资料，认证仍须站长审核）
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

      <label className="block text-sm">
        <span className="text-[var(--muted)]">搜索当前列表</span>
        <input
          className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
          value={listQuery}
          onChange={(e) => setListQuery(e.target.value)}
          placeholder={
            kind === "CIRCLE"
              ? "搜圈子名或路径"
              : kind === "CITY"
                ? "搜城市名或路径"
                : "搜学校名或路径"
          }
        />
      </label>

      {visibleRows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          {listQuery.trim()
            ? "没有匹配的分区。"
            : `还没有${FORUM_SPACE_KIND_LABEL[kind]}分区。`}
        </p>
      ) : kind === "UNIVERSITY" ? (
        <StudioForumUniversityBoard
          rows={visibleRows}
          busy={busy}
          onReorder={persistLists}
          onResetDefault={resetDefaultOrder}
          onMoveRegion={(id, nextRegion) =>
            patchUniversity(id, { region: nextRegion })
          }
          onToggleEnabled={(uni) =>
            void patchUniversity(uni.id, { enabled: !uni.enabled })
          }
          onRemove={(uni) => void removeUniversity(uni.id, uni.name)}
        />
      ) : (
        <div className="space-y-2">
          {visibleRows
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
            .map((uni) => (
              <div
                key={uni.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] px-3 py-2"
              >
                <Link
                  href={studioForumSpaceEditPath(uni.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-11 min-w-0 text-left text-base font-semibold leading-[2.75rem]"
                >
                  {uni.name}
                  <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                    {uni._count.posts} 帖 · {uni.enabled ? "已开" : "已关"}
                  </span>
                </Link>
                <div className="flex flex-wrap gap-2">
                  <a
                    className="btn btn-secondary min-h-11 px-3 text-sm"
                    href={`/forum/${uni.slug}`}
                  >
                    打开前台
                  </a>
                  <Link
                    className="btn btn-primary min-h-11 px-3 text-sm"
                    href={studioForumSpaceEditPath(uni.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    编辑
                  </Link>
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
            ))}
        </div>
      )}
    </div>
  );
}

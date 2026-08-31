"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { StudioForumUniversity } from "@andyyyds/forum/components/studio-forum-panel";
import {
  FORUM_UNIVERSITY_REGION_LABEL,
  type ForumUniversityRegion,
} from "@andyyyds/forum/lib/forum-university";

const DND_MIME = "application/x-yyds-forum-uni";

type Props = {
  rows: StudioForumUniversity[];
  busy: string;
  openId: string;
  onOpen: (id: string) => void;
  onReorder: (
    chinaIds: string[],
    internationalIds: string[],
  ) => Promise<boolean>;
  onResetDefault: () => Promise<boolean>;
  onMoveRegion: (id: string, region: ForumUniversityRegion) => Promise<boolean>;
  onToggleEnabled: (uni: StudioForumUniversity) => void;
  onRemove: (uni: StudioForumUniversity) => void;
  children?: (uni: StudioForumUniversity) => ReactNode;
};

function idsOf(
  rows: StudioForumUniversity[],
  region: ForumUniversityRegion,
): string[] {
  return rows
    .filter((row) => (row.region || "CHINA") === region)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => row.id);
}

export function StudioForumUniversityBoard({
  rows,
  busy,
  openId,
  onOpen,
  onReorder,
  onResetDefault,
  onMoveRegion,
  onToggleEnabled,
  onRemove,
  children,
}: Props) {
  const china = useMemo(
    () =>
      rows
        .filter((row) => (row.region || "CHINA") === "CHINA")
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [rows],
  );
  const intl = useMemo(
    () =>
      rows
        .filter((row) => row.region === "INTERNATIONAL")
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">
          中国高校默认清北复交浙人，其余按校名首拼。可用手柄拖动或上移/下移改序；微信里请用按钮。
        </p>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-4 text-sm"
          disabled={Boolean(busy)}
          onClick={() => void onResetDefault()}
        >
          恢复默认排序
        </button>
      </div>
      <RegionList
        region="CHINA"
        items={china}
        otherIds={idsOf(rows, "INTERNATIONAL")}
        busy={busy}
        openId={openId}
        onOpen={onOpen}
        onReorder={onReorder}
        onMoveRegion={onMoveRegion}
        onToggleEnabled={onToggleEnabled}
        onRemove={onRemove}
      >
        {children}
      </RegionList>
      <RegionList
        region="INTERNATIONAL"
        items={intl}
        otherIds={idsOf(rows, "CHINA")}
        busy={busy}
        openId={openId}
        onOpen={onOpen}
        onReorder={onReorder}
        onMoveRegion={onMoveRegion}
        onToggleEnabled={onToggleEnabled}
        onRemove={onRemove}
      >
        {children}
      </RegionList>
    </div>
  );
}

function RegionList({
  region,
  items,
  otherIds,
  busy,
  openId,
  onOpen,
  onReorder,
  onMoveRegion,
  onToggleEnabled,
  onRemove,
  children,
}: {
  region: ForumUniversityRegion;
  items: StudioForumUniversity[];
  otherIds: string[];
  busy: string;
  openId: string;
  onOpen: (id: string) => void;
  onReorder: (chinaIds: string[], internationalIds: string[]) => Promise<boolean>;
  onMoveRegion: (id: string, region: ForumUniversityRegion) => Promise<boolean>;
  onToggleEnabled: (uni: StudioForumUniversity) => void;
  onRemove: (uni: StudioForumUniversity) => void;
  children?: (uni: StudioForumUniversity) => ReactNode;
}) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const otherRegion: ForumUniversityRegion =
    region === "CHINA" ? "INTERNATIONAL" : "CHINA";

  function emit(nextItems: StudioForumUniversity[]) {
    const ids = nextItems.map((item) => item.id);
    if (region === "CHINA") return onReorder(ids, otherIds);
    return onReorder(otherIds, ids);
  }

  function moveItem(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || to >= items.length) return;
    const next = items.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    void emit(next);
  }

  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">
        {FORUM_UNIVERSITY_REGION_LABEL[region]}
        <span className="ml-2 text-sm font-normal text-[var(--muted)]">
          {items.length} 所
        </span>
      </h3>
      {items.length === 0 ? (
        <p className="rounded-[24px] border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          这一类还没有学校。可在上方新建，或把另一类里的学校改分类。
        </p>
      ) : (
        items.map((uni, index) => {
          const open = openId === uni.id;
          return (
            <article
              key={uni.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverIndex(index);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverIndex((cur) => (cur === index ? null : cur));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverIndex(null);
                const raw = e.dataTransfer.getData(DND_MIME);
                if (!raw) return;
                const parsed = JSON.parse(raw) as {
                  region: ForumUniversityRegion;
                  index: number;
                };
                if (parsed.region !== region) return;
                moveItem(parsed.index, index);
              }}
              className={`rounded-[24px] border p-4 sm:p-5 ${
                dragOverIndex === index
                  ? "border-[var(--brand)] ring-1 ring-[var(--brand)]"
                  : "border-[var(--line)]"
              }`}
            >
              <div className="flex gap-3">
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    draggable
                    className="flex h-11 w-11 cursor-grab items-center justify-center rounded-xl border border-[var(--line)] bg-white text-[var(--muted)] touch-manipulation active:cursor-grabbing"
                    aria-label={`拖拽调整「${uni.name}」顺序`}
                    title="按住拖动调整顺序"
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        DND_MIME,
                        JSON.stringify({ region, index }),
                      );
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDragOverIndex(null)}
                  >
                    <span aria-hidden className="select-none text-base leading-none">
                      ⋮⋮
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-11 min-w-11 touch-manipulation px-2 text-sm disabled:opacity-40"
                    disabled={Boolean(busy) || index === 0}
                    onClick={() => moveItem(index, index - 1)}
                    aria-label={`将「${uni.name}」上移`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-11 min-w-11 touch-manipulation px-2 text-sm disabled:opacity-40"
                    disabled={Boolean(busy) || index === items.length - 1}
                    onClick={() => moveItem(index, index + 1)}
                    aria-label={`将「${uni.name}」下移`}
                  >
                    ↓
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{uni.name}</h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        /forum/{uni.slug} · {uni._count.members} 人 ·{" "}
                        {uni._count.posts} 帖 · {uni.enabled ? "展示中" : "已关闭"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select
                        className="min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3 text-sm"
                        value={region}
                        disabled={Boolean(busy)}
                        aria-label={`「${uni.name}」分类`}
                        onChange={(e) =>
                          void onMoveRegion(
                            uni.id,
                            e.target.value as ForumUniversityRegion,
                          )
                        }
                      >
                        <option value="CHINA">中国高校</option>
                        <option value="INTERNATIONAL">国际高校</option>
                      </select>
                      <a
                        className="btn btn-secondary min-h-11 px-4 text-sm"
                        href={`/forum/${uni.slug}`}
                      >
                        打开前台
                      </a>
                      <button
                        type="button"
                        className="btn btn-secondary min-h-11 px-4 text-sm"
                        onClick={() => onOpen(open ? "" : uni.id)}
                      >
                        {open ? "收起" : "编辑"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary min-h-11 px-4 text-sm"
                        disabled={busy === uni.id}
                        onClick={() => onToggleEnabled(uni)}
                      >
                        {uni.enabled ? "关闭" : "开启"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary min-h-11 px-4 text-sm text-red-600"
                        disabled={busy === uni.id}
                        onClick={() => onRemove(uni)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  {open && children ? children(uni) : null}
                </div>
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}

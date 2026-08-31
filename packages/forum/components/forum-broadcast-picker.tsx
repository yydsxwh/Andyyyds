"use client";

import { useMemo } from "react";
import { FORUM_UNIVERSITY_REGION_LABEL } from "@andyyyds/forum/lib/forum-university";

export type ForumBroadcastUniversityOption = {
  id: string;
  name: string;
  region: string;
};

type Props = {
  currentId: string;
  currentName: string;
  universities: ForumBroadcastUniversityOption[];
  extraIds: string[];
  onExtraIds: (ids: string[]) => void;
  schoolOnly: boolean;
};

export function ForumBroadcastPicker({
  currentId,
  currentName,
  universities,
  extraIds,
  onExtraIds,
  schoolOnly,
}: Props) {
  const others = useMemo(
    () => universities.filter((uni) => uni.id !== currentId),
    [universities, currentId],
  );
  const china = others.filter((uni) => uni.region !== "INTERNATIONAL");
  const intl = others.filter((uni) => uni.region === "INTERNATIONAL");
  const extraSet = useMemo(() => new Set(extraIds), [extraIds]);
  const total = 1 + extraIds.length;

  if (others.length === 0) return null;

  function setGroup(ids: string[], selected: boolean) {
    const next = new Set(extraIds);
    for (const id of ids) {
      if (selected) next.add(id);
      else next.delete(id);
    }
    onExtraIds([...next]);
  }

  function toggle(id: string) {
    if (id === currentId) return;
    if (extraSet.has(id)) onExtraIds(extraIds.filter((item) => item !== id));
    else onExtraIds([...extraIds, id]);
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--line)] p-3">
      <div>
        <p className="text-sm font-medium">同步到其他高校</p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          将在每所勾选的学校各发一份独立帖（赞、评互不影响）。已选 {total} 所。
          {schoolOnly
            ? " 勾了仅本校可见时，各校副本只对该校认证用户可见。"
            : ""}
        </p>
      </div>
      <label className="flex min-h-11 items-center gap-3 rounded-xl px-1">
        <input type="checkbox" className="h-5 w-5" checked disabled />
        <span className="text-sm">
          {currentName}
          <span className="ml-1 text-[var(--muted)]">（当前分区）</span>
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-3 text-sm"
          onClick={() => onExtraIds([])}
        >
          仅本校
        </button>
        {china.length > 0 ? (
          <button
            type="button"
            className="btn btn-secondary min-h-11 px-3 text-sm"
            onClick={() => setGroup(china.map((uni) => uni.id), true)}
          >
            全选中国高校
          </button>
        ) : null}
        {intl.length > 0 ? (
          <button
            type="button"
            className="btn btn-secondary min-h-11 px-3 text-sm"
            onClick={() => setGroup(intl.map((uni) => uni.id), true)}
          >
            全选国际高校
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-3 text-sm"
          onClick={() => onExtraIds(others.map((uni) => uni.id))}
        >
          全部高校
        </button>
      </div>
      <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
        <CampusCheckList
          title={FORUM_UNIVERSITY_REGION_LABEL.CHINA}
          items={china}
          selected={extraSet}
          onToggle={toggle}
        />
        <CampusCheckList
          title={FORUM_UNIVERSITY_REGION_LABEL.INTERNATIONAL}
          items={intl}
          selected={extraSet}
          onToggle={toggle}
        />
      </div>
    </section>
  );
}

function CampusCheckList({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: ForumBroadcastUniversityOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-[var(--muted)]">
        {title} · {items.length}
      </p>
      <ul className="mt-1">
        {items.map((uni) => {
          const checked = selected.has(uni.id);
          return (
            <li key={uni.id}>
              <label className="flex min-h-11 items-center gap-3 rounded-xl px-1 py-1">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={checked}
                  onChange={() => onToggle(uni.id)}
                />
                <span className="text-sm">{uni.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

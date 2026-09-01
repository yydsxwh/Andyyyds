"use client";

/**
 * 高校（及圈子/同城）话题栏：后台可改名、排序、显示、新增、删除。
 * 「推荐」是前台总览，不进这张表。
 */

import { useMemo, useState } from "react";
import { FORUM_ZONE_NAME_MAX } from "@andyyyds/forum/lib/forum";

export type StudioForumZoneRow = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
};

type Props = {
  zones: StudioForumZoneRow[];
  disabled?: boolean;
  onAdd: (name: string) => Promise<boolean>;
  onZonesChange: (zones: StudioForumZoneRow[]) => void;
};

export function StudioForumZoneEditor({
  zones,
  disabled = false,
  onAdd,
  onZonesChange,
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState("");
  const [note, setNote] = useState("");

  const sorted = useMemo(
    () =>
      [...zones].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    [zones],
  );

  function nameOf(zone: StudioForumZoneRow) {
    return drafts[zone.id] ?? zone.name;
  }

  async function patchZone(
    zoneId: string,
    payload: Record<string, unknown>,
  ): Promise<StudioForumZoneRow | null> {
    setBusyId(zoneId);
    setNote("");
    try {
      const res = await fetch(`/api/studio/forum/zones/${zoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setNote(data.error || "话题更新失败");
        return null;
      }
      return data.zone as StudioForumZoneRow;
    } finally {
      setBusyId("");
    }
  }

  async function saveName(zone: StudioForumZoneRow) {
    const name = nameOf(zone).trim();
    if (!name || name === zone.name) return;
    const next = await patchZone(zone.id, { name });
    if (!next) return;
    onZonesChange(
      zones.map((item) => (item.id === zone.id ? { ...item, name: next.name } : item)),
    );
    setDrafts((prev) => {
      const copy = { ...prev };
      delete copy[zone.id];
      return copy;
    });
    setNote("话题名称已保存。");
  }

  async function toggleEnabled(zone: StudioForumZoneRow) {
    const next = await patchZone(zone.id, { enabled: !zone.enabled });
    if (!next) return;
    onZonesChange(
      zones.map((item) =>
        item.id === zone.id ? { ...item, enabled: next.enabled } : item,
      ),
    );
  }

  async function move(zone: StudioForumZoneRow, direction: -1 | 1) {
    const index = sorted.findIndex((item) => item.id === zone.id);
    const swap = sorted[index + direction];
    if (!swap) return;
    setBusyId(zone.id);
    setNote("");
    try {
      const first = await fetch(`/api/studio/forum/zones/${zone.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: swap.sortOrder }),
      });
      const second = await fetch(`/api/studio/forum/zones/${swap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: zone.sortOrder }),
      });
      const firstData = await first.json();
      const secondData = await second.json();
      if (!first.ok || !second.ok) {
        setNote(firstData.error || secondData.error || "调整顺序失败");
        return;
      }
      onZonesChange(
        zones.map((item) => {
          if (item.id === zone.id) return { ...item, sortOrder: swap.sortOrder };
          if (item.id === swap.id) return { ...item, sortOrder: zone.sortOrder };
          return item;
        }),
      );
    } finally {
      setBusyId("");
    }
  }

  async function remove(zone: StudioForumZoneRow) {
    if (sorted.length <= 1) {
      setNote("至少保留一个话题。");
      return;
    }
    const ok = window.confirm(
      `删除话题「${zone.name}」？该话题下的帖会转到其他话题，前台话题栏不再显示这一项。`,
    );
    if (!ok) return;
    setBusyId(zone.id);
    setNote("");
    try {
      const res = await fetch(`/api/studio/forum/zones/${zone.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setNote(data.error || "删除失败");
        return;
      }
      onZonesChange(zones.filter((item) => item.id !== zone.id));
      setNote(`已删除「${zone.name}」。`);
    } finally {
      setBusyId("");
    }
  }

  async function addTopic() {
    const name = newName.trim();
    if (!name) return;
    const ok = await onAdd(name);
    if (ok) setNewName("");
  }

  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold">话题栏</h4>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          这里改的是学校页「推荐」右边那一排话题。可改名、换顺序、隐藏、新增和删除。推荐是总览全部帖，不在这张表里。
        </p>
      </div>
      <ul className="space-y-3">
        {sorted.map((zone, index) => {
          const rowBusy = disabled || Boolean(busyId);
          const dirty = nameOf(zone).trim() !== zone.name;
          return (
            <li
              key={zone.id}
              className="rounded-[20px] border border-[var(--line)] p-3"
            >
              <label className="block text-sm">
                <span className="text-[var(--muted)]">话题名称</span>
                <input
                  className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
                  value={nameOf(zone)}
                  maxLength={FORUM_ZONE_NAME_MAX}
                  disabled={rowBusy}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [zone.id]: e.target.value }))
                  }
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary min-h-11 px-4 text-sm"
                  disabled={rowBusy || !dirty || !nameOf(zone).trim()}
                  onClick={() => void saveName(zone)}
                >
                  保存名称
                </button>
                <button
                  type="button"
                  className="btn btn-secondary min-h-11 px-4 text-sm"
                  disabled={rowBusy}
                  onClick={() => void toggleEnabled(zone)}
                >
                  {zone.enabled ? "在话题栏隐藏" : "在话题栏显示"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary min-h-11 px-4 text-sm"
                  disabled={rowBusy || index === 0}
                  onClick={() => void move(zone, -1)}
                >
                  上移
                </button>
                <button
                  type="button"
                  className="btn btn-secondary min-h-11 px-4 text-sm"
                  disabled={rowBusy || index === sorted.length - 1}
                  onClick={() => void move(zone, 1)}
                >
                  下移
                </button>
                <button
                  type="button"
                  className="btn btn-secondary min-h-11 px-4 text-sm"
                  disabled={rowBusy || sorted.length <= 1}
                  onClick={() => void remove(zone)}
                >
                  删除
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="min-h-11 flex-1 rounded-2xl border border-[var(--line)] bg-transparent px-3"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={FORUM_ZONE_NAME_MAX}
          disabled={disabled}
          placeholder="新话题名称，如 实习招聘"
        />
        <button
          type="button"
          className="btn btn-primary min-h-11 px-4"
          disabled={disabled || !newName.trim() || Boolean(busyId)}
          onClick={() => void addTopic()}
        >
          添加话题
        </button>
      </div>
      {note ? <p className="text-sm text-[var(--brand)]">{note}</p> : null}
    </section>
  );
}

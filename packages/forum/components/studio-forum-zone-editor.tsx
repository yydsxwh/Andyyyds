"use client";

/**
 * 话题专区后台：一级、二级都能改名、排序、显示、新增、删除。
 * 「推荐」是前台总览，不进这张表。
 */

import { useMemo, useState } from "react";
import { FORUM_ZONE_NAME_MAX } from "@andyyyds/forum/lib/forum";
import {
  forumZoneChildren,
  forumZoneTops,
} from "@andyyyds/forum/lib/forum-zone";

export type StudioForumZoneRow = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
  parentId?: string | null;
};

type Props = {
  zones: StudioForumZoneRow[];
  disabled?: boolean;
  onAdd: (name: string, parentId?: string) => Promise<boolean>;
  onZonesChange: (zones: StudioForumZoneRow[]) => void;
};

export function StudioForumZoneEditor({
  zones,
  disabled = false,
  onAdd,
  onZonesChange,
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newTopName, setNewTopName] = useState("");
  const [newChildName, setNewChildName] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [note, setNote] = useState("");

  const tops = useMemo(() => forumZoneTops(zones), [zones]);

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
    const siblings = zone.parentId
      ? forumZoneChildren(zones, zone.parentId)
      : tops;
    const index = siblings.findIndex((item) => item.id === zone.id);
    const swap = siblings[index + direction];
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
    const isTop = !zone.parentId;
    if (isTop && tops.length <= 1) {
      setNote("至少保留一个一级话题。");
      return;
    }
    const ok = window.confirm(
      isTop
        ? `删除一级话题「${zone.name}」？它下面的二级话题会一并删除，帖会转到其他一级话题。`
        : `删除二级话题「${zone.name}」？该话题下的帖会转到一级话题。`,
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
      onZonesChange(
        zones.filter((item) => item.id !== zone.id && item.parentId !== zone.id),
      );
      setNote(`已删除「${zone.name}」。`);
    } finally {
      setBusyId("");
    }
  }

  async function addTop() {
    const name = newTopName.trim();
    if (!name) return;
    const ok = await onAdd(name);
    if (ok) setNewTopName("");
  }

  async function addChild(parentId: string) {
    const name = (newChildName[parentId] || "").trim();
    if (!name) return;
    const ok = await onAdd(name, parentId);
    if (ok) {
      setNewChildName((prev) => ({ ...prev, [parentId]: "" }));
    }
  }

  const rowBusy = disabled || Boolean(busyId);

  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold">话题专区</h4>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          一级出现在学校页「推荐」右边那一排。每个一级下面可以再加二级。两级都能改名、换顺序、隐藏、新增和删除。推荐是总览全部帖，不在这张表里。
        </p>
      </div>
      <ul className="space-y-3">
        {tops.map((zone, index) => {
          const children = forumZoneChildren(zones, zone.id);
          const dirty = nameOf(zone).trim() !== zone.name;
          return (
            <li
              key={zone.id}
              className="space-y-3 rounded-[20px] border border-[var(--line)] p-3"
            >
              <ZoneFields
                label="一级话题"
                zone={zone}
                draftName={nameOf(zone)}
                dirty={dirty}
                busy={rowBusy}
                canMoveUp={index > 0}
                canMoveDown={index < tops.length - 1}
                canDelete={tops.length > 1}
                onDraftChange={(value) =>
                  setDrafts((prev) => ({ ...prev, [zone.id]: value }))
                }
                onSave={() => void saveName(zone)}
                onToggle={() => void toggleEnabled(zone)}
                onMoveUp={() => void move(zone, -1)}
                onMoveDown={() => void move(zone, 1)}
                onDelete={() => void remove(zone)}
              />
              <div className="space-y-2 rounded-2xl bg-[var(--line)]/25 p-3">
                <p className="text-sm font-medium">二级话题</p>
                {children.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    还没有二级。不加也可以，发帖会直接落在这一级。
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {children.map((child, childIndex) => {
                      const childDirty = nameOf(child).trim() !== child.name;
                      return (
                        <li
                          key={child.id}
                          className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3"
                        >
                          <ZoneFields
                            label="二级话题"
                            zone={child}
                            draftName={nameOf(child)}
                            dirty={childDirty}
                            busy={rowBusy}
                            canMoveUp={childIndex > 0}
                            canMoveDown={childIndex < children.length - 1}
                            canDelete
                            onDraftChange={(value) =>
                              setDrafts((prev) => ({ ...prev, [child.id]: value }))
                            }
                            onSave={() => void saveName(child)}
                            onToggle={() => void toggleEnabled(child)}
                            onMoveUp={() => void move(child, -1)}
                            onMoveDown={() => void move(child, 1)}
                            onDelete={() => void remove(child)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="min-h-11 flex-1 rounded-2xl border border-[var(--line)] bg-transparent px-3"
                    value={newChildName[zone.id] || ""}
                    onChange={(e) =>
                      setNewChildName((prev) => ({
                        ...prev,
                        [zone.id]: e.target.value,
                      }))
                    }
                    maxLength={FORUM_ZONE_NAME_MAX}
                    disabled={disabled}
                    placeholder="新二级名称，如 食堂"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary min-h-11 px-4"
                    disabled={
                      disabled ||
                      !(newChildName[zone.id] || "").trim() ||
                      Boolean(busyId)
                    }
                    onClick={() => void addChild(zone.id)}
                  >
                    添加二级
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="min-h-11 flex-1 rounded-2xl border border-[var(--line)] bg-transparent px-3"
          value={newTopName}
          onChange={(e) => setNewTopName(e.target.value)}
          maxLength={FORUM_ZONE_NAME_MAX}
          disabled={disabled}
          placeholder="新一级名称，如 实习招聘"
        />
        <button
          type="button"
          className="btn btn-primary min-h-11 px-4"
          disabled={disabled || !newTopName.trim() || Boolean(busyId)}
          onClick={() => void addTop()}
        >
          添加一级
        </button>
      </div>
      {note ? <p className="text-sm text-[var(--brand)]">{note}</p> : null}
    </section>
  );
}

function ZoneFields({
  label,
  zone,
  draftName,
  dirty,
  busy,
  canMoveUp,
  canMoveDown,
  canDelete,
  onDraftChange,
  onSave,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  label: string;
  zone: StudioForumZoneRow;
  draftName: string;
  dirty: boolean;
  busy: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  return (
    <div>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">{label}</span>
        <input
          className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
          value={draftName}
          maxLength={FORUM_ZONE_NAME_MAX}
          disabled={busy}
          onChange={(e) => onDraftChange(e.target.value)}
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary min-h-11 px-4 text-sm"
          disabled={busy || !dirty || !draftName.trim()}
          onClick={onSave}
        >
          保存名称
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-4 text-sm"
          disabled={busy}
          onClick={onToggle}
        >
          {zone.enabled ? "隐藏" : "显示"}
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-4 text-sm"
          disabled={busy || !canMoveUp}
          onClick={onMoveUp}
        >
          上移
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-4 text-sm"
          disabled={busy || !canMoveDown}
          onClick={onMoveDown}
        >
          下移
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-4 text-sm"
          disabled={busy || !canDelete}
          onClick={onDelete}
        >
          删除
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  PERSON_ENTRY_KIND_LABEL,
  PERSON_MAX_IMAGES,
  type PersonEntryKind,
  type PersonEntryPayload,
} from "@andyyyds/person/lib/person-site";
import {
  createPersonAdminEntry,
  deletePersonAdminEntry,
  fetchPersonAdminEntries,
  savePersonAdminEntry,
} from "@andyyyds/person/lib/person-site-client";
import { PersonImageField } from "@andyyyds/person/components/person-image-field";

function emptyDraft(kind: PersonEntryKind): Partial<PersonEntryPayload> {
  return {
    kind,
    title: "",
    summary: "",
    body: "",
    coverUrl: "",
    images: [],
    org: "",
    role: "",
    period: "",
    location: "",
    link: "",
    published: true,
    featured: false,
  };
}

export function PersonAdminEntriesPanel({ kind }: { kind: PersonEntryKind }) {
  const [items, setItems] = useState<PersonEntryPayload[]>([]);
  const [draft, setDraft] = useState<Partial<PersonEntryPayload>>(emptyDraft(kind));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const load = async () => {
    const next = await fetchPersonAdminEntries(kind);
    setItems(next);
  };

  useEffect(() => {
    setDraft(emptyDraft(kind));
    setEditingId(null);
    void load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "加载失败");
    });
  }, [kind]);

  const onSave = async () => {
    setError("");
    setStatus("保存中…");
    try {
      if (editingId) await savePersonAdminEntry(editingId, { ...draft, kind });
      else await createPersonAdminEntry({ ...draft, kind });
      setDraft(emptyDraft(kind));
      setEditingId(null);
      await load();
      setStatus("已保存");
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : "保存失败");
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("删除这条？")) return;
    try {
      await deletePersonAdminEntry(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  };

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-semibold">{PERSON_ENTRY_KIND_LABEL[kind]}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          写好后前台对应栏目会立刻展示。未发布的只留在后台。
        </p>
      </div>
      <div className="grid gap-3">
        <label className="block text-xs text-[var(--muted)]">
          标题
          <input
            className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
            value={draft.title || ""}
            onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-[var(--muted)]">
            机构 / 来源
            <input
              className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
              value={draft.org || ""}
              onChange={(e) => setDraft((current) => ({ ...current, org: e.target.value }))}
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            角色 / 成绩
            <input
              className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
              value={draft.role || ""}
              onChange={(e) => setDraft((current) => ({ ...current, role: e.target.value }))}
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            时间
            <input
              className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
              value={draft.period || ""}
              onChange={(e) => setDraft((current) => ({ ...current, period: e.target.value }))}
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            地点
            <input
              className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
              value={draft.location || ""}
              onChange={(e) => setDraft((current) => ({ ...current, location: e.target.value }))}
            />
          </label>
        </div>
        <label className="block text-xs text-[var(--muted)]">
          摘要
          <textarea
            className="field mt-1 min-h-24 w-full rounded-xl px-3 py-2 text-sm"
            value={draft.summary || ""}
            onChange={(e) => setDraft((current) => ({ ...current, summary: e.target.value }))}
          />
        </label>
        <label className="block text-xs text-[var(--muted)]">
          正文
          <textarea
            className="field mt-1 min-h-36 w-full rounded-xl px-3 py-2 text-sm"
            value={draft.body || ""}
            onChange={(e) => setDraft((current) => ({ ...current, body: e.target.value }))}
          />
        </label>
        <label className="block text-xs text-[var(--muted)]">
          外链
          <input
            className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
            value={draft.link || ""}
            onChange={(e) => setDraft((current) => ({ ...current, link: e.target.value }))}
          />
        </label>
        <PersonImageField
          label="封面 / 照片"
          value={draft.coverUrl || ""}
          onChange={(url) => setDraft((current) => ({ ...current, coverUrl: url }))}
        />
        <div>
          <p className="text-xs text-[var(--muted)]">附图（作品集 / 照片可多张）</p>
          <div className="mt-2 grid gap-3">
            {(draft.images || []).map((url, index) => (
              <PersonImageField
                key={`${index}-${url || "empty"}`}
                label={`附图 ${index + 1}`}
                value={url}
                onChange={(next) =>
                  setDraft((current) => {
                    const images = [...(current.images || [])];
                    images[index] = next;
                    return { ...current, images };
                  })
                }
              />
            ))}
          </div>
          {(draft.images || []).length < PERSON_MAX_IMAGES ? (
            <button
              type="button"
              className="btn btn-secondary mt-2 min-h-11 px-3 text-sm"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  images: [...(current.images || []), ""],
                }))
              }
            >
              加一张图
            </button>
          ) : null}
        </div>
        <label className="block text-xs text-[var(--muted)]">
          排序（数字小的靠前）
          <input
            type="number"
            min={0}
            max={9999}
            className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
            value={draft.sortOrder ?? 0}
            onChange={(e) =>
              setDraft((current) => ({ ...current, sortOrder: Number(e.target.value) || 0 }))
            }
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.published !== false}
            onChange={(e) => setDraft((current) => ({ ...current, published: e.target.checked }))}
          />
          发布到前台
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(draft.featured)}
            onChange={(e) => setDraft((current) => ({ ...current, featured: e.target.checked }))}
          />
          首页精选
        </label>
        {error ? <p className="text-sm text-[var(--fire)]">{error}</p> : null}
        {status ? <p className="text-sm text-[var(--muted)]">{status}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary min-h-11 px-4 text-sm" onClick={() => void onSave()}>
            {editingId ? "保存修改" : "新增一条"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-4 text-sm"
              onClick={() => {
                setEditingId(null);
                setDraft(emptyDraft(kind));
              }}
            >
              取消编辑
            </button>
          ) : null}
        </div>
      </div>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-[var(--muted)]">
                {item.period || item.org || (item.published ? "已发布" : "未发布")}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-3 text-sm"
              onClick={() => {
                setEditingId(item.id);
                setDraft(item);
              }}
            >
              编辑
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-3 text-sm"
              onClick={() => void onDelete(item.id)}
            >
              删除
            </button>
          </li>
        ))}
        {!items.length ? <li className="text-sm text-[var(--muted)]">还没有条目。</li> : null}
      </ul>
    </div>
  );
}

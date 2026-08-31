"use client";

/**
 * 页面模板列表：导航页默认模板 + 自定义页；设默认、复制、编辑、删除。
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";
import { NAV_PAGE_TEMPLATE_DEFS } from "@andyyyds/shared/nav-page-templates";
import {
  PAGE_TEMPLATE_TYPE_LABEL,
  publicTemplatePath,
  type PageTemplate,
  type PageTemplateType,
} from "@andyyyds/shared/page-templates";

type Props = {
  initial: PageTemplate[];
  siteUrl: string;
};

const TYPE_RIBBON: Record<PageTemplateType, string> = {
  home: "bg-[var(--fire)]",
  company: "bg-sky-600",
  person: "bg-violet-600",
  courses: "bg-teal-600",
  meetup: "bg-orange-500",
  shop: "bg-rose-500",
  products: "bg-cyan-600",
  forum: "bg-indigo-500",
  games: "bg-lime-600",
  account: "bg-amber-500",
  custom: "bg-emerald-500",
};

const ALL_TYPES = Object.keys(PAGE_TEMPLATE_TYPE_LABEL) as PageTemplateType[];

function absoluteUrl(siteUrl: string, path: string) {
  const base = siteUrl.replace(/\/$/, "");
  if (!base) return path;
  return `${base}${path}`;
}

export function PageTemplateListPanel({ initial, siteUrl }: Props) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initial);
  const [typeFilter, setTypeFilter] = useState<"all" | PageTemplateType>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState<SaveStatus>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates
      .filter((t) => {
        if (typeFilter !== "all" && t.type !== typeFilter) return false;
        if (!q) return true;
        return (
          t.name.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q) ||
          (PAGE_TEMPLATE_TYPE_LABEL[t.type] || "").includes(q)
        );
      })
      // 系统锁定模板始终靠前，便于找回恢复
      .sort((a, b) => Number(b.locked) - Number(a.locked));
  }, [templates, typeFilter, query]);

  async function runAction(
    action: "create" | "duplicate" | "setDefault" | "delete" | "syncNavDefaults",
    payload: Record<string, unknown>,
    busyKey: string,
  ) {
    setBusy(busyKey);
    setFeedback(null);
    const result = await postSave("/api/studio/page-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    setBusy("");
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "操作失败" });
      return null;
    }
    const list = result.data.templates as PageTemplate[] | undefined;
    if (list) setTemplates(list);
    const okText =
      action === "create"
        ? "模板已创建成功"
        : action === "duplicate"
          ? "模板已复制成功"
          : action === "setDefault"
            ? "已设为默认成功"
            : action === "syncNavDefaults"
              ? String(result.data.message || "同步完成")
              : "模板已删除成功";
    setFeedback({ kind: "ok", text: okText });
    router.refresh();
    return result.data;
  }

  async function createType(type: PageTemplateType) {
    const data = await runAction("create", { type }, `create-${type}`);
    const template = data?.template as { id?: string } | undefined;
    if (template?.id) router.push(`/studio/templates/${template.id}/edit`);
  }

  async function copyLink(tpl: PageTemplate) {
    const url = absoluteUrl(siteUrl, publicTemplatePath(tpl));
    try {
      await navigator.clipboard.writeText(url);
      setFeedback({ kind: "ok", text: `已复制链接：${url}` });
    } catch {
      setFeedback({ kind: "error", text: `复制失败，请手动复制：${url}` });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary min-h-11"
          disabled={Boolean(busy)}
          onClick={() =>
            void runAction("syncNavDefaults", {}, "sync-nav")
          }
        >
          {busy === "sync-nav" ? "同步中…" : "同步系统默认模板"}
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11"
          disabled={Boolean(busy)}
          onClick={() => void createType("custom")}
        >
          + 自定义模板
        </button>
        <SaveFeedback status={feedback} />
      </div>

      <div className="rounded-2xl border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-4 py-3 text-sm leading-6 text-[var(--ink)]">
        <p>
          每种导航页都有一份「系统默认·…（不可改删）」永久保留；误把 DIY
          设为默认后，再点系统默认的「默认」即可恢复原页面。
        </p>
        <p className="mt-1 text-[var(--muted)]">
          同类型可多套 DIY，但只有一份「默认模板」在前台生效。系统默认模块为空时走经典布局；DIY
          用「页面功能区」嵌入原有广场/介绍等内容。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {NAV_PAGE_TEMPLATE_DEFS.map((def) => (
          <button
            key={def.type}
            type="button"
            className="btn btn-secondary min-h-10 px-3 text-sm"
            disabled={Boolean(busy)}
            onClick={() => void createType(def.type)}
            title={`前台路径 ${def.path}`}
          >
            + {PAGE_TEMPLATE_TYPE_LABEL[def.type]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          className="min-h-11 rounded-2xl border border-[var(--line)] bg-white/80 px-3 text-sm"
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as "all" | PageTemplateType)
          }
        >
          <option value="all">全部模板类型</option>
          {ALL_TYPES.map((t) => (
            <option key={t} value={t}>
              {PAGE_TEMPLATE_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <input
          className="min-h-11 flex-1 rounded-2xl border border-[var(--line)] bg-white/80 px-3 text-sm outline-none focus:border-[var(--brand)]"
          placeholder="搜索模板名称"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="surface rounded-[28px] px-6 py-12 text-center text-sm text-[var(--muted)]">
          暂无模板。点「同步系统默认模板」或上方「+ 某页」开始。
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((tpl) => (
            <article
              key={tpl.id}
              className="surface relative overflow-hidden rounded-[24px]"
            >
              <div
                className={`absolute left-0 top-0 z-10 rounded-br-xl px-2.5 py-1 text-xs font-medium text-white ${TYPE_RIBBON[tpl.type] || "bg-slate-500"}`}
              >
                {PAGE_TEMPLATE_TYPE_LABEL[tpl.type] || tpl.type}
              </div>
              <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
                {tpl.locked ? (
                  <div className="rounded-full bg-slate-700 px-2 py-0.5 text-[11px] font-medium text-white">
                    系统锁定
                  </div>
                ) : null}
                {tpl.isDefault ? (
                  <div className="rounded-full bg-[var(--brand)] px-2 py-0.5 text-[11px] font-medium text-white">
                    默认模板
                  </div>
                ) : null}
              </div>

              <div className="flex aspect-[4/3] items-center justify-center bg-[var(--bg-deep)]">
                {tpl.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tpl.coverUrl}
                    alt={tpl.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="px-3 text-center text-sm text-[var(--muted)]">
                    {tpl.locked
                      ? "系统经典页面（不可改删）"
                      : publicTemplatePath(tpl)}
                  </span>
                )}
              </div>

              <div className="space-y-3 p-4">
                <h3 className="truncate text-center text-sm font-semibold">
                  {tpl.name}
                </h3>
                <p className="text-center text-xs text-[var(--muted)]">
                  {tpl.locked
                    ? `${publicTemplatePath(tpl)} · 设为默认可恢复原页`
                    : `${publicTemplatePath(tpl)} · ${tpl.modules.length} 个模块`}
                </p>
                {/* 文字按钮：手机无 hover 时图标不易辨认 */}
                <div className="flex flex-wrap items-center justify-center gap-2 border-t border-[var(--line)] pt-3">
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--muted)] touch-manipulation hover:text-[var(--ink)]"
                    title="复制链接"
                    onClick={() => copyLink(tpl)}
                  >
                    链接
                  </button>
                  {!tpl.locked ? (
                    <Link
                      href={`/studio/templates/${tpl.id}/edit`}
                      className="inline-flex min-h-11 items-center rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-soft)] px-3 text-sm font-medium text-[var(--brand)] touch-manipulation"
                      title="编辑"
                    >
                      编辑
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-medium text-[var(--brand)] touch-manipulation hover:bg-[var(--brand-soft)] disabled:opacity-60"
                    title={tpl.locked ? "复制为可编辑模板" : "复制模板"}
                    disabled={busy === `dup-${tpl.id}`}
                    onClick={async () => {
                      const data = await runAction(
                        "duplicate",
                        { id: tpl.id },
                        `dup-${tpl.id}`,
                      );
                      const copy = data?.template as { id?: string } | undefined;
                      // 复制后直接进入编辑，锁定模板也能得到可改副本
                      if (copy?.id) {
                        router.push(`/studio/templates/${copy.id}/edit`);
                      }
                    }}
                  >
                    {busy === `dup-${tpl.id}` ? "…" : "复制"}
                  </button>
                  {!tpl.isDefault ? (
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--brand)] touch-manipulation hover:bg-white/70"
                      title={
                        tpl.locked
                          ? "设为默认，恢复系统原页面"
                          : "设为默认"
                      }
                      disabled={busy === `def-${tpl.id}`}
                      onClick={() =>
                        void runAction(
                          "setDefault",
                          { id: tpl.id },
                          `def-${tpl.id}`,
                        )
                      }
                    >
                      默认
                    </button>
                  ) : null}
                  {!tpl.locked ? (
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center rounded-xl border border-[var(--fire)]/25 bg-white px-3 text-sm text-[var(--fire)] touch-manipulation hover:bg-rose-50 disabled:opacity-60"
                      title="删除"
                      disabled={busy === `del-${tpl.id}`}
                      onClick={() => {
                        if (!window.confirm(`确定删除「${tpl.name}」？`)) return;
                        void runAction(
                          "delete",
                          { id: tpl.id },
                          `del-${tpl.id}`,
                        );
                      }}
                    >
                      删除
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

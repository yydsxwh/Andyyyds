"use client";

import {
  DOCS_PAGE_NUMBER_LABEL,
  DOCS_PAGE_NUMBER_SLOTS,
  DOCS_PAGE_TEXT_MAX,
  type DocsPageChrome,
  type DocsPageNumberSlot,
} from "@andyyyds/docs/lib/docs-page";

type Props = {
  chrome: DocsPageChrome;
  onChange: (next: DocsPageChrome) => void;
};

const FIELDS: { key: keyof DocsPageChrome; label: string }[] = [
  { key: "headerLeft", label: "页眉左" },
  { key: "headerCenter", label: "页眉中" },
  { key: "headerRight", label: "页眉右" },
  { key: "footerLeft", label: "页脚左" },
  { key: "footerCenter", label: "页脚中" },
  { key: "footerRight", label: "页脚右" },
];

export function DocsPagePanel({ chrome, onChange }: Props) {
  return (
    <section className="border-t border-[var(--line)] bg-[var(--bg)]/50 p-3 sm:p-4">
      <h3 className="text-sm font-medium text-[var(--ink)]">页眉、页脚、页码</h3>
      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
        打印预览和另存为 Word / HTML 时会带上。页码占的那一格不再显示文字。
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {FIELDS.map((field) => (
          <label key={field.key} className="block text-xs text-[var(--muted)]">
            {field.label}
            <input
              className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
              maxLength={DOCS_PAGE_TEXT_MAX}
              value={String(chrome[field.key] || "")}
              onChange={(e) =>
                onChange({ ...chrome, [field.key]: e.target.value.slice(0, DOCS_PAGE_TEXT_MAX) })
              }
            />
          </label>
        ))}
      </div>
      <label className="mt-3 block text-xs text-[var(--muted)]">
        页码位置
        <select
          className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm sm:max-w-xs"
          value={chrome.pageNumber}
          onChange={(e) =>
            onChange({ ...chrome, pageNumber: e.target.value as DocsPageNumberSlot })
          }
        >
          {DOCS_PAGE_NUMBER_SLOTS.map((slot) => (
            <option key={slot} value={slot}>
              {DOCS_PAGE_NUMBER_LABEL[slot]}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-xs text-[var(--muted)] sm:max-w-xs">
        起始页码
        <input
          type="number"
          min={1}
          max={9999}
          className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
          value={chrome.startAt}
          onChange={(e) =>
            onChange({ ...chrome, startAt: Number(e.target.value) || 1 })
          }
        />
      </label>
    </section>
  );
}

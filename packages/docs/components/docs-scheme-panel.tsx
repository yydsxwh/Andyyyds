"use client";

/**
 * 多级编号自定义：预设一键套用，再按级改样式 / 前后缀 / 是否带上级号。
 */

import {
  applyListPreset,
  DOCS_BULLET_STYLE_LABEL,
  DOCS_BULLET_STYLES,
  DOCS_LIST_LEVEL_COUNT,
  DOCS_LIST_PRESETS,
  DOCS_NUMBER_STYLE_LABEL,
  DOCS_NUMBER_STYLES,
  formatLevelPreview,
  schemePreviewLines,
  type DocsLevelSpec,
  type DocsListScheme,
  type DocsNumberStyle,
} from "@andyyyds/docs/lib/docs-scheme";

type Props = {
  scheme: DocsListScheme;
  onChange: (next: DocsListScheme) => void;
};

export function DocsSchemePanel({ scheme, onChange }: Props) {
  const preview = schemePreviewLines(scheme);

  const patchLevel = (index: number, patch: Partial<DocsLevelSpec>) => {
    const levels = scheme.levels.map((level, i) =>
      i === index ? { ...level, ...patch } : level,
    );
    onChange({ ...scheme, presetId: "custom", levels });
  };

  return (
    <section className="border-t border-[var(--line)] bg-[var(--bg)]/50 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-[var(--ink)]">多级项目编号</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            先选一套预设，再改每一级。预览：{preview.join(" / ")}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DOCS_LIST_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`btn min-h-11 px-2 text-left text-xs sm:text-sm ${
              scheme.presetId === preset.id ? "btn-primary" : "btn-secondary"
            }`}
            onClick={() => onChange(applyListPreset(preset.id))}
          >
            <span className="block font-medium">{preset.label}</span>
            <span className="mt-0.5 block text-[10px] opacity-80">{preset.hint}</span>
          </button>
        ))}
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs text-[var(--muted)]">项目符号</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DOCS_BULLET_STYLES.map((id) => (
            <button
              key={id}
              type="button"
              className={`btn min-h-11 px-2 text-sm ${
                scheme.bullet === id ? "btn-primary" : "btn-secondary"
              }`}
              onClick={() => onChange({ ...scheme, presetId: "custom", bullet: id })}
            >
              {DOCS_BULLET_STYLE_LABEL[id]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid gap-3">
        {scheme.levels.slice(0, DOCS_LIST_LEVEL_COUNT).map((level, index) => (
          <fieldset
            key={index}
            className="rounded-2xl border border-[var(--border,var(--line))] bg-white/70 p-3"
          >
            <legend className="px-1 text-sm font-medium text-[var(--ink)]">
              第 {index + 1} 级
              <span className="ml-2 font-normal text-[var(--muted)]">
                {formatLevelPreview(
                  scheme,
                  Array.from({ length: index + 1 }, () => 1),
                )}
              </span>
            </legend>
            <label className="block text-xs text-[var(--muted)]">
              编号样式
              <select
                className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
                value={level.style}
                onChange={(e) =>
                  patchLevel(index, { style: e.target.value as DocsNumberStyle })
                }
              >
                {DOCS_NUMBER_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {DOCS_NUMBER_STYLE_LABEL[style]}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block text-xs text-[var(--muted)]">
                前缀
                <input
                  className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
                  value={level.prefix}
                  maxLength={8}
                  onChange={(e) => patchLevel(index, { prefix: e.target.value })}
                  placeholder="如 第 或 ("
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                后缀
                <input
                  className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
                  value={level.suffix}
                  maxLength={8}
                  onChange={(e) => patchLevel(index, { suffix: e.target.value })}
                  placeholder="如 .  、  章"
                />
              </label>
            </div>
            <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-[var(--ink)]">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--brand)]"
                checked={level.includeParents}
                onChange={(e) =>
                  patchLevel(index, { includeParents: e.target.checked })
                }
              />
              带上上级编号（如 1.1.1）
            </label>
          </fieldset>
        ))}
      </div>
    </section>
  );
}

"use client";

/**
 * 题间留白开关：放在微调提示词旁边。
 * 手机/微信用大按钮，不用 hover 才能改。
 */

import {
  MATHCODE_GAP_LINES_MAX,
  MATHCODE_GAP_LINES_MIN,
  MATHCODE_QUESTION_TYPE_LABEL,
  type MathcodeGapMode,
  type MathcodeQuestionSpacing,
  type MathcodeQuestionType,
} from "@andyyyds/mathcode/lib/mathcode-spacing";

const EDITABLE_TYPES: MathcodeQuestionType[] = [
  "choice",
  "fill",
  "calc",
  "proof",
  "other",
];

const MODES: { id: MathcodeGapMode; label: string }[] = [
  { id: "none", label: "不空" },
  { id: "lines", label: "行数" },
  { id: "half", label: "半页" },
  { id: "page", label: "一页" },
];

type Props = {
  spacing: MathcodeQuestionSpacing;
  onChange: (next: MathcodeQuestionSpacing) => void;
};

export function MathcodeSpacingPanel({ spacing, onChange }: Props) {
  const patchType = (
    type: MathcodeQuestionType,
    patch: Partial<MathcodeQuestionSpacing["byType"][MathcodeQuestionType]>,
  ) => {
    onChange({
      ...spacing,
      byType: {
        ...spacing.byType,
        [type]: { ...spacing.byType[type], ...patch },
      },
    });
  };

  return (
    <section className="mb-5 rounded-2xl border border-[var(--border)] bg-white/70 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-[var(--ink)]">题间留白</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            控制不同题之间空多少：空行、半页或整页。改完立刻写进当前 .tex，预览 PDF 能看见。
          </p>
        </div>
        <button
          type="button"
          className={`btn min-h-11 px-4 text-sm ${
            spacing.enabled ? "btn-primary" : "btn-secondary"
          }`}
          aria-pressed={spacing.enabled}
          onClick={() => onChange({ ...spacing, enabled: !spacing.enabled })}
        >
          {spacing.enabled ? "题间要留白" : "题间不留白"}
        </button>
      </div>

      {spacing.enabled ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {EDITABLE_TYPES.map((type) => {
            const spec = spacing.byType[type];
            return (
              <fieldset
                key={type}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/60 p-3"
              >
                <legend className="px-1 text-sm font-medium text-[var(--ink)]">
                  {MATHCODE_QUESTION_TYPE_LABEL[type]}
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      className={`btn min-h-11 px-2 text-xs sm:text-sm ${
                        spec.mode === mode.id ? "btn-primary" : "btn-secondary"
                      }`}
                      onClick={() => patchType(type, { mode: mode.id })}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                {spec.mode === "lines" ? (
                  <label className="mt-3 block text-xs text-[var(--muted)]">
                    空多少行
                    <input
                      type="number"
                      min={MATHCODE_GAP_LINES_MIN}
                      max={MATHCODE_GAP_LINES_MAX}
                      className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
                      value={spec.lines}
                      onChange={(e) =>
                        patchType(type, {
                          lines: Number(e.target.value) || MATHCODE_GAP_LINES_MIN,
                        })
                      }
                    />
                  </label>
                ) : (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {spec.mode === "none"
                      ? "这类题之间紧挨着，不额外留空。"
                      : spec.mode === "half"
                        ? "下一题前空出约半页，方便打草稿。"
                        : "下一题从新的一页开始。"}
                  </p>
                )}
              </fieldset>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-xs text-[var(--muted)]">
          打开后可分别设定选择题、填空题、计算题、证明题之间空几行、半页还是一页。
        </p>
      )}
    </section>
  );
}

/**
 * 题间留白：按题型在题与题之间插入空行 / 半页 / 整页。
 * 改规则只改这里；识别后改开关也会重写已生成的 .tex（先剥旧标记再插入）。
 * 前后端都能用，勿引入 Prisma / 密钥。
 */

export const MATHCODE_QUESTION_TYPES = [
  "choice",
  "fill",
  "calc",
  "proof",
  "other",
] as const;

export type MathcodeQuestionType = (typeof MATHCODE_QUESTION_TYPES)[number];

export type MathcodeGapMode = "none" | "lines" | "half" | "page";

export type MathcodeGapSpec = {
  mode: MathcodeGapMode;
  /** mode=lines 时用；1–40 行 */
  lines: number;
};

export type MathcodeQuestionSpacing = {
  /** 总开关：关则题间不插空白，各题型设置仍保留便于再开 */
  enabled: boolean;
  byType: Record<MathcodeQuestionType, MathcodeGapSpec>;
};

export const MATHCODE_GAP_LINES_MIN = 1;
export const MATHCODE_GAP_LINES_MAX = 40;

export const MATHCODE_QUESTION_TYPE_LABEL: Record<MathcodeQuestionType, string> = {
  choice: "选择题",
  fill: "填空题",
  calc: "计算题",
  proof: "证明题",
  other: "其他 / 未标明",
};

export const DEFAULT_QUESTION_SPACING: MathcodeQuestionSpacing = {
  enabled: false,
  byType: {
    choice: { mode: "lines", lines: 1 },
    fill: { mode: "lines", lines: 2 },
    // 计算、证明默认多留演草空间；用户可改成行数
    calc: { mode: "half", lines: 8 },
    proof: { mode: "page", lines: 12 },
    other: { mode: "lines", lines: 1 },
  },
};

const GAP_BEGIN = (type: MathcodeQuestionType) => `% <<<mathcode-gap:${type}>>>`;
const GAP_END = "% <<<mathcode-gap:end>>>";
const GAP_BLOCK_RE =
  /% <<<mathcode-gap:(?:choice|fill|calc|proof|other)>>>\n[\s\S]*?% <<<mathcode-gap:end>>>\n?/g;

const HEADER_RULES: { type: MathcodeQuestionType; re: RegExp }[] = [
  { type: "choice", re: /选择题|单项选择|多项选择|单选题|多选题/ },
  { type: "fill", re: /填空题|(?:^|[、．.])\s*填空/ },
  { type: "calc", re: /计算题|解答题|求解题|应用题/ },
  { type: "proof", re: /证明题|证明下列/ },
];

/** 题号行：1. / 1、 / 第1题 / (1) / \item；不把 A. B. 当新题 */
const QUESTION_START_RE =
  /^\s*(?:\\item\b|(?:第\s*)?\d{1,3}\s*(?:题|[.．、])|[（(]\d{1,3}[）)])/;

function clampLines(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(MATHCODE_GAP_LINES_MAX, Math.max(MATHCODE_GAP_LINES_MIN, Math.round(n)));
}

function normalizeSpec(raw: unknown): MathcodeGapSpec {
  const spec = raw && typeof raw === "object" ? (raw as Partial<MathcodeGapSpec>) : {};
  const mode: MathcodeGapMode =
    spec.mode === "none" ||
    spec.mode === "lines" ||
    spec.mode === "half" ||
    spec.mode === "page"
      ? spec.mode
      : "lines";
  return { mode, lines: clampLines(Number(spec.lines)) };
}

export function normalizeQuestionSpacing(
  raw: unknown,
): MathcodeQuestionSpacing {
  const input = raw && typeof raw === "object" ? (raw as Partial<MathcodeQuestionSpacing>) : {};
  const byType = { ...DEFAULT_QUESTION_SPACING.byType };
  const incoming =
    input.byType && typeof input.byType === "object"
      ? (input.byType as Partial<Record<MathcodeQuestionType, unknown>>)
      : {};
  for (const type of MATHCODE_QUESTION_TYPES) {
    byType[type] = normalizeSpec(incoming[type]);
  }
  return {
    enabled: Boolean(input.enabled),
    byType,
  };
}

export function gapLatex(spec: MathcodeGapSpec): string {
  if (spec.mode === "none") return "";
  if (spec.mode === "page") return "\\clearpage";
  if (spec.mode === "half") return "\\par\\vspace*{0.48\\textheight}\\par";
  return `\\par\\vspace{${clampLines(spec.lines)}\\baselineskip}\\par`;
}

export function describeGapSpec(spec: MathcodeGapSpec): string {
  if (spec.mode === "none") return "不空";
  if (spec.mode === "page") return "一页";
  if (spec.mode === "half") return "半页";
  return `${clampLines(spec.lines)} 行`;
}

/** 给识别指令用：只要求保留题号/题型标题，空白由导出时插入，避免模型乱加 vspace。 */
export function buildSpacingPrompt(spacing: MathcodeQuestionSpacing): string {
  if (!spacing.enabled) return "";
  const parts = (["choice", "fill", "calc", "proof"] as const).map(
    (type) =>
      `${MATHCODE_QUESTION_TYPE_LABEL[type]}${describeGapSpec(spacing.byType[type])}`,
  );
  return [
    `题间留白：${parts.join("；")}。`,
    "请保留「选择题 / 填空题 / 计算题 / 证明题」小标题和题号（1. 2. 或 \\item）。",
    "不要自己写 \\vspace 或 \\newpage，空白由导出时按题型插入。",
  ].join("");
}

export function stripQuestionGaps(body: string): string {
  return String(body || "")
    .replace(GAP_BLOCK_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function classifyQuestionHeader(line: string): MathcodeQuestionType | null {
  const text = String(line || "").replace(/%.*$/, "");
  for (const rule of HEADER_RULES) {
    if (rule.re.test(text)) return rule.type;
  }
  return null;
}

export function isQuestionStartLine(line: string): boolean {
  const text = String(line || "").replace(/%.*$/, "");
  if (!text.trim()) return false;
  return QUESTION_START_RE.test(text);
}

function gapBlock(type: MathcodeQuestionType, spacing: MathcodeQuestionSpacing): string {
  if (!spacing.enabled) return "";
  const latex = gapLatex(spacing.byType[type]);
  if (!latex) return "";
  return `${GAP_BEGIN(type)}\n${latex}\n${GAP_END}`;
}

/**
 * 在相邻两题之间插入留白。用「刚结束那一题」的题型，
 * 避免看到下一节标题后误用新题型的空白。
 */
export function applyQuestionGaps(
  body: string,
  spacing: MathcodeQuestionSpacing,
): string {
  const clean = stripQuestionGaps(body);
  if (!spacing.enabled || !clean) return clean;

  const lines = clean.split("\n");
  let currentType: MathcodeQuestionType = "other";
  let previousType: MathcodeQuestionType | null = null;
  const out: string[] = [];

  for (const line of lines) {
    const headerType = classifyQuestionHeader(line);
    if (headerType) currentType = headerType;

    if (isQuestionStartLine(line)) {
      if (previousType) {
        const block = gapBlock(previousType, spacing);
        if (block) out.push(block);
      }
      previousType = currentType;
    }
    out.push(line);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

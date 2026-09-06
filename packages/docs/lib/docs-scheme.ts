/**
 * 多级编号 / 项目符号规则集中在这里。
 * 改预设或某一级的「1. / 一、 / 1.1」只改本文件；编辑器只吃规范化后的 scheme。
 */

export const DOCS_LIST_LEVEL_COUNT = 6;
export const DOCS_NUMBER_STYLES = [
  "decimal",
  "cjk",
  "lower-alpha",
  "upper-alpha",
  "lower-roman",
  "upper-roman",
  "circled",
] as const;

export type DocsNumberStyle = (typeof DOCS_NUMBER_STYLES)[number];

export const DOCS_BULLET_STYLES = ["disc", "circle", "square", "dash"] as const;
export type DocsBulletStyle = (typeof DOCS_BULLET_STYLES)[number];

export type DocsLevelSpec = {
  style: DocsNumberStyle;
  prefix: string;
  suffix: string;
  /** true：1.1.1；false：只显示本级，如 （一） */
  includeParents: boolean;
  parentSeparator: string;
};

export type DocsListScheme = {
  presetId: string;
  levels: DocsLevelSpec[];
  bullet: DocsBulletStyle;
};

export const DOCS_NUMBER_STYLE_LABEL: Record<DocsNumberStyle, string> = {
  decimal: "1 2 3",
  cjk: "一 二 三",
  "lower-alpha": "a b c",
  "upper-alpha": "A B C",
  "lower-roman": "i ii iii",
  "upper-roman": "I II III",
  circled: "① ② ③",
};

export const DOCS_BULLET_STYLE_LABEL: Record<DocsBulletStyle, string> = {
  disc: "实心圆 •",
  circle: "空心圆 ○",
  square: "方块 ■",
  dash: "短横 –",
};

const MAX_AFFIX_CHARS = 8;
const CJK_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
const ROMAN: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

function clampLevelCount(levels: DocsLevelSpec[]): DocsLevelSpec[] {
  const next = levels.slice(0, DOCS_LIST_LEVEL_COUNT);
  while (next.length < DOCS_LIST_LEVEL_COUNT) {
    next.push(defaultLevel(next.length));
  }
  return next;
}

function sanitizeAffix(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f]/g, "")
    .slice(0, MAX_AFFIX_CHARS);
}

function defaultLevel(index: number): DocsLevelSpec {
  if (index === 0) {
    return {
      style: "decimal",
      prefix: "",
      suffix: ".",
      includeParents: false,
      parentSeparator: ".",
    };
  }
  return {
    style: "decimal",
    prefix: "",
    suffix: ".",
    includeParents: true,
    parentSeparator: ".",
  };
}

export function normalizeLevelSpec(raw: unknown, index: number): DocsLevelSpec {
  const input = raw && typeof raw === "object" ? (raw as Partial<DocsLevelSpec>) : {};
  const style = DOCS_NUMBER_STYLES.includes(input.style as DocsNumberStyle)
    ? (input.style as DocsNumberStyle)
    : defaultLevel(index).style;
  const fallback = defaultLevel(index);
  return {
    style,
    prefix: sanitizeAffix(input.prefix ?? fallback.prefix),
    suffix: sanitizeAffix(input.suffix ?? fallback.suffix),
    includeParents: Boolean(
      input.includeParents === undefined ? fallback.includeParents : input.includeParents,
    ),
    parentSeparator: sanitizeAffix(input.parentSeparator ?? fallback.parentSeparator) || ".",
  };
}

export const DEFAULT_DOCS_LIST_SCHEME: DocsListScheme = {
  presetId: "standard",
  bullet: "disc",
  levels: Array.from({ length: DOCS_LIST_LEVEL_COUNT }, (_, i) => defaultLevel(i)),
};

export const DOCS_LIST_PRESETS: {
  id: string;
  label: string;
  hint: string;
  scheme: DocsListScheme;
}[] = [
  {
    id: "standard",
    label: "标准 1. / 1.1.",
    hint: "论文、讲义常用",
    scheme: DEFAULT_DOCS_LIST_SCHEME,
  },
  {
    id: "chinese",
    label: "中文 一、（一）1.",
    hint: "规章、通知",
    scheme: {
      presetId: "chinese",
      bullet: "disc",
      levels: clampLevelCount([
        { style: "cjk", prefix: "", suffix: "、", includeParents: false, parentSeparator: "." },
        { style: "cjk", prefix: "（", suffix: "）", includeParents: false, parentSeparator: "." },
        { style: "decimal", prefix: "", suffix: ".", includeParents: false, parentSeparator: "." },
        { style: "lower-alpha", prefix: "", suffix: ")", includeParents: false, parentSeparator: "." },
        { style: "lower-roman", prefix: "", suffix: ".", includeParents: false, parentSeparator: "." },
        { style: "decimal", prefix: "", suffix: ".", includeParents: false, parentSeparator: "." },
      ]),
    },
  },
  {
    id: "chapter",
    label: "章节 第1章 / 第1节",
    hint: "教材目录",
    scheme: {
      presetId: "chapter",
      bullet: "disc",
      levels: clampLevelCount([
        { style: "decimal", prefix: "第", suffix: "章", includeParents: false, parentSeparator: "." },
        { style: "decimal", prefix: "第", suffix: "节", includeParents: false, parentSeparator: "." },
        { style: "decimal", prefix: "", suffix: ".", includeParents: true, parentSeparator: "." },
        { style: "decimal", prefix: "", suffix: ".", includeParents: true, parentSeparator: "." },
        { style: "lower-alpha", prefix: "", suffix: ")", includeParents: false, parentSeparator: "." },
        { style: "decimal", prefix: "", suffix: ".", includeParents: false, parentSeparator: "." },
      ]),
    },
  },
  {
    id: "paren",
    label: "括号 (1) (a) (i)",
    hint: "英文材料",
    scheme: {
      presetId: "paren",
      bullet: "circle",
      levels: clampLevelCount([
        { style: "decimal", prefix: "(", suffix: ")", includeParents: false, parentSeparator: "." },
        { style: "lower-alpha", prefix: "(", suffix: ")", includeParents: false, parentSeparator: "." },
        { style: "lower-roman", prefix: "(", suffix: ")", includeParents: false, parentSeparator: "." },
        { style: "decimal", prefix: "", suffix: ".", includeParents: true, parentSeparator: "." },
        { style: "lower-alpha", prefix: "", suffix: ")", includeParents: false, parentSeparator: "." },
        { style: "decimal", prefix: "", suffix: ".", includeParents: false, parentSeparator: "." },
      ]),
    },
  },
];

export function normalizeListScheme(raw: unknown): DocsListScheme {
  const input = raw && typeof raw === "object" ? (raw as Partial<DocsListScheme>) : {};
  const preset = DOCS_LIST_PRESETS.find((item) => item.id === input.presetId);
  const incoming = Array.isArray(input.levels) ? input.levels : [];
  const levels = clampLevelCount(
    incoming.map((level, index) => normalizeLevelSpec(level, index)),
  );
  return {
    presetId: preset?.id || "custom",
    bullet: DOCS_BULLET_STYLES.includes(input.bullet as DocsBulletStyle)
      ? (input.bullet as DocsBulletStyle)
      : "disc",
    levels,
  };
}

export function applyListPreset(presetId: string): DocsListScheme {
  const preset = DOCS_LIST_PRESETS.find((item) => item.id === presetId);
  return preset ? structuredClone(preset.scheme) : structuredClone(DEFAULT_DOCS_LIST_SCHEME);
}

function toCjk(n: number): string {
  if (n <= 0) return String(n);
  if (n < 10) return CJK_DIGITS[n];
  if (n === 10) return "十";
  if (n < 20) return `十${CJK_DIGITS[n - 10]}`;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return `${CJK_DIGITS[tens]}十${ones ? CJK_DIGITS[ones] : ""}`;
  }
  return String(n);
}

function toAlpha(n: number, upper: boolean): string {
  if (n <= 0) return String(n);
  let value = n;
  let out = "";
  while (value > 0) {
    value -= 1;
    out = String.fromCharCode((upper ? 65 : 97) + (value % 26)) + out;
    value = Math.floor(value / 26);
  }
  return out;
}

function toRoman(n: number): string {
  if (n <= 0) return String(n);
  let remain = Math.min(n, 3999);
  let out = "";
  for (const [value, glyph] of ROMAN) {
    while (remain >= value) {
      out += glyph;
      remain -= value;
    }
  }
  return out;
}

export function formatNumberToken(n: number, style: DocsNumberStyle): string {
  if (style === "decimal") return String(n);
  if (style === "cjk") return toCjk(n);
  if (style === "lower-alpha") return toAlpha(n, false);
  if (style === "upper-alpha") return toAlpha(n, true);
  if (style === "lower-roman") return toRoman(n).toLowerCase();
  if (style === "upper-roman") return toRoman(n);
  if (n >= 1 && n <= 20) return CIRCLED[n - 1];
  return `(${n})`;
}

/** 预览某一级：counts 为从第 1 级到当前级的序号，如 [1, 2] → 1.2. */
export function formatLevelPreview(scheme: DocsListScheme, counts: number[]): string {
  const index = counts.length - 1;
  if (index < 0 || index >= scheme.levels.length) return "";
  const spec = scheme.levels[index];
  if (spec.includeParents) {
    const body = counts
      .map((count, i) => formatNumberToken(count, scheme.levels[i].style))
      .join(spec.parentSeparator);
    return `${spec.prefix}${body}${spec.suffix}`;
  }
  return `${spec.prefix}${formatNumberToken(counts[index], spec.style)}${spec.suffix}`;
}

export function schemePreviewLines(scheme: DocsListScheme): string[] {
  return [
    formatLevelPreview(scheme, [1]),
    formatLevelPreview(scheme, [1, 1]),
    formatLevelPreview(scheme, [1, 1, 1]),
  ];
}

function cssEscape(text: string): string {
  return JSON.stringify(text);
}

function cssCounterSystem(style: DocsNumberStyle): string {
  if (style === "cjk") return "cjk-ideographic";
  if (style === "circled") return "docs-circled";
  return style;
}

function bulletGlyph(style: DocsBulletStyle): string {
  if (style === "circle") return "○";
  if (style === "square") return "■";
  if (style === "dash") return "–";
  return "•";
}

function levelSelector(depth: number): string {
  return `.docs-prose ${"ol ".repeat(depth)}`.trimEnd();
}

/**
 * 按 scheme 生成编号 CSS。正文仍是普通 ol/li，显示靠计数器，
 * 这样改编号不必改文档 JSON。
 */
export function buildListSchemeCss(scheme: DocsListScheme): string {
  const normalized = normalizeListScheme(scheme);
  const lines = [
    `@counter-style docs-circled { system: cyclic; symbols: ${[...CIRCLED].map((ch) => `"${ch}"`).join(" ")}; suffix: ""; }`,
    `.docs-prose ol { list-style: none; padding-left: 2.6em; }`,
    `.docs-prose ul { list-style: none; padding-left: 1.6em; }`,
    `.docs-prose ol > li, .docs-prose ul > li { position: relative; }`,
  ];

  for (let depth = 1; depth <= DOCS_LIST_LEVEL_COUNT; depth += 1) {
    const spec = normalized.levels[depth - 1];
    const sel = levelSelector(depth);
    const counter = `docs-l${depth}`;
    lines.push(`${sel} { counter-reset: ${counter}; }`);
    lines.push(`${sel} > li { counter-increment: ${counter}; }`);

    const parts: string[] = [];
    if (spec.prefix) parts.push(cssEscape(spec.prefix));
    if (spec.includeParents) {
      for (let parent = 1; parent <= depth; parent += 1) {
        const parentSpec = normalized.levels[parent - 1];
        parts.push(`counter(docs-l${parent}, ${cssCounterSystem(parentSpec.style)})`);
        if (parent < depth) parts.push(cssEscape(spec.parentSeparator));
      }
    } else {
      parts.push(`counter(${counter}, ${cssCounterSystem(spec.style)})`);
    }
    if (spec.suffix) parts.push(cssEscape(spec.suffix));
    parts.push(`"\\00a0"`);

    lines.push(
      `${sel} > li::before { content: ${parts.join(" ")}; position: absolute; right: calc(100% + 0.15em); top: 0.15em; white-space: nowrap; font-variant-numeric: tabular-nums; }`,
    );
  }

  lines.push(
    `.docs-prose ul > li::before { content: ${cssEscape(bulletGlyph(normalized.bullet) + "\u00a0")}; position: absolute; right: calc(100% + 0.15em); top: 0.15em; }`,
  );
  return lines.join("\n");
}

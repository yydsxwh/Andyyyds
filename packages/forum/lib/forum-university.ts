/**
 * 高校分区分类与默认排序。
 *
 * 中国高校默认：先「清北复交浙人」（清华、北大、复旦、上交、浙大、人大），
 * 其余按校名拼音（Intl.Collator zh-CN，即首拼顺序）。
 * 国际高校按校名排序。站长拖拽写入的 sortOrder 优先于这套默认规则。
 */

export const FORUM_UNIVERSITY_REGIONS = ["CHINA", "INTERNATIONAL"] as const;
export type ForumUniversityRegion = (typeof FORUM_UNIVERSITY_REGIONS)[number];

export const FORUM_UNIVERSITY_REGION_LABEL: Record<ForumUniversityRegion, string> =
  {
    CHINA: "中国高校",
    INTERNATIONAL: "国际高校",
  };

const NAME_COLLATOR = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});

/** 清北复交浙人：清华、北大、复旦、上海交大、浙大、人大 */
const ELITE_CHINA_RULES: { rank: number; test: (name: string, slug: string) => boolean }[] =
  [
    {
      rank: 0,
      test: (name, slug) =>
        slug === "thu" || name.includes("清华大学") || name === "清华",
    },
    {
      rank: 1,
      test: (name, slug) =>
        slug === "pku" || name.includes("北京大学") || name === "北大",
    },
    {
      rank: 2,
      test: (name, slug) =>
        slug === "fdu" || name.includes("复旦大学") || name === "复旦",
    },
    {
      rank: 3,
      test: (name, slug) =>
        slug === "sjtu" ||
        name.includes("上海交通大学") ||
        name.includes("上海交大"),
    },
    {
      rank: 4,
      test: (name, slug) =>
        slug === "zju" || name.includes("浙江大学") || name === "浙大",
    },
    {
      rank: 5,
      test: (name, slug) =>
        slug === "ruc" || name.includes("中国人民大学") || name === "人大",
    },
  ];

const INTERNATIONAL_SLUGS = new Set([
  "nus",
  "ntu",
  "mit",
  "cu",
  "harvard",
  "stanford",
  "ox",
  "cam",
  "yale",
]);

const INTERNATIONAL_NAME_RE =
  /新加坡|南洋理工|哥伦比亚|麻省理工|斯坦福|哈佛|牛津|剑桥|耶鲁|普林斯顿|芝加哥大学|加州理工|伯克利|康奈尔|卡内基梅隆|杜克大学|东京大学|京都大学|大阪大学|首尔大学|高丽大学|成均馆|悉尼大学|墨尔本大学|澳洲国立|多伦多大学|麦吉尔|帝国理工|伦敦大学学院|伦敦政治经济|苏黎世联邦|慕尼黑工|巴黎综合|莫斯科大学|harvard|stanford|oxford|cambridge|yale|princeton|columbia/i;

/** 港澳台按中国高校展示 */
const GREATER_CHINA_RE = /香港|澳门|台湾|台北|新竹|高雄/;

export function isForumUniversityRegion(
  value: string,
): value is ForumUniversityRegion {
  return (FORUM_UNIVERSITY_REGIONS as readonly string[]).includes(value);
}

export function parseForumUniversityRegion(
  raw: string | null | undefined,
): ForumUniversityRegion {
  const value = String(raw || "").trim();
  return isForumUniversityRegion(value) ? value : "CHINA";
}

export function eliteChinaRank(name: string, slug: string): number | null {
  const n = name.replace(/\s+/g, "");
  const s = slug.trim().toLowerCase();
  for (const rule of ELITE_CHINA_RULES) {
    if (rule.test(n, s)) return rule.rank;
  }
  return null;
}

/**
 * 港澳台算中国高校。明确的海外校名/slug 算国际。
 * 其余含「大学/学院」等中文校名默认中国；纯外文名默认国际。
 */
export function guessForumUniversityRegion(
  name: string,
  slug = "",
): ForumUniversityRegion {
  const n = name.trim();
  const s = slug.trim().toLowerCase();
  // 清北复交浙人以及带「清华大学/北京大学」全称的，避免被英文校名规则误判成国际
  if (eliteChinaRank(n, s) != null) return "CHINA";
  if (GREATER_CHINA_RE.test(n)) return "CHINA";
  if (INTERNATIONAL_SLUGS.has(s) || INTERNATIONAL_NAME_RE.test(n)) {
    return "INTERNATIONAL";
  }
  if (/[\u4e00-\u9fff]/.test(n)) return "CHINA";
  return "INTERNATIONAL";
}

export function compareForumUniversitiesByDefault(
  a: { name: string; slug: string; region?: string },
  b: { name: string; slug: string; region?: string },
): number {
  const ra = parseForumUniversityRegion(a.region);
  const rb = parseForumUniversityRegion(b.region);
  if (ra !== rb) return ra === "CHINA" ? -1 : 1;
  if (ra === "CHINA") {
    const ea = eliteChinaRank(a.name, a.slug);
    const eb = eliteChinaRank(b.name, b.slug);
    if (ea != null && eb != null && ea !== eb) return ea - eb;
    if (ea != null && eb == null) return -1;
    if (ea == null && eb != null) return 1;
  }
  const byName = NAME_COLLATOR.compare(a.name, b.name);
  if (byName !== 0) return byName;
  return a.slug.localeCompare(b.slug);
}

export function applyDefaultForumUniversityOrder<
  T extends { id: string; name: string; slug: string; region?: string },
>(rows: T[]): Array<T & { region: ForumUniversityRegion; sortOrder: number }> {
  const china = rows
    .filter((row) => parseForumUniversityRegion(row.region) === "CHINA")
    .sort(compareForumUniversitiesByDefault);
  const intl = rows
    .filter((row) => parseForumUniversityRegion(row.region) === "INTERNATIONAL")
    .sort(compareForumUniversitiesByDefault);
  return [
    ...china.map((row, index) => ({
      ...row,
      region: "CHINA" as const,
      sortOrder: index * 10,
    })),
    ...intl.map((row, index) => ({
      ...row,
      region: "INTERNATIONAL" as const,
      sortOrder: index * 10,
    })),
  ];
}

export const FORUM_UNIVERSITY_LIST_ORDER_BY = [
  { region: "asc" as const },
  { sortOrder: "asc" as const },
  { name: "asc" as const },
];

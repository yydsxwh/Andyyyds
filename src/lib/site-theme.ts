/**
 * 网站装扮：配色 / 背景 / 一键主题包。
 * 业务规则集中在此，便于站长换肤时改一处即可；前台通过 CSS 变量落地。
 * 配色方案库见 site-theme-palettes.ts（分类多、体量大）。
 */

export type {
  ThemePalette,
  ThemePaletteCategory,
  ThemePaletteTokens,
} from "./site-theme-palettes";
export {
  DEFAULT_PALETTE_TOKENS,
  THEME_PALETTE_CATEGORIES,
  THEME_PALETTES,
  categoryLabel,
  palettesInCategory,
} from "./site-theme-palettes";

import {
  EXTRA_THEME_BACKGROUNDS,
  EXTRA_THEME_PACKS,
} from "./site-theme-backgrounds-extra";
import {
  QZONE_THEME_BACKGROUNDS,
  QZONE_THEME_PACKS,
} from "./site-theme-qzone";
import { THEME_PALETTES } from "./site-theme-palettes";

export type ThemeBackgroundKind = "gradient" | "photo" | "pattern";

export type ThemeBackground = {
  id: string;
  name: string;
  kind: ThemeBackgroundKind;
  /** 列表缩略：纯色/渐变用 CSS；照片用 url */
  preview: string;
  /**
   * 写入 --site-bg-layers 的完整 background 值。
   * 照片类务必自带半透明遮罩，保证正文可读。
   */
  layers: string;
};

export type ThemePack = {
  id: string;
  name: string;
  tagline: string;
  paletteId: string;
  backgroundId: string;
  /** 网格卡片封面（可用背景预览或照片） */
  cover: string;
};

export type LayoutDensity = "default" | "compact" | "airy";

/** 站长可调的前台字号（单位 px）；业务规则集中在此，改默认/上下限只动一处 */
export type FontSizeKey =
  | "nav"
  | "brand"
  | "heroTitle"
  | "heroSubtext"
  | "sectionTitle"
  | "sectionDesc"
  | "portalCardTitle"
  | "portalCardDesc"
  /** 列表页分类筛选胶囊（约搭/课程/资料/商城等） */
  | "filterTag";

export type FontSizesConfig = Record<FontSizeKey, number>;

export type FontSizeFieldMeta = {
  key: FontSizeKey;
  label: string;
  hint: string;
  min: number;
  max: number;
  /** 写入的 CSS 变量名 */
  cssVar: string;
};

export const DEFAULT_PALETTE_ID = "sky-fresh";
export const DEFAULT_BACKGROUND_ID = "soft-dawn";
export const DEFAULT_THEME_PACK_ID = "pack-sky-fresh";
export const DEFAULT_LAYOUT_DENSITY: LayoutDensity = "default";

/** 默认比原先 text-base(16) 更大，导航一眼可读 */
export const DEFAULT_FONT_SIZES: FontSizesConfig = {
  nav: 18,
  brand: 18,
  heroTitle: 36,
  heroSubtext: 17,
  sectionTitle: 24,
  sectionDesc: 14,
  /** 对应原 text-lg */
  portalCardTitle: 18,
  /** 对应原 text-sm */
  portalCardDesc: 14,
  /** 对应原筛选胶囊 text-sm */
  filterTag: 14,
};

export const FONT_SIZE_FIELDS: FontSizeFieldMeta[] = [
  {
    key: "nav",
    label: "顶栏导航",
    hint: "首页顶栏菜单文字",
    min: 14,
    max: 28,
    cssVar: "--fs-nav",
  },
  {
    key: "brand",
    label: "品牌名",
    hint: "顶栏 / 页脚旁的品牌文字",
    min: 14,
    max: 32,
    cssVar: "--fs-brand",
  },
  {
    key: "heroTitle",
    label: "首页主标题",
    hint: "首页 Hero 大标题",
    min: 24,
    max: 56,
    cssVar: "--fs-hero-title",
  },
  {
    key: "heroSubtext",
    label: "首页副文案",
    hint: "主标题下方说明文字",
    min: 14,
    max: 24,
    cssVar: "--fs-hero-sub",
  },
  {
    key: "sectionTitle",
    label: "区块标题",
    hint: "「门户入口」「热门课程」等大标题",
    min: 18,
    max: 40,
    cssVar: "--fs-section-title",
  },
  {
    key: "sectionDesc",
    label: "区块说明",
    hint: "「门户入口」下方灰色说明等",
    min: 12,
    max: 20,
    cssVar: "--fs-section-desc",
  },
  {
    key: "portalCardTitle",
    label: "门户入口卡片标题",
    hint: "如「公司介绍」「网课资料」",
    min: 14,
    max: 28,
    cssVar: "--fs-portal-card-title",
  },
  {
    key: "portalCardDesc",
    label: "门户入口卡片说明",
    hint: "如「点击进入」「即将开放…」",
    min: 12,
    max: 20,
    cssVar: "--fs-portal-card-desc",
  },
  {
    key: "filterTag",
    label: "筛选标签",
    // 统一前台分类胶囊字号/字体，避免约搭/课程等各写死 text-sm 无法装扮
    hint: "约搭/课程/资料/商城等「全部、运动…」分类筛选胶囊",
    min: 12,
    max: 22,
    cssVar: "--fs-filter-tag",
  },
];

/** 可读性遮罩：叠在照片背景上，避免正文发花 */
const PHOTO_VEIL_LIGHT =
  "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.78) 42%, rgba(248,250,252,0.9) 100%)";
const PHOTO_VEIL_WARM =
  "linear-gradient(180deg, rgba(255,252,247,0.9) 0%, rgba(255,248,240,0.8) 45%, rgba(247,243,236,0.92) 100%)";
const PHOTO_VEIL_COOL =
  "linear-gradient(180deg, rgba(245,249,252,0.9) 0%, rgba(241,245,249,0.82) 48%, rgba(238,242,246,0.93) 100%)";
/**
 * 深色站专用遮罩：压暗保证浅色正文可读，但故意留透照片霓虹；
 * 多色径向光晕（青/品红/紫/橙/柠）避免「一片闷蓝黑」把五彩夜景洗成泥。
 */
const PHOTO_VEIL_CYBER =
  "linear-gradient(180deg, rgba(6,8,20,0.68) 0%, rgba(8,10,24,0.55) 36%, rgba(4,6,16,0.74) 100%), radial-gradient(ellipse 70% 48% at 8% -10%, rgba(34,211,238,0.38), transparent 56%), radial-gradient(ellipse 55% 40% at 92% 2%, rgba(232,121,249,0.32), transparent 54%), radial-gradient(ellipse 48% 34% at 72% 18%, rgba(168,85,247,0.22), transparent 52%), radial-gradient(ellipse 50% 32% at 48% 100%, rgba(251,146,60,0.2), transparent 55%), radial-gradient(ellipse 40% 28% at 22% 78%, rgba(163,230,53,0.14), transparent 50%)";

function photoLayers(imageUrl: string, veil = PHOTO_VEIL_LIGHT) {
  // 不用 background-attachment:fixed：微信内滚动会卡顿/闪烁
  return `${veil}, url("${imageUrl}") center / cover no-repeat`;
}

export const THEME_BACKGROUNDS: ThemeBackground[] = [
  {
    id: "soft-dawn",
    name: "柔光晨雾",
    kind: "gradient",
    preview:
      "radial-gradient(ellipse 80% 50% at 10% -10%, rgba(14,165,233,0.22), transparent 55%), linear-gradient(180deg,#fff,#f5f9fc 55%,#eef5fb)",
    layers:
      "radial-gradient(ellipse 80% 50% at 10% -10%, rgba(14, 165, 233, 0.14), transparent 55%), radial-gradient(ellipse 55% 38% at 88% 4%, rgba(244, 63, 94, 0.07), transparent 52%), radial-gradient(ellipse 45% 30% at 70% 100%, rgba(244, 63, 94, 0.04), transparent 55%), linear-gradient(180deg, #ffffff 0%, var(--bg) 45%, #eef5fb 100%)",
  },
  {
    id: "teal-mist",
    name: "青石薄雾",
    kind: "gradient",
    preview:
      "radial-gradient(ellipse at 20% 0%, rgba(15,118,110,0.28), transparent 50%), linear-gradient(180deg,#f8fffe,#e8f3f1)",
    layers:
      "radial-gradient(ellipse 70% 45% at 12% -8%, rgba(15, 118, 110, 0.16), transparent 55%), radial-gradient(ellipse 50% 35% at 90% 8%, rgba(234, 88, 12, 0.08), transparent 50%), linear-gradient(180deg, #ffffff 0%, var(--bg) 50%, #e6f2f0 100%)",
  },
  {
    id: "warm-paper",
    name: "暖纸纹理",
    kind: "gradient",
    preview:
      "radial-gradient(ellipse at 80% 0%, rgba(180,83,9,0.2), transparent 50%), linear-gradient(180deg,#fffaf3,#f3ebe0)",
    layers:
      "radial-gradient(ellipse 65% 40% at 85% 0%, rgba(180, 83, 9, 0.1), transparent 55%), radial-gradient(ellipse 50% 35% at 10% 100%, rgba(190, 18, 60, 0.06), transparent 55%), linear-gradient(180deg, #fffdf9 0%, var(--bg) 48%, #f0e8db 100%)",
  },
  {
    id: "slate-grid",
    name: "岩板网格",
    kind: "pattern",
    preview:
      "linear-gradient(90deg, rgba(51,65,85,0.08) 1px, transparent 1px), linear-gradient(rgba(51,65,85,0.08) 1px, transparent 1px), #f4f6f8",
    layers:
      "linear-gradient(180deg, rgba(255,255,255,0.75), rgba(244,246,248,0.92)), linear-gradient(90deg, rgba(51,65,85,0.045) 1px, transparent 1px) 0 0 / 28px 28px, linear-gradient(rgba(51,65,85,0.045) 1px, transparent 1px) 0 0 / 28px 28px, linear-gradient(180deg, #ffffff 0%, var(--bg) 100%)",
  },
  {
    id: "dot-mesh",
    name: "细点网格",
    kind: "pattern",
    preview:
      "radial-gradient(rgba(15,23,42,0.12) 1px, transparent 1px) 0 0 / 16px 16px, #f8fafc",
    layers:
      "radial-gradient(rgba(15, 23, 42, 0.06) 0.9px, transparent 1px) 0 0 / 18px 18px, linear-gradient(180deg, #ffffff 0%, var(--bg) 55%, var(--bg-deep) 100%)",
  },
  {
    id: "photo-seminar",
    name: "课堂研讨",
    kind: "photo",
    preview: 'url("/covers/hero-seminar.jpg") center/cover',
    layers: photoLayers("/covers/hero-seminar.jpg", PHOTO_VEIL_COOL),
  },
  {
    id: "photo-coworking",
    name: "联合办公",
    kind: "photo",
    preview: 'url("/covers/coworking.jpg") center/cover',
    layers: photoLayers("/covers/coworking.jpg", PHOTO_VEIL_LIGHT),
  },
  {
    id: "photo-desk",
    name: "书桌专注",
    kind: "photo",
    preview: 'url("/covers/desk-focus.jpg") center/cover',
    layers: photoLayers("/covers/desk-focus.jpg", PHOTO_VEIL_WARM),
  },
  {
    id: "photo-coding",
    name: "编程工作台",
    kind: "photo",
    preview: 'url("/covers/coding-desk.jpg") center/cover',
    layers: photoLayers("/covers/coding-desk.jpg", PHOTO_VEIL_COOL),
  },
  {
    id: "photo-students",
    name: "结伴学习",
    kind: "photo",
    preview: 'url("/covers/students-study.jpg") center/cover',
    layers: photoLayers("/covers/students-study.jpg", PHOTO_VEIL_LIGHT),
  },
  {
    id: "photo-ai",
    name: "科技光感",
    kind: "photo",
    preview: 'url("/covers/ai-tech.jpg") center/cover',
    layers: photoLayers("/covers/ai-tech.jpg", PHOTO_VEIL_COOL),
  },
  {
    // 大都会夜景专图：霓虹 + 无人机/飞碟/机器人；与浅色「科技光感」区分开
    id: "photo-cyber",
    name: "霓虹都会",
    kind: "photo",
    preview: 'url("/covers/cyber-metro-neon.png") center/cover',
    layers: photoLayers("/covers/cyber-metro-neon.png", PHOTO_VEIL_CYBER),
  },
  {
    id: "neon-night",
    name: "霓虹暗夜",
    kind: "gradient",
    preview:
      "radial-gradient(ellipse at 15% 0%, rgba(34,211,238,0.45), transparent 50%), radial-gradient(ellipse at 90% 20%, rgba(232,121,249,0.35), transparent 45%), linear-gradient(180deg,#0b1020,#060a14)",
    layers:
      "radial-gradient(ellipse 75% 48% at 10% -10%, rgba(34, 211, 238, 0.2), transparent 55%), radial-gradient(ellipse 55% 38% at 92% 6%, rgba(232, 121, 249, 0.14), transparent 52%), radial-gradient(ellipse 45% 30% at 70% 100%, rgba(34, 211, 238, 0.08), transparent 55%), linear-gradient(180deg, #0f172a 0%, var(--bg) 48%, #060a14 100%)",
  },
  {
    id: "photo-library",
    name: "暖光书廊",
    kind: "photo",
    // 复用本地 covers，避免依赖外链图床
    preview: 'url("/covers/desk-focus.jpg") center/cover',
    layers: photoLayers("/covers/desk-focus.jpg", PHOTO_VEIL_WARM),
  },
  {
    id: "photo-ocean",
    name: "青绿工坊",
    kind: "photo",
    preview: 'url("/covers/whiteboard-workshop.jpg") center/cover',
    layers: photoLayers("/covers/whiteboard-workshop.jpg", PHOTO_VEIL_COOL),
  },
  {
    id: "photo-mountains",
    name: "团队远景",
    kind: "photo",
    preview: 'url("/covers/team-collab.jpg") center/cover',
    layers: photoLayers("/covers/team-collab.jpg", PHOTO_VEIL_COOL),
  },
  {
    id: "photo-city",
    name: "商务天际",
    kind: "photo",
    preview: 'url("/covers/business-table.jpg") center/cover',
    layers: photoLayers("/covers/business-table.jpg", PHOTO_VEIL_LIGHT),
  },
  {
    id: "photo-meeting",
    name: "办公会议",
    kind: "photo",
    preview: 'url("/covers/office-meeting.jpg") center/cover',
    layers: photoLayers("/covers/office-meeting.jpg", PHOTO_VEIL_LIGHT),
  },
  {
    id: "photo-discuss",
    name: "小组讨论",
    kind: "photo",
    preview: 'url("/covers/team-discuss.jpg") center/cover',
    layers: photoLayers("/covers/team-discuss.jpg", PHOTO_VEIL_COOL),
  },
  // 扩展库：高端商务照片 + 渐变纹理（见 site-theme-backgrounds-extra.ts）
  ...EXTRA_THEME_BACKGROUNDS,
  // QQ 空间式梦幻光斑（七彩心晴同系）
  ...QZONE_THEME_BACKGROUNDS,
];

export const THEME_PACKS: ThemePack[] = [
  {
    id: "pack-sky-fresh",
    name: "清新天蓝",
    tagline: "默认明亮站风",
    paletteId: "sky-fresh",
    backgroundId: "soft-dawn",
    cover:
      "radial-gradient(ellipse at 20% 0%, rgba(14,165,233,0.35), transparent 55%), linear-gradient(160deg,#ffffff,#e0f2fe 60%,#fce7f3)",
  },
  {
    id: "pack-deep-teal",
    name: "深海青石",
    tagline: "机构感青绿",
    paletteId: "deep-teal",
    backgroundId: "teal-mist",
    cover:
      "radial-gradient(ellipse at 30% 10%, rgba(15,118,110,0.4), transparent 50%), linear-gradient(165deg,#ecfdf5,#99f6e4 70%,#ffedd5)",
  },
  {
    id: "pack-warm-ink",
    name: "暖墨书房",
    tagline: "纸感阅读风",
    paletteId: "warm-ink",
    backgroundId: "warm-paper",
    cover:
      "radial-gradient(ellipse at 70% 0%, rgba(180,83,9,0.35), transparent 50%), linear-gradient(165deg,#fffbeb,#fde68a 55%,#fecdd3)",
  },
  {
    id: "pack-cool-slate",
    name: "冷灰岩板",
    tagline: "克制现代感",
    paletteId: "cool-slate",
    backgroundId: "slate-grid",
    cover:
      "linear-gradient(145deg,#f8fafc,#cbd5e1 45%,#334155), linear-gradient(0deg,rgba(14,165,233,0.25),transparent)",
  },
  {
    id: "pack-seminar",
    name: "课堂现场",
    tagline: "研讨照片 + 天蓝",
    paletteId: "sky-fresh",
    backgroundId: "photo-seminar",
    cover: 'url("/covers/hero-seminar.jpg") center/cover',
  },
  {
    id: "pack-library",
    name: "书廊午后",
    tagline: "暖书桌 + 暖墨",
    paletteId: "warm-ink",
    backgroundId: "photo-library",
    cover: 'url("/covers/desk-focus.jpg") center/cover',
  },
  {
    id: "pack-ocean",
    name: "青绿工坊",
    tagline: "白板工坊 + 深青",
    paletteId: "deep-teal",
    backgroundId: "photo-ocean",
    cover: 'url("/covers/whiteboard-workshop.jpg") center/cover',
  },
  {
    id: "pack-coding",
    name: "工位夜色",
    tagline: "编程台 + 冷灰",
    paletteId: "cool-slate",
    backgroundId: "photo-coding",
    cover: 'url("/covers/coding-desk.jpg") center/cover',
  },
  {
    id: "pack-cyber-neon",
    name: "赛博霓虹",
    tagline: "大都会夜景 · 五彩霓虹 · 无人机·飞碟·机器人",
    paletteId: "cyber-neon",
    backgroundId: "photo-cyber",
    cover:
      'radial-gradient(ellipse at 12% 0%, rgba(34,211,238,0.5), transparent 48%), radial-gradient(ellipse at 88% 18%, rgba(232,121,249,0.42), transparent 46%), radial-gradient(ellipse at 55% 100%, rgba(251,146,60,0.28), transparent 50%), url("/covers/cyber-metro-neon.png") center/cover',
  },
  {
    id: "pack-forest",
    name: "苔原绿意",
    tagline: "自然安静",
    paletteId: "forest-moss",
    backgroundId: "dot-mesh",
    cover:
      "radial-gradient(ellipse at 25% 0%, rgba(77,124,15,0.35), transparent 55%), linear-gradient(160deg,#f7fee7,#bbf7d0 60%,#fed7aa)",
  },
  {
    id: "pack-mountains",
    name: "协作远景",
    tagline: "团队照 + 石墨玫",
    paletteId: "rose-graphite",
    backgroundId: "photo-mountains",
    cover: 'url("/covers/team-collab.jpg") center/cover',
  },
  {
    id: "pack-meeting",
    name: "商务圆桌",
    tagline: "会议照 + 冷灰",
    paletteId: "cool-slate",
    backgroundId: "photo-meeting",
    cover: 'url("/covers/office-meeting.jpg") center/cover',
  },
  // 亮眼新配色的少量一键包（不必每套配色都有包）
  {
    id: "pack-sunset-coral",
    name: "日落珊瑚",
    tagline: "暖纸 + 珊瑚橙粉",
    paletteId: "sunset-coral",
    backgroundId: "warm-paper",
    cover:
      "radial-gradient(ellipse at 80% 0%, rgba(249,115,22,0.4), transparent 50%), linear-gradient(165deg,#fff7f5,#ffedd5 55%,#fecdd3)",
  },
  {
    id: "pack-champagne",
    name: "香槟金箔",
    tagline: "暖纸 + 香槟金",
    paletteId: "champagne-gold",
    backgroundId: "warm-paper",
    cover:
      "radial-gradient(ellipse at 30% 0%, rgba(180,83,9,0.35), transparent 55%), linear-gradient(160deg,#fbf8f2,#f0e6d2 60%,#fce7f3)",
  },
  {
    id: "pack-festive",
    name: "吉庆红金",
    tagline: "晨雾底 + 节庆红金",
    paletteId: "fest-red-gold",
    backgroundId: "soft-dawn",
    cover:
      "radial-gradient(ellipse at 20% 0%, rgba(220,38,38,0.35), transparent 50%), linear-gradient(160deg,#fff8f5,#fee2e2 55%,#fef3c7)",
  },
  {
    id: "pack-latte",
    name: "拿铁奶泡",
    tagline: "暖纸 + 奶杏拿铁",
    paletteId: "latte-foam",
    backgroundId: "warm-paper",
    cover:
      "radial-gradient(ellipse at 70% 10%, rgba(161,98,7,0.3), transparent 50%), linear-gradient(165deg,#faf7f2,#f0e6d8 60%,#dcecea)",
  },
  {
    id: "pack-mint",
    name: "春日薄荷",
    tagline: "细点网格 + 薄荷绿",
    paletteId: "spring-mint",
    backgroundId: "dot-mesh",
    cover:
      "radial-gradient(ellipse at 25% 0%, rgba(16,185,129,0.35), transparent 55%), linear-gradient(160deg,#f4fdf8,#d1fae5 60%,#fce7f3)",
  },
  {
    id: "pack-matrix",
    name: "矩阵荧绿",
    tagline: "霓虹暗夜 + 矩阵绿",
    paletteId: "matrix-green",
    backgroundId: "neon-night",
    cover:
      "radial-gradient(ellipse at 20% 0%, rgba(34,197,94,0.4), transparent 50%), linear-gradient(180deg,#07140c,#030a06)",
  },
  ...EXTRA_THEME_PACKS,
  // QQ 空间装扮一键包（站长在「一键主题」里选）
  ...QZONE_THEME_PACKS,
];

export const LAYOUT_DENSITIES: {
  id: LayoutDensity;
  name: string;
  tagline: string;
}[] = [
  { id: "default", name: "标准", tagline: "默认圆角与间距" },
  { id: "compact", name: "紧凑", tagline: "信息更密，适合内容站" },
  { id: "airy", name: "留白", tagline: "更松的呼吸感" },
];

export function paletteById(id: string | null | undefined) {
  return (
    THEME_PALETTES.find((p) => p.id === id) ||
    THEME_PALETTES.find((p) => p.id === DEFAULT_PALETTE_ID)!
  );
}

export function backgroundById(id: string | null | undefined) {
  return (
    THEME_BACKGROUNDS.find((b) => b.id === id) ||
    THEME_BACKGROUNDS.find((b) => b.id === DEFAULT_BACKGROUND_ID)!
  );
}

export function themePackById(id: string | null | undefined) {
  return THEME_PACKS.find((p) => p.id === id) || null;
}

export function normalizeLayoutDensity(
  value: string | null | undefined,
): LayoutDensity {
  if (value === "compact" || value === "airy" || value === "default") {
    return value;
  }
  return DEFAULT_LAYOUT_DENSITY;
}

function clampFontSize(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** 解析/校正站长字号配置；缺字段或脏数据回退默认 */
export function normalizeFontSizes(
  value: Partial<FontSizesConfig> | null | undefined,
): FontSizesConfig {
  const next = { ...DEFAULT_FONT_SIZES };
  if (!value || typeof value !== "object") return next;
  for (const field of FONT_SIZE_FIELDS) {
    next[field.key] = clampFontSize(
      value[field.key],
      field.min,
      field.max,
      DEFAULT_FONT_SIZES[field.key],
    );
  }
  return next;
}

/** 把装扮选择写成可挂到 <html style> 的 CSS 变量 */
export function buildThemeStyleVars(input: {
  paletteId?: string | null;
  backgroundId?: string | null;
  layoutDensity?: string | null;
  fontSizes?: Partial<FontSizesConfig> | null;
  /** 可选：合并 --ff-*；由调用方传入避免与 site-typography 循环依赖 */
  fontFamilyVars?: Record<string, string> | null;
}): Record<string, string> {
  const palette = paletteById(input.paletteId);
  const background = backgroundById(input.backgroundId);
  const density = normalizeLayoutDensity(input.layoutDensity);
  const fontSizes = normalizeFontSizes(input.fontSizes);
  const t = palette.tokens;

  // 版式只做轻量密度：圆角与卡片内边距，不动整站结构
  const radius =
    density === "compact" ? "18px" : density === "airy" ? "32px" : "28px";
  const surfacePad =
    density === "compact" ? "1.1rem" : density === "airy" ? "1.85rem" : "1.5rem";

  const fontVars: Record<string, string> = {};
  for (const field of FONT_SIZE_FIELDS) {
    fontVars[field.cssVar] = `${fontSizes[field.key]}px`;
    // 无排版配置时给 --ff-* 合理回退，避免 var() 空值
    const ffVar = field.cssVar.replace("--fs-", "--ff-");
    fontVars[ffVar] = "var(--font-body)";
  }

  return {
    "--bg": t.bg,
    "--bg-deep": t.bgDeep,
    "--ink": t.ink,
    "--muted": t.muted,
    "--line": t.line,
    "--brand": t.brand,
    "--brand-strong": t.brandStrong,
    "--brand-soft": t.brandSoft,
    "--fire": t.fire,
    "--fire-strong": t.fireStrong,
    "--fire-soft": t.fireSoft,
    "--accent": t.fire,
    "--accent-soft": t.fireSoft,
    "--card": t.card,
    "--shadow": t.shadow,
    "--site-bg-layers": background.layers,
    "--surface-radius": radius,
    "--surface-pad": surfacePad,
    ...fontVars,
    ...(input.fontFamilyVars || {}),
  };
}

/** 在浏览器里试穿：写到 documentElement，返回恢复函数 */
export function applyThemePreview(vars: Record<string, string>) {
  if (typeof document === "undefined") return () => {};
  const root = document.documentElement;
  const previous = new Map<string, string>();
  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, root.style.getPropertyValue(key));
    root.style.setProperty(key, value);
  }
  return () => {
    for (const [key, old] of previous) {
      if (old) root.style.setProperty(key, old);
      else root.style.removeProperty(key);
    }
  };
}

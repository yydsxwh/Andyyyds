/**
 * 热带海岛 / 阳光沙滩装扮包（仿 QQ 空间黄钻唯美风）。
 * 图源：Unsplash 可商用摄影，本地落盘 public/themes/islands/（见 scripts/fetch_island_theme_assets.py）。
 * 动效：CSS 级光斑/海浪/阳光粒子，挂 data-theme-fx；prefers-reduced-motion 时关闭。
 */

import type { ThemeBackground, ThemePack } from "./site-theme";

/** 装扮面板「一键装扮」分组：海岛/阳光 */
export const ISLAND_PACK_CATEGORY = "island" as const;

/** 海岛主题动效 id（与 globals.css [data-theme-fx] 对齐） */
export type IslandThemeFx =
  | "island-sunbeam"
  | "island-wave"
  | "island-palm"
  | "island-sparkle"
  | "island-breath"
  | "island-lagoon";

/** 浅色可读遮罩：压住高饱和海景，保证微信内正文清晰 */
const VEIL_SUN =
  "linear-gradient(180deg, rgba(255,252,245,0.86) 0%, rgba(255,248,235,0.72) 38%, rgba(240,249,255,0.9) 100%)";
const VEIL_LAGOON =
  "linear-gradient(180deg, rgba(240,253,250,0.88) 0%, rgba(236,254,255,0.74) 42%, rgba(236,254,255,0.92) 100%)";
const VEIL_SAND =
  "linear-gradient(180deg, rgba(255,251,235,0.9) 0%, rgba(255,247,237,0.76) 45%, rgba(255,252,247,0.93) 100%)";
const VEIL_SKY =
  "linear-gradient(180deg, rgba(240,249,255,0.88) 0%, rgba(224,242,254,0.72) 40%, rgba(248,250,252,0.92) 100%)";

function photoLayers(imageUrl: string, veil: string) {
  // 不用 background-attachment:fixed：微信内滚动会卡顿/闪烁
  return `${veil}, url("${imageUrl}") center / cover no-repeat`;
}

/**
 * 静态资源版本号：换图或修错绑后递增，避免浏览器/微信强缓存旧 bg。
 * 仅影响 query，不改文件名。
 */
const ISLAND_ASSET_VERSION = "20260808a";

function islandUrl(file: string) {
  return `/themes/islands/${file}?v=${ISLAND_ASSET_VERSION}`;
}

type IslandDef = {
  slug: string;
  name: string;
  tagline: string;
  /**
   * 背景文件名（与 cover 保持同图；展示层实际用 coverFile，
   * bg 仅作磁盘/旧路径兜底，见 ISLAND_THEME_BACKGROUNDS）。
   */
  bgFile: string;
  /** 一键装扮缩略图 + 全站背景主视觉（同源） */
  coverFile: string;
  veil: string;
  fx: IslandThemeFx;
  /** 配色 id，与 palettes 中 island-* 对齐 */
  paletteId: string;
};

/**
 * 20 套独立海岛意象：封面/背景均经目视核对，须同时含
 * 热带岛滩 + 晴天阳光 + 椰/棕榈 + 清澈果冻海（Tiffany/碧绿浅海）。
 * 图源 Unsplash/Pexels，落盘见 fetch 脚本；禁止圣托里尼/山湖/纯水下错配。
 */
const ISLAND_DEFS: IslandDef[] = [
  {
    slug: "maldives",
    name: "马尔代夫晴空",
    tagline: "椰影水屋 · 果冻泻湖 · 阳光金沙",
    bgFile: "maldives-bg.jpg",
    coverFile: "maldives-cover.jpg",
    veil: VEIL_LAGOON,
    fx: "island-lagoon",
    paletteId: "island-maldives",
  },
  {
    slug: "seychelles",
    name: "塞舌尔碧湾",
    tagline: "椰林白沙 · 翡翠浅滩 · 明媚果冻海",
    bgFile: "seychelles-bg.jpg",
    coverFile: "seychelles-cover.jpg",
    veil: VEIL_SKY,
    fx: "island-wave",
    paletteId: "island-seychelles",
  },
  {
    slug: "okinawa",
    name: "冲绳椰风",
    tagline: "琉球椰林 · 入海晴日 · 玻璃浅湾",
    bgFile: "okinawa-bg.jpg",
    coverFile: "okinawa-cover.jpg",
    veil: VEIL_SUN,
    fx: "island-palm",
    paletteId: "island-okinawa",
  },
  {
    slug: "bali",
    name: "巴厘岛暖沙",
    tagline: "椰冠俯瞰 · 蒂芙尼海 · 南岛暖阳",
    bgFile: "bali-bg.jpg",
    coverFile: "bali-cover.jpg",
    veil: VEIL_SAND,
    fx: "island-sunbeam",
    paletteId: "island-bali",
  },
  {
    slug: "hawaii",
    name: "夏威夷金晖",
    tagline: "椰影金晖 · 透蓝浅海 · 太平洋晴空",
    bgFile: "hawaii-bg.jpg",
    coverFile: "hawaii-cover.jpg",
    veil: VEIL_SUN,
    fx: "island-sparkle",
    paletteId: "island-hawaii",
  },
  {
    slug: "phuket",
    name: "普吉蓝梦",
    tagline: "椰林长滩 · 碧湾果冻海 · 安达曼晴日",
    bgFile: "phuket-bg.jpg",
    coverFile: "phuket-cover.jpg",
    veil: VEIL_SKY,
    fx: "island-wave",
    paletteId: "island-phuket",
  },
  {
    slug: "fiji",
    name: "斐济珊瑚礁",
    tagline: "环礁椰岛 · 清澈见底 · 南太果冻海",
    bgFile: "fiji-bg.jpg",
    coverFile: "fiji-cover.jpg",
    veil: VEIL_LAGOON,
    fx: "island-lagoon",
    paletteId: "island-fiji",
  },
  {
    slug: "tahiti",
    name: "大溪地椰湾",
    tagline: "波利尼西亚椰影 · 碧透浅滩 · 阳光白沙",
    bgFile: "tahiti-bg.jpg",
    coverFile: "tahiti-cover.jpg",
    veil: VEIL_SUN,
    fx: "island-breath",
    paletteId: "island-tahiti",
  },
  {
    slug: "borabora",
    name: "波拉波拉泻湖",
    tagline: "峰影椰岸 · 松石泻湖 · 玻璃海水",
    bgFile: "borabora-bg.jpg",
    coverFile: "borabora-cover.jpg",
    veil: VEIL_LAGOON,
    fx: "island-lagoon",
    paletteId: "island-borabora",
  },
  {
    slug: "sanya",
    name: "三亚椰影",
    tagline: "椰林银滩 · 南海晴空 · 果冻浅海",
    bgFile: "sanya-bg.jpg",
    coverFile: "sanya-cover.jpg",
    veil: VEIL_SUN,
    fx: "island-palm",
    paletteId: "island-sanya",
  },
  {
    slug: "mauritius",
    name: "毛里求斯蜜湾",
    tagline: "蜜沙椰影 · 双色海水 · 印度洋果冻湾",
    bgFile: "mauritius-bg.jpg",
    coverFile: "mauritius-cover.jpg",
    veil: VEIL_SAND,
    fx: "island-sunbeam",
    paletteId: "island-mauritius",
  },
  {
    slug: "boracay",
    name: "长滩岛晴浪",
    tagline: "粉末细沙 · 椰影晴空 · 透蓝果冻海",
    bgFile: "boracay-bg.jpg",
    coverFile: "boracay-cover.jpg",
    veil: VEIL_SKY,
    fx: "island-wave",
    paletteId: "island-boracay",
  },
  {
    slug: "palau",
    name: "帕劳翡翠海",
    tagline: "椰岛环礁 · 翡翠浅湖 · 秘境清透",
    bgFile: "palau-bg.jpg",
    coverFile: "palau-cover.jpg",
    veil: VEIL_LAGOON,
    fx: "island-breath",
    paletteId: "island-palau",
  },
  {
    slug: "cozumel",
    name: "科苏梅尔蓝岸",
    tagline: "加勒比椰影 · 阳光白沙 · 蒂芙尼浅海",
    bgFile: "cozumel-bg.jpg",
    coverFile: "cozumel-cover.jpg",
    veil: VEIL_SKY,
    fx: "island-sparkle",
    paletteId: "island-cozumel",
  },
  {
    slug: "samui",
    name: "苏梅岛晨光",
    tagline: "暹罗湾椰影 · 玻璃浅湾 · 明媚暖沙",
    bgFile: "samui-bg.jpg",
    coverFile: "samui-cover.jpg",
    veil: VEIL_SUN,
    fx: "island-sunbeam",
    paletteId: "island-samui",
  },
  {
    slug: "langkawi",
    name: "兰卡威潮音",
    tagline: "安达曼椰岸 · 果冻浅滩 · 绿屿晴空",
    bgFile: "langkawi-bg.jpg",
    coverFile: "langkawi-cover.jpg",
    veil: VEIL_LAGOON,
    fx: "island-wave",
    paletteId: "island-langkawi",
  },
  {
    slug: "guam",
    name: "关岛碧波",
    tagline: "西太椰湾 · 透蓝玻璃海 · 热带晴岸",
    bgFile: "guam-bg.jpg",
    coverFile: "guam-cover.jpg",
    veil: VEIL_SKY,
    fx: "island-lagoon",
    paletteId: "island-guam",
  },
  {
    slug: "kauai",
    name: "考艾绿崖湾",
    tagline: "椰影入海 · 翠绿浅湾 · 彩虹晴空",
    bgFile: "kauai-bg.jpg",
    coverFile: "kauai-cover.jpg",
    veil: VEIL_SUN,
    fx: "island-palm",
    paletteId: "island-kauai",
  },
  {
    slug: "andaman",
    name: "安达曼珍珠湾",
    tagline: "珍珠白湾 · 椰影泻湖 · 原始果冻海",
    bgFile: "andaman-bg.jpg",
    coverFile: "andaman-cover.jpg",
    veil: VEIL_SAND,
    fx: "island-breath",
    paletteId: "island-andaman",
  },
  {
    slug: "aruba",
    name: "阿鲁巴蒂芙尼",
    tagline: "加勒比椰影 · 蒂芙尼蓝海 · 阳光白沙",
    bgFile: "aruba-bg.jpg",
    coverFile: "aruba-cover.jpg",
    veil: VEIL_SKY,
    fx: "island-sparkle",
    paletteId: "island-aruba",
  },
];

/** backgroundId → 动效；供 layout / 试穿同步 data-theme-fx */
export const ISLAND_BG_FX: Record<string, IslandThemeFx> = Object.fromEntries(
  ISLAND_DEFS.map((d) => [`island-bg-${d.slug}`, d.fx]),
);

export function islandFxForBackgroundId(
  backgroundId: string | null | undefined,
): IslandThemeFx | null {
  if (!backgroundId) return null;
  return ISLAND_BG_FX[backgroundId] ?? null;
}

/** 解析应挂到 html[data-theme-fx] 的动效 id（包优先，其次背景） */
export function resolveThemeFx(input: {
  themePackId?: string | null;
  backgroundId?: string | null;
  packFx?: string | null;
}): string {
  if (input.packFx) return input.packFx;
  return islandFxForBackgroundId(input.backgroundId) || "";
}

export const ISLAND_THEME_BACKGROUNDS: ThemeBackground[] = ISLAND_DEFS.map(
  (d) => {
    // 根因修复：封面缩略图与全站背景必须同源。
    // 先前 preview 用 cover、layers 用 bg，两套摄影画面差太大（如波拉波拉封面是峰影椰岸，
    // 背景却是另一座环礁航拍），用户会感觉「点选与实际主题不一致」。
    const displayUrl = islandUrl(d.coverFile);
    return {
      id: `island-bg-${d.slug}`,
      name: d.name,
      kind: "photo" as const,
      preview: `url("${displayUrl}") center/cover`,
      layers: photoLayers(displayUrl, d.veil),
    };
  },
);

export const ISLAND_THEME_PACKS: ThemePack[] = ISLAND_DEFS.map((d) => ({
  id: `pack-island-${d.slug}`,
  name: d.name,
  tagline: d.tagline,
  paletteId: d.paletteId,
  backgroundId: `island-bg-${d.slug}`,
  cover: `url("${islandUrl(d.coverFile)}") center/cover`,
  category: ISLAND_PACK_CATEGORY,
  fx: d.fx,
}));

/** 交付用：主题名称列表 */
export const ISLAND_THEME_NAMES = ISLAND_DEFS.map((d) => d.name);

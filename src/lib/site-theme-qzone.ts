/**
 * QQ 空间式装扮：仿「七彩心晴」的梦幻光斑背景 + 一键主题包。
 * 纯 CSS 渐变/光斑，不依赖外链图，微信内可读性靠浅色半透明遮罩保证。
 */

import type { ThemeBackground, ThemePack } from "./site-theme";

/** 多层径向光斑，模拟空间装扮的 bokeh 氛围 */
function bokehLayers(stops: string[], base: string) {
  return [...stops, base].join(", ");
}

const VEIL =
  "linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.72) 40%, rgba(255,252,255,0.88) 100%)";

export const QZONE_THEME_BACKGROUNDS: ThemeBackground[] = [
  {
    id: "qzone-bg-rainbow-sunny",
    name: "七彩心晴",
    kind: "gradient",
    preview:
      "radial-gradient(circle at 20% 30%, rgba(251,113,133,0.55), transparent 28%), radial-gradient(circle at 70% 20%, rgba(250,204,21,0.45), transparent 26%), radial-gradient(circle at 85% 60%, rgba(56,189,248,0.5), transparent 30%), radial-gradient(circle at 40% 75%, rgba(167,139,250,0.4), transparent 28%), linear-gradient(165deg,#fff5fa,#ffe4f0 50%,#e0f2fe)",
    layers: bokehLayers(
      [
        VEIL,
        "radial-gradient(circle 180px at 12% 18%, rgba(251,113,133,0.38), transparent 60%)",
        "radial-gradient(circle 220px at 78% 12%, rgba(250,204,21,0.32), transparent 58%)",
        "radial-gradient(circle 200px at 88% 58%, rgba(56,189,248,0.34), transparent 60%)",
        "radial-gradient(circle 160px at 28% 78%, rgba(167,139,250,0.28), transparent 58%)",
        "radial-gradient(circle 120px at 55% 40%, rgba(52,211,153,0.22), transparent 55%)",
        "radial-gradient(circle 90px at 65% 85%, rgba(255,255,255,0.7), transparent 60%)",
        "radial-gradient(circle 70px at 35% 25%, rgba(255,255,255,0.55), transparent 55%)",
      ],
      "linear-gradient(165deg, #fff9fc 0%, var(--bg) 48%, #e0f2fe 100%)",
    ),
  },
  {
    id: "qzone-bg-dandelion",
    name: "蒲公英微风",
    kind: "gradient",
    preview:
      "radial-gradient(circle at 30% 40%, rgba(254,240,138,0.6), transparent 30%), radial-gradient(circle at 70% 20%, rgba(190,242,100,0.5), transparent 28%), linear-gradient(180deg,#f7fcf4,#e8f5d8)",
    layers: bokehLayers(
      [
        VEIL,
        "radial-gradient(circle 200px at 18% 22%, rgba(254,240,138,0.45), transparent 60%)",
        "radial-gradient(circle 180px at 82% 16%, rgba(190,242,100,0.35), transparent 58%)",
        "radial-gradient(circle 140px at 60% 70%, rgba(255,255,255,0.65), transparent 55%)",
        "radial-gradient(circle 100px at 40% 55%, rgba(163,230,53,0.22), transparent 55%)",
      ],
      "linear-gradient(180deg, #f7fcf4 0%, var(--bg) 50%, #e3f5d8 100%)",
    ),
  },
  {
    id: "qzone-bg-starry",
    name: "星空软糖",
    kind: "gradient",
    preview:
      "radial-gradient(circle at 20% 20%, rgba(196,181,253,0.55), transparent 28%), radial-gradient(circle at 80% 40%, rgba(244,114,182,0.35), transparent 30%), linear-gradient(180deg,#f7f4ff,#ddd6fe)",
    layers: bokehLayers(
      [
        VEIL,
        "radial-gradient(circle 210px at 15% 15%, rgba(196,181,253,0.4), transparent 60%)",
        "radial-gradient(circle 160px at 85% 35%, rgba(244,114,182,0.28), transparent 58%)",
        "radial-gradient(circle 8px at 30% 40%, rgba(255,255,255,0.95), transparent 70%)",
        "radial-gradient(circle 6px at 55% 25%, rgba(255,255,255,0.9), transparent 70%)",
        "radial-gradient(circle 5px at 72% 60%, rgba(255,255,255,0.85), transparent 70%)",
        "radial-gradient(circle 7px at 42% 72%, rgba(253,224,71,0.7), transparent 70%)",
      ],
      "linear-gradient(180deg, #f7f4ff 0%, var(--bg) 48%, #e9e0ff 100%)",
    ),
  },
  {
    id: "qzone-bg-sakura",
    name: "樱花春语",
    kind: "gradient",
    preview:
      "radial-gradient(circle at 25% 30%, rgba(251,113,133,0.45), transparent 28%), radial-gradient(circle at 75% 20%, rgba(249,168,212,0.5), transparent 30%), linear-gradient(180deg,#fff7fa,#ffe4ef)",
    layers: bokehLayers(
      [
        VEIL,
        "radial-gradient(circle 190px at 20% 20%, rgba(251,113,133,0.32), transparent 60%)",
        "radial-gradient(circle 170px at 80% 18%, rgba(249,168,212,0.38), transparent 58%)",
        "radial-gradient(circle 110px at 50% 65%, rgba(255,255,255,0.7), transparent 55%)",
        "radial-gradient(circle 90px at 35% 80%, rgba(253,164,175,0.25), transparent 55%)",
      ],
      "linear-gradient(180deg, #fff7fa 0%, var(--bg) 50%, #ffe4ef 100%)",
    ),
  },
  {
    id: "qzone-bg-soda",
    name: "夏日汽水",
    kind: "gradient",
    preview:
      "radial-gradient(circle at 30% 40%, rgba(125,211,252,0.55), transparent 28%), radial-gradient(circle at 70% 25%, rgba(254,240,138,0.45), transparent 26%), linear-gradient(180deg,#f4fbff,#bae6fd)",
    layers: bokehLayers(
      [
        VEIL,
        "radial-gradient(circle 200px at 22% 28%, rgba(125,211,252,0.4), transparent 60%)",
        "radial-gradient(circle 150px at 78% 18%, rgba(254,240,138,0.35), transparent 58%)",
        "radial-gradient(circle 40px at 45% 55%, rgba(255,255,255,0.75), transparent 60%)",
        "radial-gradient(circle 28px at 62% 70%, rgba(255,255,255,0.65), transparent 60%)",
        "radial-gradient(circle 22px at 33% 75%, rgba(186,230,253,0.55), transparent 60%)",
      ],
      "linear-gradient(180deg, #f4fbff 0%, var(--bg) 48%, #d9f2ff 100%)",
    ),
  },
  {
    id: "qzone-bg-autumn",
    name: "秋叶呢喃",
    kind: "gradient",
    preview:
      "radial-gradient(circle at 35% 25%, rgba(251,146,60,0.5), transparent 30%), radial-gradient(circle at 75% 50%, rgba(248,113,113,0.35), transparent 28%), linear-gradient(180deg,#fff8f2,#ffedd5)",
    layers: bokehLayers(
      [
        VEIL,
        "radial-gradient(circle 200px at 25% 18%, rgba(251,146,60,0.36), transparent 60%)",
        "radial-gradient(circle 170px at 80% 45%, rgba(248,113,113,0.28), transparent 58%)",
        "radial-gradient(circle 130px at 50% 75%, rgba(253,230,138,0.3), transparent 55%)",
        "radial-gradient(circle 90px at 15% 70%, rgba(255,255,255,0.6), transparent 55%)",
      ],
      "linear-gradient(180deg, #fff8f2 0%, var(--bg) 50%, #ffe8d4 100%)",
    ),
  },
  {
    id: "qzone-bg-ocean",
    name: "海洋梦境",
    kind: "gradient",
    preview:
      "radial-gradient(circle at 40% 20%, rgba(45,212,191,0.45), transparent 30%), radial-gradient(circle at 80% 60%, rgba(56,189,248,0.4), transparent 28%), linear-gradient(180deg,#f2fbfb,#ccfbf1)",
    layers: bokehLayers(
      [
        VEIL,
        "radial-gradient(circle 210px at 30% 15%, rgba(45,212,191,0.34), transparent 60%)",
        "radial-gradient(circle 180px at 85% 55%, rgba(56,189,248,0.3), transparent 58%)",
        "radial-gradient(ellipse 80% 40% at 50% 100%, rgba(165,243,252,0.35), transparent 55%)",
        "radial-gradient(circle 100px at 20% 60%, rgba(255,255,255,0.65), transparent 55%)",
      ],
      "linear-gradient(180deg, #f2fbfb 0%, var(--bg) 48%, #d0f0f2 100%)",
    ),
  },
  {
    id: "qzone-bg-candy",
    name: "棉花糖云",
    kind: "gradient",
    preview:
      "radial-gradient(circle at 25% 35%, rgba(244,114,182,0.5), transparent 30%), radial-gradient(circle at 70% 25%, rgba(216,180,254,0.55), transparent 32%), linear-gradient(180deg,#fff5fb,#f5d0fe)",
    layers: bokehLayers(
      [
        VEIL,
        "radial-gradient(circle 220px at 18% 30%, rgba(244,114,182,0.36), transparent 60%)",
        "radial-gradient(circle 200px at 75% 22%, rgba(216,180,254,0.4), transparent 58%)",
        "radial-gradient(circle 150px at 55% 70%, rgba(255,255,255,0.75), transparent 55%)",
        "radial-gradient(circle 110px at 85% 75%, rgba(249,168,212,0.3), transparent 55%)",
      ],
      "linear-gradient(180deg, #fff5fb 0%, var(--bg) 50%, #f5e0ff 100%)",
    ),
  },
  {
    id: "qzone-bg-plane",
    name: "纸飞机旅行",
    kind: "gradient",
    preview:
      "radial-gradient(circle at 50% 20%, rgba(147,197,253,0.5), transparent 35%), linear-gradient(180deg,#f5faff,#bfdbfe)",
    layers: bokehLayers(
      [
        VEIL,
        "radial-gradient(ellipse 90% 50% at 50% -10%, rgba(147,197,253,0.4), transparent 55%)",
        "radial-gradient(circle 120px at 70% 55%, rgba(255,255,255,0.7), transparent 55%)",
        "radial-gradient(circle 80px at 25% 65%, rgba(191,219,254,0.45), transparent 55%)",
        "radial-gradient(circle 16px at 40% 45%, rgba(255,255,255,0.9), transparent 60%)",
      ],
      "linear-gradient(180deg, #f5faff 0%, var(--bg) 48%, #dcecfe 100%)",
    ),
  },
  {
    id: "qzone-bg-rain",
    name: "彩虹雨窗",
    kind: "gradient",
    preview:
      "linear-gradient(90deg,rgba(248,113,113,0.25),rgba(250,204,21,0.25),rgba(74,222,128,0.25),rgba(56,189,248,0.25),rgba(167,139,250,0.25)), linear-gradient(180deg,#f4f7fb,#e2e8f0)",
    layers: bokehLayers(
      [
        VEIL,
        "linear-gradient(90deg, rgba(248,113,113,0.12) 0%, rgba(250,204,21,0.1) 20%, rgba(74,222,128,0.1) 40%, rgba(56,189,248,0.12) 60%, rgba(167,139,250,0.12) 80%, rgba(244,114,182,0.1) 100%)",
        "radial-gradient(circle 140px at 30% 40%, rgba(255,255,255,0.7), transparent 55%)",
        "radial-gradient(circle 100px at 70% 60%, rgba(199,210,254,0.35), transparent 55%)",
        "radial-gradient(circle 60px at 50% 25%, rgba(255,255,255,0.55), transparent 55%)",
      ],
      "linear-gradient(180deg, #f4f7fb 0%, var(--bg) 50%, #e2eaf4 100%)",
    ),
  },
];

export const QZONE_THEME_PACKS: ThemePack[] = [
  {
    id: "pack-qzone-rainbow-sunny",
    name: "七彩心晴",
    tagline: "仿 QQ 空间同名装扮 · 彩虹光斑",
    paletteId: "qzone-rainbow-sunny",
    backgroundId: "qzone-bg-rainbow-sunny",
    category: "qzone",
    cover:
      "radial-gradient(circle at 20% 30%, rgba(251,113,133,0.55), transparent 28%), radial-gradient(circle at 70% 20%, rgba(250,204,21,0.45), transparent 26%), radial-gradient(circle at 85% 60%, rgba(56,189,248,0.5), transparent 30%), linear-gradient(165deg,#fff5fa,#ffe4f0 50%,#e0f2fe)",
  },
  {
    id: "pack-qzone-dandelion",
    name: "蒲公英微风",
    tagline: "浅绿田野 · 金色光斑",
    paletteId: "qzone-dandelion",
    backgroundId: "qzone-bg-dandelion",
    category: "qzone",
    cover:
      "radial-gradient(circle at 30% 40%, rgba(254,240,138,0.6), transparent 30%), radial-gradient(circle at 70% 20%, rgba(190,242,100,0.5), transparent 28%), linear-gradient(180deg,#f7fcf4,#e8f5d8)",
  },
  {
    id: "pack-qzone-starry",
    name: "星空软糖",
    tagline: "薰衣草紫空 · 星点闪烁",
    paletteId: "qzone-starry-pastel",
    backgroundId: "qzone-bg-starry",
    category: "qzone",
    cover:
      "radial-gradient(circle at 20% 20%, rgba(196,181,253,0.55), transparent 28%), radial-gradient(circle at 80% 40%, rgba(244,114,182,0.35), transparent 30%), linear-gradient(180deg,#f7f4ff,#ddd6fe)",
  },
  {
    id: "pack-qzone-sakura",
    name: "樱花春语",
    tagline: "粉瓣春光 · 温柔浪漫",
    paletteId: "qzone-sakura",
    backgroundId: "qzone-bg-sakura",
    category: "qzone",
    cover:
      "radial-gradient(circle at 25% 30%, rgba(251,113,133,0.45), transparent 28%), radial-gradient(circle at 75% 20%, rgba(249,168,212,0.5), transparent 30%), linear-gradient(180deg,#fff7fa,#ffe4ef)",
  },
  {
    id: "pack-qzone-soda",
    name: "夏日汽水",
    tagline: "冰蓝柠檬 · 气泡清爽",
    paletteId: "qzone-summer-soda",
    backgroundId: "qzone-bg-soda",
    category: "qzone",
    cover:
      "radial-gradient(circle at 30% 40%, rgba(125,211,252,0.55), transparent 28%), radial-gradient(circle at 70% 25%, rgba(254,240,138,0.45), transparent 26%), linear-gradient(180deg,#f4fbff,#bae6fd)",
  },
  {
    id: "pack-qzone-autumn",
    name: "秋叶呢喃",
    tagline: "暖橙枫意 · 午后光漏",
    paletteId: "qzone-autumn-whisper",
    backgroundId: "qzone-bg-autumn",
    category: "qzone",
    cover:
      "radial-gradient(circle at 35% 25%, rgba(251,146,60,0.5), transparent 30%), radial-gradient(circle at 75% 50%, rgba(248,113,113,0.35), transparent 28%), linear-gradient(180deg,#fff8f2,#ffedd5)",
  },
  {
    id: "pack-qzone-ocean",
    name: "海洋梦境",
    tagline: "青绿海水 · 水波光影",
    paletteId: "qzone-ocean-dream",
    backgroundId: "qzone-bg-ocean",
    category: "qzone",
    cover:
      "radial-gradient(circle at 40% 20%, rgba(45,212,191,0.45), transparent 30%), radial-gradient(circle at 80% 60%, rgba(56,189,248,0.4), transparent 28%), linear-gradient(180deg,#f2fbfb,#ccfbf1)",
  },
  {
    id: "pack-qzone-candy",
    name: "棉花糖云",
    tagline: "粉紫云絮 · 软甜氛围",
    paletteId: "qzone-candy-cloud",
    backgroundId: "qzone-bg-candy",
    category: "qzone",
    cover:
      "radial-gradient(circle at 25% 35%, rgba(244,114,182,0.5), transparent 30%), radial-gradient(circle at 70% 25%, rgba(216,180,254,0.55), transparent 32%), linear-gradient(180deg,#fff5fb,#f5d0fe)",
  },
  {
    id: "pack-qzone-plane",
    name: "纸飞机旅行",
    tagline: "晴空远行 · 轻盈蓝调",
    paletteId: "qzone-paper-plane",
    backgroundId: "qzone-bg-plane",
    category: "qzone",
    cover:
      "radial-gradient(circle at 50% 20%, rgba(147,197,253,0.5), transparent 35%), linear-gradient(180deg,#f5faff,#bfdbfe)",
  },
  {
    id: "pack-qzone-rain",
    name: "彩虹雨窗",
    tagline: "雨窗光斑 · 竖彩条纹",
    paletteId: "qzone-rainbow-rain",
    backgroundId: "qzone-bg-rain",
    category: "qzone",
    cover:
      "linear-gradient(90deg,rgba(248,113,113,0.25),rgba(250,204,21,0.25),rgba(74,222,128,0.25),rgba(56,189,248,0.25),rgba(167,139,250,0.25)), linear-gradient(180deg,#f4f7fb,#e2e8f0)",
  },
];

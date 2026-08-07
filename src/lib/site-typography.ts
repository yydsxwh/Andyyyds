/**
 * 网站装扮 · 字体 / 颜色 / 特效 / 动画。
 * 业务规则集中在此：字体库、颜色、特效与动画白名单、默认值与 CSS 生成；
 * 前台按需注入 CDN（不打进 bundle），微信/移动端可读系统字体回退。
 *
 * 字体选型原则：仅免费可商用 / 开源（SIL OFL 等）或厂商明确可免费商用；
 * 用描述性「风格名」近似可画/主题商店常见款，不打包、不假冒商标商用字体文件。
 */

import {
  FONT_SIZE_FIELDS,
  type FontSizeKey,
} from "./site-theme";

/** 字体分类：对齐可画 / 手机主题常见分区，供后台筛选 */
export type FontCategory =
  | "system"
  | "sans"
  | "serif"
  | "rounded"
  | "handwriting"
  | "calligraphy"
  | "cartoon"
  | "pixel"
  | "display"
  | "latin"
  | "mono"
  | "poster";

export type FontCategoryMeta = {
  id: FontCategory;
  label: string;
};

export const FONT_CATEGORIES: FontCategoryMeta[] = [
  { id: "system", label: "系统字体" },
  { id: "sans", label: "黑体 / 无衬线" },
  { id: "serif", label: "宋体 / 衬线" },
  { id: "rounded", label: "圆体" },
  { id: "handwriting", label: "手写" },
  { id: "calligraphy", label: "书法" },
  { id: "cartoon", label: "卡通趣味" },
  { id: "pixel", label: "像素" },
  { id: "display", label: "艺术标题" },
  { id: "latin", label: "英文展示" },
  { id: "mono", label: "等宽" },
  { id: "poster", label: "海报标题风" },
];

export type FontEntry = {
  id: string;
  name: string;
  category: FontCategory;
  /** 写入 CSS font-family 的完整栈（含回退，保证微信内可读） */
  stack: string;
  /**
   * 按需加载的样式表 URL；缺省表示纯系统字体、无需网络。
   * 优先 jsDelivr / fontsource，构建期不拉取。
   */
  cssUrl?: string;
  /** 授权说明，展示给站长，避免误用商标名 */
  license: string;
  /** 搜索关键词（拼音/别名），不展示 */
  keywords?: string;
};

const SYSTEM_SANS_FALLBACK =
  '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const SYSTEM_SERIF_FALLBACK =
  '"Songti SC", SimSun, "Noto Serif SC", serif';
const SYSTEM_KAI_FALLBACK = '"KaiTi", "STKaiti", "LXGW WenKai", serif';

/**
 * 可商用或开源近似字体库（约 70+ 套）。
 * 「可画同款 / 主题风」用描述性命名，不假冒商标字体名。
 */
export const FONT_LIBRARY: FontEntry[] = [
  // —— 系统 ——
  {
    id: "system-default",
    name: "跟随站点默认",
    category: "system",
    stack: "var(--font-body)",
    license: "使用 globals 默认字体栈，无需额外加载",
    keywords: "default 默认",
  },
  {
    id: "system-sans",
    name: "系统黑体",
    category: "system",
    stack: SYSTEM_SANS_FALLBACK,
    license: "系统自带，无额外授权",
    keywords: "yahei heiti pingfang",
  },
  {
    id: "system-serif",
    name: "系统宋体",
    category: "system",
    stack: SYSTEM_SERIF_FALLBACK,
    license: "系统自带，无额外授权",
    keywords: "songti simsun",
  },
  {
    id: "system-kai",
    name: "系统楷体",
    category: "system",
    stack: SYSTEM_KAI_FALLBACK,
    license: "系统自带楷体回退",
    keywords: "kaiti calligraphy",
  },
  {
    id: "system-ui",
    name: "系统 UI",
    category: "system",
    stack: 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    license: "系统 UI 字体栈",
    keywords: "ui system",
  },
  {
    id: "system-rounded",
    name: "系统圆角风",
    category: "system",
    stack:
      '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
    license: "系统栈近似圆体观感，无额外加载",
    keywords: "yuan 圆体 rounded",
  },

  // —— 黑体 / 无衬线 ——
  {
    id: "noto-sans-sc",
    name: "思源黑体 · Noto Sans",
    category: "sans",
    stack: `"Noto Sans SC", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.2.5/chinese-simplified-400.css",
    license: "SIL OFL · Google Noto / 思源黑体 · 按需子集",
    keywords: "siyuan heiti source han",
  },
  {
    id: "noto-sans-sc-bold",
    name: "思源黑体粗体",
    category: "sans",
    stack: `"Noto Sans SC", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.2.5/chinese-simplified-700.css",
    license: "SIL OFL · 按需加载 700 字重",
    keywords: "siyuan bold",
  },
  {
    id: "source-han-sans",
    name: "思源黑体 VF",
    category: "sans",
    stack: `"Source Han Sans SC VF", "Source Han Sans SC", "Noto Sans SC", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/cn-fontsource-source-han-sans-sc-vf@1.0.10/font.min.css",
    license: "SIL OFL · Adobe/Google 思源黑体可变版 · 简体子集",
    keywords: "siyuan vf variable",
  },
  {
    id: "alibaba-puhuiti",
    name: "阿里巴巴普惠体",
    category: "sans",
    stack: `"AlibabaPuHuiTi", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl: "https://cdn.jsdelivr.net/npm/c1-alibaba-puhui-ti@1.0.0/index.css",
    license:
      "阿里巴巴可商用授权；整包较大，建议标题/品牌用，正文优先思源",
    keywords: "alibaba puhuiti 普惠",
  },
  {
    id: "dingtalk-jinbu",
    name: "钉钉进步体",
    category: "sans",
    stack: `"DingTalk JinBuTi", "Noto Sans SC", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/cn-fontsource-ding-talk-jin-bu-ti-regular@1.0.3/font.min.css",
    license: "钉钉品牌字库声明可免费商用 · 简体子集",
    keywords: "dingtalk jinbu 进步",
  },

  // —— 宋体 / 衬线 ——
  {
    id: "noto-serif-sc",
    name: "思源宋体 · Noto Serif",
    category: "serif",
    stack: `"Noto Serif SC", ${SYSTEM_SERIF_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.2.5/chinese-simplified-400.css",
    license: "SIL OFL · Google Noto / 思源宋体",
    keywords: "siyuan songti serif",
  },
  {
    id: "source-han-serif",
    name: "思源宋体 VF",
    category: "serif",
    stack: `"Source Han Serif SC VF", "Source Han Serif SC", "Noto Serif SC", ${SYSTEM_SERIF_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/cn-fontsource-source-han-serif-sc-vf@1.0.9/font.min.css",
    license: "SIL OFL · 思源宋体可变版 · 简体子集",
    keywords: "siyuan song vf",
  },
  {
    id: "lxgw-wenkai",
    name: "霞鹜文楷",
    category: "serif",
    stack: `"LXGW WenKai", ${SYSTEM_KAI_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-regular.css",
    license: "SIL OFL · 霞鹜文楷",
    keywords: "lxgw wenkai 文楷",
  },
  {
    id: "lxgw-wenkai-screen",
    name: "霞鹜文楷屏幕版",
    category: "serif",
    stack: `"LXGW WenKai Screen", "LXGW WenKai", ${SYSTEM_KAI_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/cn-fontsource-lxgw-wen-kai-screen@1.0.6/font.min.css",
    license: "SIL OFL · 屏显优化文楷 · 简体子集",
    keywords: "lxgw screen 文楷",
  },
  {
    id: "lxgw-wenkai-gb",
    name: "霞鹜文楷 GB 屏显",
    category: "serif",
    stack: `"LXGW WenKai GB Screen", "LXGW WenKai Screen", "LXGW WenKai", ${SYSTEM_KAI_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/cn-fontsource-lxgw-wen-kai-gb-screen@1.0.6/font.min.css",
    license: "SIL OFL · GB 字符集屏显文楷",
    keywords: "lxgw gb 文楷",
  },
  {
    id: "merriweather",
    name: "Merriweather 衬线",
    category: "serif",
    stack: `"Merriweather", Georgia, ${SYSTEM_SERIF_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/merriweather@5.3.0/latin-400.css",
    license: "SIL OFL · 英文正文衬线（中文回退系统宋体）",
    keywords: "merriweather serif english",
  },
  {
    id: "lora",
    name: "Lora 衬线",
    category: "serif",
    stack: `"Lora", Georgia, ${SYSTEM_SERIF_FALLBACK}`,
    cssUrl: "https://cdn.jsdelivr.net/npm/@fontsource/lora@5.3.0/latin-400.css",
    license: "SIL OFL · 英文阅读衬线",
    keywords: "lora serif",
  },
  {
    id: "roboto-slab",
    name: "Roboto Slab 方衬线",
    category: "serif",
    stack: `"Roboto Slab", "Noto Serif SC", ${SYSTEM_SERIF_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/roboto-slab@5.3.0/latin-400.css",
    license: "Apache 2.0 · 英文 slab",
    keywords: "roboto slab",
  },

  // —— 圆体 ——
  {
    id: "yozai",
    name: "悠哉字体",
    category: "rounded",
    stack: `"Yozai", "ZCOOL QingKe HuangYou", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/cn-fontsource-yozai-regular@1.0.9/font.min.css",
    license: "SIL OFL · 悠哉圆润标题体",
    keywords: "yozai 悠哉 yuan 圆体",
  },
  {
    id: "zcool-qingke",
    name: "站酷庆科黄油体",
    category: "rounded",
    stack: `"ZCOOL QingKe HuangYou", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/zcool-qingke-huangyou@5.2.5/chinese-simplified-400.css",
    license: "SIL OFL · 站酷庆科黄油体（圆润标题）",
    keywords: "zcool qingke 黄油 yuan",
  },
  {
    id: "mplus-rounded",
    name: "M PLUS 圆体",
    category: "rounded",
    stack: `"M PLUS Rounded 1c", "Yozai", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/m-plus-rounded-1c@5.3.0/japanese-400.css",
    license: "SIL OFL · 日文圆体，中文回退悠哉/系统",
    keywords: "mplus rounded yuan 圆",
  },
  {
    id: "zen-maru",
    name: "Zen 丸ゴシック",
    category: "rounded",
    stack: `"Zen Maru Gothic", "Yozai", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/zen-maru-gothic@5.3.0/japanese-400.css",
    license: "SIL OFL · 圆角哥特，中文回退系统",
    keywords: "zen maru rounded yuan",
  },
  {
    id: "nunito",
    name: "Nunito 圆润英字",
    category: "rounded",
    stack: `"Nunito", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/nunito@5.3.0/latin-400.css",
    license: "SIL OFL · 英文圆体（中文回退系统黑体）",
    keywords: "nunito rounded soft",
  },
  {
    id: "comfortaa",
    name: "Comfortaa 几何圆",
    category: "rounded",
    stack: `"Comfortaa", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/comfortaa@5.3.0/latin-400.css",
    license: "SIL OFL · 几何圆润英文",
    keywords: "comfortaa rounded",
  },
  {
    id: "quicksand",
    name: "Quicksand 柔圆",
    category: "rounded",
    stack: `"Quicksand", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/quicksand@5.3.0/latin-400.css",
    license: "SIL OFL · 柔和圆角英文",
    keywords: "quicksand soft",
  },
  {
    id: "fredoka",
    name: "Fredoka 气泡圆",
    category: "rounded",
    stack: `"Fredoka", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/fredoka@5.3.0/latin-400.css",
    license: "SIL OFL · 气泡感英文圆体",
    keywords: "fredoka bubble",
  },

  // —— 手写 ——
  {
    id: "zhi-mang-xing",
    name: "志莽行书",
    category: "handwriting",
    stack: `"Zhi Mang Xing", ${SYSTEM_KAI_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/zhi-mang-xing@5.2.5/chinese-simplified-400.css",
    license: "SIL OFL · Google Fonts",
    keywords: "zhimang xingshu 行书",
  },
  {
    id: "liu-jian-mao-cao",
    name: "刘建毛笔草书",
    category: "handwriting",
    stack: `"Liu Jian Mao Cao", ${SYSTEM_KAI_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/liu-jian-mao-cao@5.2.5/chinese-simplified-400.css",
    license: "SIL OFL · Google Fonts",
    keywords: "liujian caoshu 草书",
  },
  {
    id: "slide-youran",
    name: "悠然小楷",
    category: "handwriting",
    stack: `"slideyouran", ${SYSTEM_KAI_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/cn-fontsource-slideyouran-regular@1.0.3/font.min.css",
    license: "演示悠然小楷 · 可商用声明 · 简体子集",
    keywords: "youran xiaokai 小楷",
  },
  {
    id: "honglei-sim",
    name: "鸿雷板书简体",
    category: "handwriting",
    stack: `"honglei sim", "HongLei Sim", ${SYSTEM_KAI_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/cn-fontsource-honglei-sim-regular@1.0.6/font.min.css",
    license: "可商用声明 · 板书手写风",
    keywords: "honglei 鸿雷 板书",
  },
  {
    id: "caveat",
    name: "Caveat 手写英字",
    category: "handwriting",
    stack: `"Caveat", "Comic Sans MS", cursive`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/caveat@5.3.0/latin-400.css",
    license: "SIL OFL · 英文手写",
    keywords: "caveat handwriting",
  },
  {
    id: "indie-flower",
    name: "Indie Flower",
    category: "handwriting",
    stack: `"Indie Flower", cursive`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/indie-flower@5.3.0/latin-400.css",
    license: "SIL OFL · 轻松手写英文",
    keywords: "indie flower",
  },
  {
    id: "shadows-into-light",
    name: "Shadows Into Light",
    category: "handwriting",
    stack: `"Shadows Into Light", cursive`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/shadows-into-light@5.3.0/latin-400.css",
    license: "SIL OFL · 随性手写英文",
    keywords: "shadows light",
  },
  {
    id: "dancing-script",
    name: "Dancing Script",
    category: "handwriting",
    stack: `"Dancing Script", cursive`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/dancing-script@5.3.0/latin-400.css",
    license: "SIL OFL · 连笔手写英文",
    keywords: "dancing script",
  },

  // —— 书法 ——
  {
    id: "ma-shan-zheng",
    name: "马善政楷书",
    category: "calligraphy",
    stack: `"Ma Shan Zheng", ${SYSTEM_KAI_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/ma-shan-zheng@5.2.5/chinese-simplified-400.css",
    license: "SIL OFL · Google Fonts",
    keywords: "mashan kaishu 楷书 书法",
  },
  {
    id: "long-cang",
    name: "龙藏体",
    category: "calligraphy",
    stack: `"Long Cang", ${SYSTEM_KAI_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/long-cang@5.2.5/chinese-simplified-400.css",
    license: "SIL OFL · Google Fonts",
    keywords: "longcang 龙藏 书法",
  },
  {
    id: "alimama-dongfang-kai",
    name: "阿里妈妈东方大楷",
    category: "calligraphy",
    stack: `"Alimama DongFangDaKai", ${SYSTEM_KAI_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/cn-fontsource-alimama-dong-fang-da-kai-regular@1.0.3/font.min.css",
    license: "阿里妈妈可免费商用声明 · 简体子集",
    keywords: "alimama dongfang 大楷 书法",
  },
  {
    id: "zcool-xiaowei",
    name: "站酷小薇LOGO体",
    category: "calligraphy",
    stack: `"ZCOOL XiaoWei", "Noto Serif SC", ${SYSTEM_SERIF_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/zcool-xiaowei@5.2.5/chinese-simplified-400.css",
    license: "SIL OFL · 站酷小薇（雅致书法感标题）",
    keywords: "zcool xiaowei 小薇",
  },
  {
    id: "great-vibes",
    name: "Great Vibes 花体",
    category: "calligraphy",
    stack: `"Great Vibes", cursive`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/great-vibes@5.3.0/latin-400.css",
    license: "SIL OFL · 英文花体书法",
    keywords: "great vibes script",
  },
  {
    id: "cinzel",
    name: "Cinzel 典雅大写",
    category: "calligraphy",
    stack: `"Cinzel", "Times New Roman", serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/cinzel@5.3.0/latin-400.css",
    license: "SIL OFL · 西式碑铭风",
    keywords: "cinzel elegant",
  },

  // —— 卡通趣味 ——
  {
    id: "zcool-kuaile",
    name: "站酷快乐体",
    category: "cartoon",
    stack: `"ZCOOL KuaiLe", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/zcool-kuaile@5.2.5/chinese-simplified-400.css",
    license: "SIL OFL · 站酷快乐体",
    keywords: "zcool kuaile 快乐 卡通",
  },
  {
    id: "xiaolai",
    name: "小赖字体",
    category: "cartoon",
    stack: `"Xiaolai SC", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/cn-fontsource-xiaolai-sc-regular@1.0.2/font.min.css",
    license: "SIL OFL · 小赖字体简体 · 趣味标题",
    keywords: "xiaolai 小赖 cartoon",
  },
  {
    id: "baloo-2",
    name: "Baloo 2 软萌",
    category: "cartoon",
    stack: `"Baloo 2", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/baloo-2@5.3.0/latin-400.css",
    license: "SIL OFL · 软萌英文卡通",
    keywords: "baloo cute cartoon",
  },
  {
    id: "comic-neue",
    name: "Comic Neue",
    category: "cartoon",
    stack: `"Comic Neue", "Comic Sans MS", cursive`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/comic-neue@5.3.0/latin-400.css",
    license: "SIL OFL · 漫画感英文",
    keywords: "comic neue cartoon",
  },
  {
    id: "bangers",
    name: "Bangers 漫画吼",
    category: "cartoon",
    stack: `"Bangers", Impact, sans-serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/bangers@5.3.0/latin-400.css",
    license: "SIL OFL · 漫画爆炸标题英文",
    keywords: "bangers comic boom",
  },
  {
    id: "mclaren",
    name: "McLaren 童趣",
    category: "cartoon",
    stack: `"McLaren", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/mclaren@5.3.0/latin-400.css",
    license: "SIL OFL · 童趣英文",
    keywords: "mclaren kids",
  },
  {
    id: "kiwi-maru",
    name: "Kiwi Maru 丸体",
    category: "cartoon",
    stack: `"Kiwi Maru", "Yozai", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/kiwi-maru@5.3.0/japanese-400.css",
    license: "SIL OFL · 日式丸体趣味",
    keywords: "kiwi maru cute",
  },

  // —— 像素 ——
  {
    id: "fusion-pixel-12",
    name: "缝合像素 12px",
    category: "pixel",
    stack: `"Fusion Pixel 12px Proportional SC", "Press Start 2P", monospace`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/fusion-pixel-12px-proportional-sc@5.3.0/400.css",
    license: "SIL OFL / CC0 · 简体中文像素",
    keywords: "fusion pixel 像素 12",
  },
  {
    id: "fusion-pixel-10",
    name: "缝合像素 10px",
    category: "pixel",
    stack: `"Fusion Pixel 10px Proportional SC", monospace`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/fusion-pixel-10px-proportional-sc@5.3.0/400.css",
    license: "SIL OFL / CC0 · 细像素中文",
    keywords: "fusion pixel 10",
  },
  {
    id: "fusion-pixel-8",
    name: "缝合像素 8px",
    category: "pixel",
    stack: `"Fusion Pixel 8px Proportional SC", monospace`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/fusion-pixel-8px-proportional-sc@5.3.0/400.css",
    license: "SIL OFL / CC0 · 复古细像素",
    keywords: "fusion pixel 8",
  },
  {
    id: "fusion-pixel-mono",
    name: "缝合像素等宽",
    category: "pixel",
    stack: `"Fusion Pixel 12px Monospaced SC", monospace`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/fusion-pixel-12px-monospaced-sc@5.3.0/400.css",
    license: "SIL OFL / CC0 · 等宽像素中文",
    keywords: "fusion pixel mono",
  },
  {
    id: "press-start-2p",
    name: "Press Start 2P",
    category: "pixel",
    stack: `"Press Start 2P", monospace`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/press-start-2p@5.3.0/latin-400.css",
    license: "SIL OFL · 经典游戏像素英文",
    keywords: "press start pixel game",
  },
  {
    id: "vt323",
    name: "VT323 终端像素",
    category: "pixel",
    stack: `"VT323", monospace`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/vt323@5.3.0/latin-400.css",
    license: "SIL OFL · CRT 终端风",
    keywords: "vt323 terminal",
  },
  {
    id: "silkscreen",
    name: "Silkscreen",
    category: "pixel",
    stack: `"Silkscreen", monospace`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/silkscreen@5.3.0/latin-400.css",
    license: "SIL OFL · 丝网像素英文",
    keywords: "silkscreen pixel",
  },
  {
    id: "dotgothic16",
    name: "DotGothic16",
    category: "pixel",
    stack: `"DotGothic16", monospace`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/dotgothic16@5.3.0/japanese-400.css",
    license: "SIL OFL · 日文点阵哥特",
    keywords: "dotgothic pixel jp",
  },

  // —— 艺术标题 ——
  {
    id: "smiley-sans",
    name: "得意黑",
    category: "display",
    stack: `"Smiley Sans Oblique", "Noto Sans SC", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/cn-fontsource-smiley-sans-oblique-regular@1.0.1/font.min.css",
    license: "SIL OFL · 得意黑 Smiley Sans · 简体子集",
    keywords: "smiley 得意黑 display",
  },
  {
    id: "permanent-marker",
    name: "Permanent Marker",
    category: "display",
    stack: `"Permanent Marker", Impact, cursive`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/permanent-marker@5.3.0/latin-400.css",
    license: "Apache 2.0 · 马克笔艺术英文",
    keywords: "permanent marker art",
  },
  {
    id: "monoton",
    name: "Monoton 霓虹字",
    category: "display",
    stack: `"Monoton", Impact, sans-serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/monoton@5.3.0/latin-400.css",
    license: "SIL OFL · 霓虹展示英文",
    keywords: "monoton neon art",
  },
  {
    id: "bungee",
    name: "Bungee 街头",
    category: "display",
    stack: `"Bungee", Impact, sans-serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/bungee@5.3.0/latin-400.css",
    license: "SIL OFL · 街头海报英文",
    keywords: "bungee street",
  },
  {
    id: "black-ops-one",
    name: "Black Ops One",
    category: "display",
    stack: `"Black Ops One", Impact, sans-serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/black-ops-one@5.3.0/latin-400.css",
    license: "SIL OFL · 军事硬朗展示",
    keywords: "black ops display",
  },
  {
    id: "righteous",
    name: "Righteous",
    category: "display",
    stack: `"Righteous", Impact, sans-serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/righteous@5.3.0/latin-400.css",
    license: "SIL OFL · 复古展示英文",
    keywords: "righteous display",
  },
  {
    id: "alfa-slab-one",
    name: "Alfa Slab One",
    category: "display",
    stack: `"Alfa Slab One", "Roboto Slab", serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/alfa-slab-one@5.3.0/latin-400.css",
    license: "SIL OFL · 厚重 slab 标题",
    keywords: "alfa slab",
  },
  {
    id: "special-elite",
    name: "Special Elite 打字机",
    category: "display",
    stack: `"Special Elite", "Courier New", monospace`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/special-elite@5.3.0/latin-400.css",
    license: "SIL OFL · 打字机痕迹英文",
    keywords: "special elite typewriter",
  },

  // —— 英文展示 ——
  {
    id: "playfair-display",
    name: "Playfair Display",
    category: "latin",
    stack: `"Playfair Display", Georgia, serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5.3.0/latin-400.css",
    license: "SIL OFL · 时尚衬线展示",
    keywords: "playfair elegant latin",
  },
  {
    id: "bebas-neue",
    name: "Bebas Neue",
    category: "latin",
    stack: `"Bebas Neue", Impact, sans-serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/bebas-neue@5.3.0/latin-400.css",
    license: "SIL OFL · 紧凑大写海报英字",
    keywords: "bebas neue poster",
  },
  {
    id: "oswald",
    name: "Oswald",
    category: "latin",
    stack: `"Oswald", Impact, sans-serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/oswald@5.3.0/latin-400.css",
    license: "SIL OFL · 窄体标题英文",
    keywords: "oswald condensed",
  },
  {
    id: "anton",
    name: "Anton",
    category: "latin",
    stack: `"Anton", Impact, sans-serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/anton@5.3.0/latin-400.css",
    license: "SIL OFL · 冲击力大写",
    keywords: "anton impact",
  },
  {
    id: "archivo-black",
    name: "Archivo Black",
    category: "latin",
    stack: `"Archivo Black", Impact, sans-serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/archivo-black@5.3.0/latin-400.css",
    license: "SIL OFL · 超粗无衬线",
    keywords: "archivo black bold",
  },
  {
    id: "abril-fatface",
    name: "Abril Fatface",
    category: "latin",
    stack: `"Abril Fatface", Georgia, serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/abril-fatface@5.3.0/latin-400.css",
    license: "SIL OFL · 杂志衬线展示",
    keywords: "abril fatface",
  },
  {
    id: "space-grotesk",
    name: "Space Grotesk",
    category: "latin",
    stack: `"Space Grotesk", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/space-grotesk@5.3.0/latin-400.css",
    license: "SIL OFL · 现代几何无衬线",
    keywords: "space grotesk modern",
  },
  {
    id: "rubik",
    name: "Rubik",
    category: "latin",
    stack: `"Rubik", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/rubik@5.3.0/latin-400.css",
    license: "SIL OFL · 圆角现代英文",
    keywords: "rubik soft",
  },
  {
    id: "lobster",
    name: "Lobster 脚本",
    category: "latin",
    stack: `"Lobster", cursive`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/lobster@5.3.0/latin-400.css",
    license: "SIL OFL · 招牌脚本英文",
    keywords: "lobster script",
  },
  {
    id: "pacifico",
    name: "Pacifico",
    category: "latin",
    stack: `"Pacifico", cursive`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/pacifico@5.3.0/latin-400.css",
    license: "SIL OFL · 海滩脚本英文",
    keywords: "pacifico script",
  },
  {
    id: "orbitron",
    name: "Orbitron 科幻",
    category: "latin",
    stack: `"Orbitron", sans-serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/orbitron@5.3.0/latin-400.css",
    license: "SIL OFL · 科幻几何英文",
    keywords: "orbitron sci-fi",
  },
  {
    id: "audiowide",
    name: "Audiowide",
    category: "latin",
    stack: `"Audiowide", sans-serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/audiowide@5.3.0/latin-400.css",
    license: "SIL OFL · 未来派展示",
    keywords: "audiowide future",
  },
  {
    id: "russo-one",
    name: "Russo One",
    category: "latin",
    stack: `"Russo One", Impact, sans-serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/russo-one@5.3.0/latin-400.css",
    license: "SIL OFL · 粗壮运动风",
    keywords: "russo one sport",
  },

  // —— 等宽 ——
  {
    id: "jetbrains-mono",
    name: "JetBrains Mono",
    category: "mono",
    stack: `"JetBrains Mono", "Courier New", monospace`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.2.5/latin-400.css",
    license: "SIL OFL · 编程等宽",
    keywords: "jetbrains mono code",
  },
  {
    id: "ibm-plex-mono",
    name: "IBM Plex Mono",
    category: "mono",
    stack: `"IBM Plex Mono", monospace`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5.3.0/latin-400.css",
    license: "SIL OFL · IBM 等宽",
    keywords: "ibm plex mono",
  },
  {
    id: "source-code-pro",
    name: "Source Code Pro",
    category: "mono",
    stack: `"Source Code Pro", monospace`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/source-code-pro@5.3.0/latin-400.css",
    license: "SIL OFL · Adobe 等宽",
    keywords: "source code pro",
  },
  {
    id: "fira-code",
    name: "Fira Code",
    category: "mono",
    stack: `"Fira Code", monospace`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/fira-code@5.3.0/latin-400.css",
    license: "SIL OFL · 连字编程字体",
    keywords: "fira code ligature",
  },
  {
    id: "share-tech-mono",
    name: "Share Tech Mono",
    category: "mono",
    stack: `"Share Tech Mono", monospace`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/share-tech-mono@5.3.0/latin-400.css",
    license: "SIL OFL · 科技等宽",
    keywords: "share tech mono",
  },
  {
    id: "system-mono",
    name: "系统等宽",
    category: "mono",
    stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace',
    license: "系统等宽栈，无额外加载",
    keywords: "system mono courier",
  },

  // —— 海报标题风（开源近似，描述性命名）——
  {
    id: "poster-headline",
    name: "海报标题风",
    category: "poster",
    stack: `"ZCOOL QingKe HuangYou", "Noto Sans SC", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/zcool-qingke-huangyou@5.2.5/chinese-simplified-400.css",
    license: "开源黄油体作「海报标题」风格近似，非商标字体",
    keywords: "poster headline 海报",
  },
  {
    id: "poster-variety",
    name: "综艺标题风",
    category: "poster",
    stack: `"ZCOOL KuaiLe", "Noto Sans SC", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/zcool-kuaile@5.2.5/chinese-simplified-400.css",
    license: "开源快乐体近似综艺粗圆标题，非商标字体",
    keywords: "poster variety 综艺",
  },
  {
    id: "poster-elegant",
    name: "雅致衬线风",
    category: "poster",
    stack: `"ZCOOL XiaoWei", "Noto Serif SC", ${SYSTEM_SERIF_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/zcool-xiaowei@5.2.5/chinese-simplified-400.css",
    license: "开源小薇体近似雅致海报标题",
    keywords: "poster elegant 雅致",
  },
  {
    id: "poster-impact",
    name: "冲击力标题风",
    category: "poster",
    stack: `"Smiley Sans Oblique", "Noto Sans SC", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/cn-fontsource-smiley-sans-oblique-regular@1.0.1/font.min.css",
    license: "得意黑开源体作冲击标题近似",
    keywords: "poster impact 冲击",
  },
  {
    id: "poster-kai",
    name: "文楷海报风",
    category: "poster",
    stack: `"LXGW WenKai", ${SYSTEM_KAI_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-regular.css",
    license: "霞鹜文楷开源，作传统海报标题近似",
    keywords: "poster kai 文楷",
  },
  {
    id: "you-she-title-approx",
    name: "优设标题近似",
    category: "poster",
    stack: `"Smiley Sans Oblique", "Noto Sans SC", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/cn-fontsource-smiley-sans-oblique-regular@1.0.1/font.min.css",
    license:
      "版权敏感：用开源得意黑近似，勿冒用「优设标题黑」商标名作字体标识",
    keywords: "youshe 优设 approx",
  },
  {
    id: "poster-progress",
    name: "进步标题风",
    category: "poster",
    stack: `"DingTalk JinBuTi", "Noto Sans SC", ${SYSTEM_SANS_FALLBACK}`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/cn-fontsource-ding-talk-jin-bu-ti-regular@1.0.3/font.min.css",
    license: "钉钉进步体开源商用，作现代标题风",
    keywords: "poster progress 进步",
  },
  {
    id: "poster-bebas",
    name: "西式海报大写风",
    category: "poster",
    stack: `"Bebas Neue", "Oswald", Impact, sans-serif`,
    cssUrl:
      "https://cdn.jsdelivr.net/npm/@fontsource/bebas-neue@5.3.0/latin-400.css",
    license: "开源 Bebas 作西式海报大写近似",
    keywords: "poster bebas western",
  },
];

export type TextEffectId =
  | "none"
  | "stroke"
  | "softShadow"
  | "hardShadow"
  | "gradient"
  | "glow"
  | "fireGlow"
  | "neon"
  | "emboss";

export type TextEffectMeta = {
  id: TextEffectId;
  label: string;
  hint: string;
};

export const TEXT_EFFECTS: TextEffectMeta[] = [
  { id: "none", label: "无特效", hint: "纯色文字" },
  { id: "stroke", label: "描边", hint: "细描边，适合大标题" },
  { id: "softShadow", label: "柔和阴影", hint: "轻微立体感" },
  { id: "hardShadow", label: "硬阴影", hint: "海报浮雕感" },
  { id: "gradient", label: "渐变字", hint: "品牌色到点缀色渐变" },
  { id: "glow", label: "发光", hint: "品牌色柔光" },
  { id: "fireGlow", label: "焰光", hint: "点缀色暖光" },
  { id: "neon", label: "霓虹", hint: "多层霓虹光晕" },
  { id: "emboss", label: "浮雕", hint: "亮暗双边阴影" },
];

export type TextAnimationId =
  | "none"
  | "fadeIn"
  | "blink"
  | "bounce"
  | "float"
  | "shine"
  | "pulse"
  | "breath"
  | "typewriter"
  | "marquee";

export type TextAnimationMeta = {
  id: TextAnimationId;
  label: string;
  hint: string;
};

export const TEXT_ANIMATIONS: TextAnimationMeta[] = [
  { id: "none", label: "无动画", hint: "静止（默认，最省电）" },
  { id: "fadeIn", label: "渐入", hint: "进入时淡入上移一次" },
  { id: "blink", label: "闪烁", hint: "轻量透明度呼吸" },
  { id: "bounce", label: "跳动", hint: "轻微上下弹" },
  { id: "float", label: "漂浮", hint: "缓慢起伏" },
  { id: "shine", label: "扫光", hint: "高光扫过文字" },
  { id: "pulse", label: "脉搏", hint: "轻微缩放" },
  { id: "breath", label: "呼吸", hint: "更柔和的缩放+透明度" },
  { id: "typewriter", label: "打字机感", hint: "进入时逐步显现一次" },
  { id: "marquee", label: "跑马灯感", hint: "轻微左右漂移，不截断正文" },
];

export type RoleTypography = {
  fontFamily: string;
  /**
   * 文字色：空字符串 = 跟随主题/父级（旧配置兼容）；
   * 合法值为 #RGB / #RRGGBB（大小写均可）。
   */
  color: string;
  effect: TextEffectId;
  animation: TextAnimationId;
};

export type TypographyConfig = Record<FontSizeKey, RoleTypography>;

/** 「跟随主题」标记：不写死色值，保留 ink/muted/brand 等原有语义 */
export const THEME_TEXT_COLOR = "";

/** 后台快捷色板：触控点选 + 原生 color input 精细调 */
export const TEXT_COLOR_PRESETS: { id: string; label: string; value: string }[] =
  [
    { id: "theme", label: "跟随主题", value: THEME_TEXT_COLOR },
    { id: "ink", label: "墨黑", value: "#1a1a1a" },
    { id: "charcoal", label: "炭灰", value: "#333333" },
    { id: "slate", label: "石板灰", value: "#64748b" },
    { id: "muted", label: "浅灰", value: "#94a3b8" },
    { id: "white", label: "纯白", value: "#ffffff" },
    { id: "brand-blue", label: "品牌蓝", value: "#2563eb" },
    { id: "sky", label: "天空蓝", value: "#0ea5e9" },
    { id: "teal", label: "青绿", value: "#0d9488" },
    { id: "green", label: "翠绿", value: "#16a34a" },
    { id: "amber", label: "琥珀", value: "#d97706" },
    { id: "orange", label: "橙红", value: "#ea580c" },
    { id: "rose", label: "玫红", value: "#e11d48" },
    { id: "pink", label: "粉色", value: "#db2777" },
    { id: "violet", label: "紫罗兰", value: "#7c3aed" },
    { id: "gold", label: "金色", value: "#ca8a04" },
  ];

export const DEFAULT_ROLE_TYPOGRAPHY: RoleTypography = {
  fontFamily: "system-default",
  color: THEME_TEXT_COLOR,
  effect: "none",
  animation: "none",
};

/** 校验并规范化站长选色；非法值回退「跟随主题」避免脏数据污染前台 */
export function normalizeTextColor(value: unknown): string {
  if (typeof value !== "string") return THEME_TEXT_COLOR;
  const raw = value.trim();
  if (!raw) return THEME_TEXT_COLOR;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) {
    return raw.length === 4
      ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase()
      : raw.toLowerCase();
  }
  return THEME_TEXT_COLOR;
}

export const DEFAULT_TYPOGRAPHY: TypographyConfig = {
  nav: { ...DEFAULT_ROLE_TYPOGRAPHY },
  brand: { ...DEFAULT_ROLE_TYPOGRAPHY },
  heroTitle: { ...DEFAULT_ROLE_TYPOGRAPHY },
  heroSubtext: { ...DEFAULT_ROLE_TYPOGRAPHY },
  sectionTitle: { ...DEFAULT_ROLE_TYPOGRAPHY },
  sectionDesc: { ...DEFAULT_ROLE_TYPOGRAPHY },
  portalCardTitle: { ...DEFAULT_ROLE_TYPOGRAPHY },
  portalCardDesc: { ...DEFAULT_ROLE_TYPOGRAPHY },
};

const EFFECT_IDS = new Set(TEXT_EFFECTS.map((e) => e.id));
const ANIMATION_IDS = new Set(TEXT_ANIMATIONS.map((a) => a.id));
const FONT_IDS = new Set(FONT_LIBRARY.map((f) => f.id));

export function fontById(id: string | null | undefined): FontEntry {
  return (
    FONT_LIBRARY.find((f) => f.id === id) ||
    FONT_LIBRARY.find((f) => f.id === "system-default")!
  );
}

export function fontsInCategory(category: FontCategory | "all"): FontEntry[] {
  if (category === "all") return FONT_LIBRARY;
  return FONT_LIBRARY.filter((f) => f.category === category);
}

/** 分类 + 关键词搜索（名称 / id / keywords） */
export function filterFonts(
  category: FontCategory | "all",
  query: string,
): FontEntry[] {
  const base = fontsInCategory(category);
  const q = query.trim().toLowerCase();
  if (!q) return base;
  return base.filter((font) => {
    const hay = `${font.name} ${font.id} ${font.keywords || ""} ${font.license}`.toLowerCase();
    return hay.includes(q);
  });
}

export function categoryLabel(id: FontCategory): string {
  return FONT_CATEGORIES.find((c) => c.id === id)?.label || id;
}

/** 角色对应的 class：与 --fs-* 后缀一致，如 typo-hero-title */
export function typoRoleClass(key: FontSizeKey): string {
  const field = FONT_SIZE_FIELDS.find((f) => f.key === key);
  const suffix = field ? field.cssVar.replace(/^--fs-/, "") : key;
  return `typo-role typo-${suffix}`;
}

/** 字号 + 字体 CSS 变量；颜色由 .typo-*（buildTypographyCss）按需写入，避免冲掉 muted 等主题色 */
export function typoRoleStyle(key: FontSizeKey): {
  fontSize: string;
  fontFamily: string;
} {
  const field = FONT_SIZE_FIELDS.find((f) => f.key === key);
  const fs = field?.cssVar || `--fs-${key}`;
  const ff = fs.replace("--fs-", "--ff-");
  return {
    fontSize: `var(${fs})`,
    fontFamily: `var(${ff})`,
  };
}

function isEffect(value: unknown): value is TextEffectId {
  return typeof value === "string" && EFFECT_IDS.has(value as TextEffectId);
}

function isAnimation(value: unknown): value is TextAnimationId {
  return (
    typeof value === "string" && ANIMATION_IDS.has(value as TextAnimationId)
  );
}

function normalizeRole(
  value: Partial<RoleTypography> | null | undefined,
): RoleTypography {
  const fontFamily =
    value?.fontFamily && FONT_IDS.has(value.fontFamily)
      ? value.fontFamily
      : DEFAULT_ROLE_TYPOGRAPHY.fontFamily;
  return {
    fontFamily,
    color: normalizeTextColor(value?.color),
    effect: isEffect(value?.effect) ? value.effect : "none",
    animation: isAnimation(value?.animation) ? value.animation : "none",
  };
}

/** 解析/校正站长排版配置；缺字段或脏数据回退默认，保证旧 decorateJson 兼容 */
export function normalizeTypography(
  value: Partial<Record<FontSizeKey, Partial<RoleTypography>>> | null | undefined,
): TypographyConfig {
  const next = structuredClone(DEFAULT_TYPOGRAPHY);
  if (!value || typeof value !== "object") return next;
  for (const field of FONT_SIZE_FIELDS) {
    const role = value[field.key];
    if (role && typeof role === "object") {
      next[field.key] = normalizeRole(role);
    }
  }
  return next;
}

export function typographyEqual(a: TypographyConfig, b: TypographyConfig): boolean {
  return FONT_SIZE_FIELDS.every((field) => {
    const x = a[field.key];
    const y = b[field.key];
    return (
      x.fontFamily === y.fontFamily &&
      x.color === y.color &&
      x.effect === y.effect &&
      x.animation === y.animation
    );
  });
}

/** 从字体列表收集 CDN（去重），供选字预览按需注入 */
export function collectFontCssUrls(fonts: FontEntry[]): string[] {
  const urls = new Set<string>();
  for (const font of fonts) {
    if (font.cssUrl) urls.add(font.cssUrl);
  }
  return [...urls];
}

/** 收集配置里实际用到的 CDN 样式表（去重），供 layout / 试穿按需注入 */
export function collectTypographyFontUrls(
  typography: TypographyConfig,
): string[] {
  const fonts = FONT_SIZE_FIELDS.map((field) =>
    fontById(typography[field.key].fontFamily),
  );
  return collectFontCssUrls(fonts);
}

/** 写入 html style 的 --ff-* / --fc-* 变量（未自定义色时不写 --fc，保留主题语义色） */
export function buildTypographyFontVars(
  typography: TypographyConfig,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const field of FONT_SIZE_FIELDS) {
    const role = typography[field.key];
    const font = fontById(role.fontFamily);
    const ffVar = field.cssVar.replace("--fs-", "--ff-");
    vars[ffVar] = font.stack;
    if (role.color) {
      vars[field.cssVar.replace("--fs-", "--fc-")] = role.color;
    }
  }
  return vars;
}

function effectCss(effect: TextEffectId): string {
  switch (effect) {
    case "stroke":
      return [
        "-webkit-text-stroke: 1px color-mix(in srgb, var(--ink) 35%, transparent);",
        "paint-order: stroke fill;",
      ].join("");
    case "softShadow":
      return "text-shadow: 0 2px 8px color-mix(in srgb, var(--ink) 18%, transparent);";
    case "hardShadow":
      return "text-shadow: 3px 3px 0 color-mix(in srgb, var(--ink) 22%, transparent);";
    case "gradient":
      return [
        "background-image: linear-gradient(120deg, var(--brand-strong), var(--fire));",
        "-webkit-background-clip: text;",
        "background-clip: text;",
        "color: transparent;",
        "-webkit-text-fill-color: transparent;",
      ].join("");
    case "glow":
      return "text-shadow: 0 0 10px color-mix(in srgb, var(--brand) 55%, transparent), 0 0 22px color-mix(in srgb, var(--brand) 30%, transparent);";
    case "fireGlow":
      return "text-shadow: 0 0 10px color-mix(in srgb, var(--fire) 55%, transparent), 0 0 22px color-mix(in srgb, var(--fire) 28%, transparent);";
    case "neon":
      // 多层光晕模拟霓虹；微信内 text-shadow 兼容较好
      return [
        "text-shadow:",
        "0 0 2px #fff,",
        "0 0 8px color-mix(in srgb, var(--brand) 80%, transparent),",
        "0 0 16px color-mix(in srgb, var(--brand) 55%, transparent),",
        "0 0 28px color-mix(in srgb, var(--fire) 45%, transparent);",
      ].join(" ");
    case "emboss":
      return "text-shadow: 1px 1px 0 rgba(255,255,255,0.65), -1px -1px 0 color-mix(in srgb, var(--ink) 25%, transparent);";
    default:
      return "";
  }
}

/**
 * 生成挂到页面的排版 CSS：按角色绑定字体变量、特效与动画。
 * 动画 keyframes 在 globals.css；prefers-reduced-motion 亦在 globals 统一关闭。
 */
export function buildTypographyCss(typography: TypographyConfig): string {
  const blocks: string[] = [];
  for (const field of FONT_SIZE_FIELDS) {
    const role = typography[field.key];
    const suffix = field.cssVar.replace(/^--fs-/, "");
    const sel = `.typo-${suffix}`;
    const ffVar = field.cssVar.replace("--fs-", "--ff-");
    const body: string[] = [`font-family: var(${ffVar});`];
    // 仅在站长显式选色时写入，避免覆盖 text-[var(--muted)] 等主题语义色
    if (role.color) {
      body.push(`color: ${role.color};`);
    }

    // 扫光与渐变都依赖 background-clip；扫光优先，避免互相覆盖
    if (role.animation === "shine") {
      body.push(
        "background-image: linear-gradient(100deg, currentColor 38%, color-mix(in srgb, #fff 85%, transparent) 50%, currentColor 62%);",
        "background-size: 220% 100%;",
        "-webkit-background-clip: text;",
        "background-clip: text;",
        "color: transparent;",
        "-webkit-text-fill-color: transparent;",
        "animation: typo-shine 2.8s linear infinite;",
      );
    } else {
      const effect = effectCss(role.effect);
      if (effect) body.push(effect.endsWith(";") ? effect : `${effect};`);
      // 渐变字会把 color 设为 transparent；与纯色同时选时渐变优先（特效语义）

      if (role.animation === "fadeIn") {
        body.push(
          "animation: typo-fadeIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;",
        );
      } else if (role.animation === "typewriter") {
        // 用 clip-path 逐步显现，避免改 width 撑破布局；仅播放一次
        body.push(
          "animation: typo-typewriter 1.5s steps(20, end) both;",
        );
      } else if (role.animation === "marquee") {
        // 轻微水平漂移，不依赖 overflow 跑马灯（微信里更稳、不挡操作）
        body.push("animation: typo-marquee 4.5s ease-in-out infinite;");
      } else if (role.animation === "breath") {
        body.push("animation: typo-breath 3.2s ease-in-out infinite;");
      } else if (role.animation !== "none") {
        body.push(
          `animation: typo-${role.animation} 2.4s ease-in-out infinite;`,
        );
      }
    }

    blocks.push(`${sel}{${body.join("")}}`);
  }
  return blocks.join("\n");
}

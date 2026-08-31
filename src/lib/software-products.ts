/**
 * 软件产品专栏：顶栏「软件产品」→ /products。
 * 后续可在此扩展更多颗秒系产品；外链/状态集中管理，便于上线时改一处。
 */

export type SoftwareProductStatus = "coming_soon" | "beta" | "live";

export type SoftwareProduct = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  status: SoftwareProductStatus;
  /** 正式产品页或外链；空则只展示介绍 */
  href?: string;
  /** 卡片角标文案 */
  badge?: string;
  /** true=仅站长可用（前台仍展示卡片，进入后按登录身份分流） */
  adminOnly?: boolean;
};

export const SOFTWARE_PRODUCTS: SoftwareProduct[] = [
  {
    // 站长内部工具：截图/PDF 公式 → LaTeX，直接可入库自用；卡片仍展示便于统一入口
    id: "mathcode",
    name: "MathCode 公式转 LaTeX",
    tagline: "数理化公式 AI 识别",
    description:
      "上传教材、试题截图、PDF，或 Word / WPS / PPT / Excel / Markdown，由 AI 转写为可编辑的 LaTeX：有什么写什么；可一键用 Overleaf / VS Code 打开生成的源码。",
    status: "live",
    href: "/products/mathcode",
    badge: "站长专用 · 立即可用",
    adminOnly: true,
  },
  {
    id: "kemiao-meeting",
    name: "颗秒会议",
    tagline: "在线开会与教学",
    description:
      "面向团队协作与在线教学的会议产品：音视频通话、屏幕与应用窗口共享、主持控场等能力将陆续上线。",
    status: "coming_soon",
    badge: "即将上线",
  },
  {
    id: "kemiao-drive",
    name: "颗秒网盘",
    tagline: "文件存储与协作",
    description:
      "个人与团队文件云存储：上传下载、分享协作、与站点学习资料打通。产品能力开发中，敬请期待。",
    status: "coming_soon",
    badge: "即将上线",
  },
];

export const SOFTWARE_PRODUCTS_PAGE = {
  title: "软件产品",
  subtitle:
    "颗秒系列自研产品与站长内部工具将陆续在此发布，欢迎关注。",
} as const;

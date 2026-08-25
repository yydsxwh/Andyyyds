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
};

export const SOFTWARE_PRODUCTS: SoftwareProduct[] = [
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
  subtitle: "颗秒系列自研产品将陆续在此发布，欢迎关注。",
} as const;

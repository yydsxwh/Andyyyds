/**
 * 软件产品专栏：顶栏「软件产品」→ /products。
 * 后续可在此扩展更多颗秒系产品；外链/状态集中管理，便于上线时改一处。
 */

export type SoftwareProductStatus = "coming_soon" | "beta" | "live";

export type SoftwareProductAction = {
  label: string;
  href: string;
  primary?: boolean;
  download?: boolean;
};

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
  /** 卡片上的多个入口（网页版、安装包等） */
  actions?: SoftwareProductAction[];
};

export const SOFTWARE_PRODUCTS: SoftwareProduct[] = [
  {
    id: "android-app",
    name: "安卓 App",
    tagline: "手机客户端下载",
    description:
      "歪歪滴艾斯安卓手机客户端：课程学习、论坛、约搭与消息随身携带，随时随地在线学习与交流。",
    status: "live",
    href: "/app",
    badge: "手机端",
    actions: [
      { label: "下载安卓 App", href: "/app", primary: true },
    ],
  },
  {
    id: "windows-client",
    name: "Windows 客户端",
    tagline: "电脑客户端下载",
    description:
      "歪歪滴艾斯 Windows 桌面客户端：站点完整功能的桌面版，大屏学习更专注，下载安装即用。",
    status: "live",
    href: "/app/windows",
    badge: "电脑端",
    actions: [
      { label: "下载 Windows 客户端", href: "/app/windows", primary: true },
    ],
  },
  {
    id: "kemiao-shundong",
    name: "瞬懂",
    tagline: "无畏契约点位社区",
    description:
      "上传点位教学视频和图文攻略笔记，支持评论、点赞、收藏和分享。按地图、英雄和用途检索。",
    status: "live",
    href: "/products/shundong/",
    badge: "网页版",
    actions: [
      { label: "打开网页版", href: "/products/shundong/", primary: true },
    ],
  },
  {
    id: "docs",
    name: "网页文档",
    tagline: "在浏览器里写文档",
    description:
      "标题、正文、加粗、多级标题、项目符号、可自定义的多级编号、插图和简单表格。可打开/另存 Word 与 HTML，设置页眉页脚页码并打印。手机微信同样能用。",
    status: "live",
    href: "/products/docs",
    badge: "网页编辑",
  },
  {
    id: "mathcode",
    name: "MathCode 公式转 LaTeX",
    tagline: "数理化公式 AI 识别",
    description:
      "上传教材、试题截图、PDF，或 Word / WPS / PPT / Excel / Markdown，由 AI 转写为可编辑的 LaTeX，并在本页预览、下载 PDF。未开通会员 0.5 元/页，会员 30 元/月含 150 页。",
    status: "live",
    href: "/products/mathcode",
    badge: "0.5元/页 · 会员更优惠",
  },
  {
    id: "kemiao-days",
    name: "颗秒日事",
    tagline: "日历 · 课表 · 待办 · 倒数日",
    description:
      "青春校园风日历、超级课程表、待办、倒数日与便签。可导入表格或课表照片，上课和考试会按时提醒。网页即开即用，也可下载 Android 或 Windows 安装包。",
    status: "live",
    href: "/products/days/",
    badge: "网页版 + Android + Windows",
    actions: [
      { label: "打开网页版", href: "/products/days/", primary: true },
      {
        label: "下载 Android 安装包",
        href: "/products/days/kemiao-days.apk",
        download: true,
      },
      {
        label: "下载 Windows 客户端",
        href: "/products/days/kemiao-days-windows.exe",
        download: true,
      },
    ],
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
    "颗秒系列自研产品与站长内部工具将陆续在此发布；游戏中心作为本专栏分区，欢迎关注。",
} as const;

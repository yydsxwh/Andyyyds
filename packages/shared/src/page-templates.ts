/**
 * 页面模板 DIY（模块编排）
 *
 * 存 SiteSettings.pageTemplatesJson，与 decorateJson（主题/配色/Logo 皮肤）分离。
 * - type=home：可有多套，仅一份 isDefault 生效于 `/`
 * - type=custom：独立页 `/p/{slug}`，可设默认（可选，不影响首页）
 * - type=account：预留个人中心，MVP 可建但前台暂不强制渲染
 *
 * 前台：有默认首页且 modules 非空 → 按模块渲染；否则回退现有硬编码首页。
 *
 * 布局：旧模板无 layout 时视为 flow 文档流（向后兼容）；
 * absolute 用百分比/像素自由定位，便于手机预览拖拽与左右摆放。
 */

export type PageTemplateType =
  | "home"
  | "company"
  | "person"
  | "courses"
  | "meetup"
  | "shop"
  | "products"
  | "forum"
  | "games"
  | "account"
  | "custom";

export type PageSlotId =
  | "company"
  | "person"
  | "courses"
  | "meetup"
  | "shop"
  | "products"
  | "forum"
  | "games"
  | "account";

/** 模块库类型：旧 9 种 + 扩展，总数 ≥20 */
export type PageModuleType =
  | "search"
  | "banner"
  | "image"
  | "courses"
  | "categories"
  | "teachers"
  | "spacer"
  | "richtext"
  | "pageSlot"
  | "video"
  | "animation"
  | "button"
  | "dualColumn"
  | "divider"
  | "heading"
  | "notice"
  | "countdown"
  | "linkCard"
  | "audio"
  | "iconRow"
  | "faq"
  | "testimonial"
  | "coupon"
  | "gallery"
  | "embed"
  | "marquee"
  | "socialLinks"
  | "stats"
  | "blankCard";

/**
 * 模块定位。缺省 = 文档流全宽，保证旧 JSON 无需迁移即可渲染。
 * - flow + column left/right：两列并排（各约半宽）
 * - absolute：相对页面容器自由定位（x/%, y/px, width/%）
 */
export type PageModuleLayout = {
  mode: "flow" | "absolute";
  column: "full" | "left" | "right";
  /** absolute：距容器左侧百分比 0–100 */
  x: number;
  /** absolute：距容器顶部像素（mobile-first 预览高度） */
  y: number;
  /** 宽度百分比 10–100 */
  width: number;
  zIndex: number;
};

export type BannerSlide = {
  id: string;
  url: string;
  alt: string;
  href: string;
};

export type SearchModuleProps = {
  placeholder: string;
};

export type BannerModuleProps = {
  slides: BannerSlide[];
  height: number;
};

export type ImageModuleProps = {
  url: string;
  alt: string;
  href: string;
  radius: number;
};

export type CoursesModuleProps = {
  title: string;
  subtitle: string;
  limit: number;
  /** 空 = 全部已发布课程/专栏 */
  categorySlug: string;
};

export type CategoriesModuleProps = {
  title: string;
};

export type TeachersModuleProps = {
  title: string;
  limit: number;
};

export type SpacerModuleProps = {
  height: number;
};

export type RichtextModuleProps = {
  /** 简易 HTML / 纯文本；MVP 不用完整 WYSIWYG */
  html: string;
};

/**
 * 模板编辑器写入的占位提示（如「可在模板编辑器增删模块」）。
 * 仅站长可见；游客/学员/商家/代理在前台一律不展示。
 */
const STUDIO_ONLY_RICHTEXT_HINTS = [
  "可在模板编辑器增删模块",
  "在此编辑公告或介绍文案",
  "可在模板编辑增加/删除模块",
  "可在模板编辑增删模块",
];

export function isStudioOnlyRichtextHint(html: string | null | undefined) {
  const text = String(html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, "")
    .trim();
  if (!text) return false;
  if (
    STUDIO_ONLY_RICHTEXT_HINTS.some((hint) =>
      text.includes(hint.replace(/\s+/g, "")),
    )
  ) {
    return true;
  }
  // 兼容「公司介绍 · 可在模板编辑…模块」等变体
  return (
    text.includes("模板编辑") &&
    (text.includes("增删模块") ||
      text.includes("增加/删除模块") ||
      text.includes("增加删除模块"))
  );
}

export type PageSlotModuleProps = {
  /** 嵌入对应导航页的业务主体 */
  slot: PageSlotId;
};

export type VideoModuleProps = {
  /** 直链或站内媒体 URL；微信内优先 playsInline */
  url: string;
  poster: string;
  title: string;
};

export type AnimationModuleProps = {
  /** css=纯 CSS 动效；gif=动图；lottie=JSON URL（可选） */
  kind: "css" | "gif" | "lottie";
  src: string;
  cssPreset: "fade" | "pulse" | "float" | "shine";
  title: string;
  height: number;
};

export type ButtonModuleProps = {
  text: string;
  href: string;
  align: "left" | "center" | "right";
  variant: "primary" | "outline" | "soft";
};

export type DualColumnModuleProps = {
  leftTitle: string;
  leftHtml: string;
  rightImage: string;
  rightHref: string;
};

export type DividerModuleProps = {
  style: "solid" | "dashed" | "dotted";
  color: string;
  thickness: number;
};

export type HeadingModuleProps = {
  text: string;
  level: 1 | 2 | 3;
  align: "left" | "center" | "right";
};

export type NoticeModuleProps = {
  text: string;
  tone: "info" | "warn" | "success";
};

export type CountdownModuleProps = {
  title: string;
  /** ISO 目标时间；未到则前台倒计时 */
  targetAt: string;
};

export type LinkCardModuleProps = {
  title: string;
  description: string;
  href: string;
  imageUrl: string;
};

export type AudioModuleProps = {
  url: string;
  title: string;
};

export type IconRowItem = {
  id: string;
  icon: string;
  label: string;
  href: string;
};

export type IconRowModuleProps = {
  items: IconRowItem[];
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type FaqModuleProps = {
  title: string;
  items: FaqItem[];
};

export type TestimonialItem = {
  id: string;
  name: string;
  quote: string;
  avatar: string;
};

export type TestimonialModuleProps = {
  title: string;
  items: TestimonialItem[];
};

export type CouponModuleProps = {
  title: string;
  subtitle: string;
  href: string;
};

export type GalleryImage = {
  id: string;
  url: string;
  alt: string;
};

export type GalleryModuleProps = {
  columns: 2 | 3;
  images: GalleryImage[];
};

export type EmbedModuleProps = {
  /** 仅允许 https，前台 iframe sandbox */
  url: string;
  height: number;
  title: string;
};

export type MarqueeModuleProps = {
  text: string;
  speed: number;
};

export type SocialLinkItem = {
  id: string;
  label: string;
  href: string;
};

export type SocialLinksModuleProps = {
  items: SocialLinkItem[];
};

export type StatItem = {
  id: string;
  label: string;
  value: string;
};

export type StatsModuleProps = {
  items: StatItem[];
};

export type BlankCardModuleProps = {
  title: string;
  body: string;
  minHeight: number;
};

export type PageModulePropsMap = {
  search: SearchModuleProps;
  banner: BannerModuleProps;
  image: ImageModuleProps;
  courses: CoursesModuleProps;
  categories: CategoriesModuleProps;
  teachers: TeachersModuleProps;
  spacer: SpacerModuleProps;
  richtext: RichtextModuleProps;
  pageSlot: PageSlotModuleProps;
  video: VideoModuleProps;
  animation: AnimationModuleProps;
  button: ButtonModuleProps;
  dualColumn: DualColumnModuleProps;
  divider: DividerModuleProps;
  heading: HeadingModuleProps;
  notice: NoticeModuleProps;
  countdown: CountdownModuleProps;
  linkCard: LinkCardModuleProps;
  audio: AudioModuleProps;
  iconRow: IconRowModuleProps;
  faq: FaqModuleProps;
  testimonial: TestimonialModuleProps;
  coupon: CouponModuleProps;
  gallery: GalleryModuleProps;
  embed: EmbedModuleProps;
  marquee: MarqueeModuleProps;
  socialLinks: SocialLinksModuleProps;
  stats: StatsModuleProps;
  blankCard: BlankCardModuleProps;
};

export type PageModule<T extends PageModuleType = PageModuleType> = {
  id: string;
  type: T;
  props: PageModulePropsMap[T];
  /** 可选；缺省按文档流全宽处理（旧数据兼容） */
  layout?: PageModuleLayout;
};

export type PageTemplate = {
  id: string;
  type: PageTemplateType;
  name: string;
  /** custom 页唯一路径段；home/account 可空 */
  slug: string;
  isDefault: boolean;
  /**
   * 系统锁定模板：永久保留在列表，不可编辑模块、不可删除；
   * 可「设为默认」以恢复系统原页面（模块为空时前台走经典布局）。
   */
  locked: boolean;
  /** 列表卡片封面（预览图） */
  coverUrl: string;
  /** 页面背景图（模块区背后） */
  backgroundUrl: string;
  modules: PageModule[];
  updatedAt: string;
  createdAt: string;
};

/** 各导航页系统默认模板的稳定 id，确保永不丢、可恢复 */
export function systemDefaultTemplateId(type: PageTemplateType) {
  return `sys-default-${type}`;
}

export function isSystemDefaultTemplateId(id: string) {
  return id.startsWith("sys-default-");
}

export type PageTemplatesConfig = {
  templates: PageTemplate[];
};

export const PAGE_MODULE_LIBRARY: {
  type: PageModuleType;
  label: string;
  hint: string;
}[] = [
  { type: "search", label: "搜索框", hint: "跳转课程广场搜索" },
  { type: "banner", label: "幻灯图", hint: "多图轮播 Banner" },
  { type: "image", label: "单图片", hint: "一张图，可带链接" },
  { type: "courses", label: "课程板块", hint: "拉取已发布课程" },
  { type: "categories", label: "课程分类", hint: "展示分类入口" },
  { type: "teachers", label: "名师风采", hint: "有课的老师" },
  { type: "spacer", label: "空白", hint: "模块间距" },
  { type: "richtext", label: "富文本", hint: "简单 HTML / 文案" },
  {
    type: "pageSlot",
    label: "页面功能区",
    hint: "嵌入导航页原有业务（广场/介绍/个人中心等）",
  },
  { type: "video", label: "视频", hint: "HTML5 视频，微信可播" },
  { type: "animation", label: "动画", hint: "CSS / GIF / Lottie 动效" },
  { type: "button", label: "按钮", hint: "行动号召 CTA" },
  { type: "dualColumn", label: "双栏图文", hint: "左文右图并排" },
  { type: "divider", label: "分割线", hint: "区块分隔" },
  { type: "heading", label: "标题", hint: "章节大标题" },
  { type: "notice", label: "公告栏", hint: "提示 / 警告条" },
  { type: "countdown", label: "倒计时", hint: "活动截止时间" },
  { type: "linkCard", label: "外链卡片", hint: "地图或外链入口" },
  { type: "audio", label: "音频", hint: "音频播放器" },
  { type: "iconRow", label: "图标行", hint: "多入口图标导航" },
  { type: "faq", label: "FAQ", hint: "常见问题折叠" },
  { type: "testimonial", label: "评价证言", hint: "学员口碑" },
  { type: "coupon", label: "优惠券入口", hint: "引导领券/活动" },
  { type: "gallery", label: "画廊", hint: "多图网格" },
  { type: "embed", label: "嵌入", hint: "安全 iframe 外链" },
  { type: "marquee", label: "滚动公告", hint: "横向滚动文案" },
  { type: "socialLinks", label: "社交链接", hint: "社媒 / 社群入口" },
  { type: "stats", label: "统计数字", hint: "关键数据展示" },
  { type: "blankCard", label: "空白卡片", hint: "占位文案卡片" },
];

export const PAGE_SLOT_LABEL: Record<PageSlotId, string> = {
  company: "公司介绍内容",
  person: "个人介绍内容",
  courses: "网课资料广场",
  meetup: "约搭广场",
  shop: "商城占位",
  products: "软件产品列表",
  forum: "大学论坛内容",
  games: "游戏中心占位",
  account: "个人中心内容",
};

export const PAGE_TEMPLATE_TYPE_LABEL: Record<PageTemplateType, string> = {
  home: "首页",
  company: "公司介绍",
  person: "个人介绍",
  courses: "网课资料",
  meetup: "约搭",
  shop: "商城",
  products: "软件产品",
  forum: "大学论坛",
  games: "游戏中心",
  account: "个人中心",
  custom: "自定义",
};

const MODULE_TYPE_SET = new Set<string>(PAGE_MODULE_LIBRARY.map((m) => m.type));
const TEMPLATE_TYPE_SET = new Set<string>(Object.keys(PAGE_TEMPLATE_TYPE_LABEL));
const PAGE_SLOT_SET = new Set<string>(Object.keys(PAGE_SLOT_LABEL));

/** API / 校验用：全部合法模块 type */
export const PAGE_MODULE_TYPES = PAGE_MODULE_LIBRARY.map((m) => m.type);

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newModuleId() {
  return newId("mod");
}

export function newTemplateId() {
  return newId("tpl");
}

export function defaultModuleLayout(): PageModuleLayout {
  return {
    mode: "flow",
    column: "full",
    x: 0,
    y: 0,
    width: 100,
    zIndex: 1,
  };
}

export function resolveModuleLayout(
  layout?: PageModuleLayout | null,
): PageModuleLayout {
  return layout ? { ...defaultModuleLayout(), ...layout } : defaultModuleLayout();
}

export function defaultModuleProps(type: PageModuleType): PageModulePropsMap[PageModuleType] {
  switch (type) {
    case "search":
      return { placeholder: "搜索课程 / 资料" };
    case "banner":
      return {
        slides: [
          {
            id: newId("slide"),
            url: "/covers/hero-seminar.jpg",
            alt: "幻灯图",
            href: "/courses",
          },
        ],
        height: 160,
      };
    case "image":
      return {
        url: "/covers/team-collab.jpg",
        alt: "图片",
        href: "",
        radius: 16,
      };
    case "courses":
      return {
        title: "热门课程",
        subtitle: "精选已上架课程",
        limit: 6,
        categorySlug: "",
      };
    case "categories":
      return { title: "课程分类" };
    case "teachers":
      return { title: "名师风采", limit: 6 };
    case "spacer":
      return { height: 24 };
    case "richtext":
      // 默认空内容：避免编辑器占位文案泄漏到前台非站长用户
      return { html: "" };
    case "pageSlot":
      return { slot: "courses" };
    case "video":
      return {
        url: "",
        poster: "/covers/hero-seminar.jpg",
        title: "视频介绍",
      };
    case "animation":
      return {
        kind: "css",
        src: "",
        cssPreset: "float",
        title: "动效横幅",
        height: 120,
      };
    case "button":
      return {
        text: "立即了解",
        href: "/courses",
        align: "center",
        variant: "primary",
      };
    case "dualColumn":
      return {
        leftTitle: "图文介绍",
        leftHtml: "<p>在此填写左侧文案</p>",
        rightImage: "/covers/team-collab.jpg",
        rightHref: "",
      };
    case "divider":
      return { style: "solid", color: "#e2e8f0", thickness: 1 };
    case "heading":
      return { text: "章节标题", level: 2, align: "left" };
    case "notice":
      return { text: "重要公告：请及时关注活动信息", tone: "info" };
    case "countdown": {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return {
        title: "活动倒计时",
        targetAt: d.toISOString(),
      };
    }
    case "linkCard":
      return {
        title: "查看详情",
        description: "点击跳转外链或地图",
        href: "https://map.baidu.com",
        imageUrl: "/covers/team-collab.jpg",
      };
    case "audio":
      return { url: "", title: "音频资料" };
    case "iconRow":
      return {
        items: [
          { id: newId("icon"), icon: "📚", label: "课程", href: "/courses" },
          { id: newId("icon"), icon: "👥", label: "约搭", href: "/meetup" },
          { id: newId("icon"), icon: "🛒", label: "商城", href: "/shop" },
          { id: newId("icon"), icon: "👤", label: "我的", href: "/account" },
        ],
      };
    case "faq":
      return {
        title: "常见问题",
        items: [
          {
            id: newId("faq"),
            question: "如何开始学习？",
            answer: "购买课程后即可在「我的学习」中观看。",
          },
          {
            id: newId("faq"),
            question: "支持退款吗？",
            answer: "请查看平台退款规则或联系客服。",
          },
        ],
      };
    case "testimonial":
      return {
        title: "学员评价",
        items: [
          {
            id: newId("tm"),
            name: "学员 A",
            quote: "课程很实用，讲解清晰！",
            avatar: "",
          },
        ],
      };
    case "coupon":
      return {
        title: "领取优惠",
        subtitle: "限时活动入口",
        href: "/courses",
      };
    case "gallery":
      return {
        columns: 2,
        images: [
          {
            id: newId("gal"),
            url: "/covers/hero-seminar.jpg",
            alt: "图1",
          },
          {
            id: newId("gal"),
            url: "/covers/team-collab.jpg",
            alt: "图2",
          },
        ],
      };
    case "embed":
      return {
        url: "",
        height: 220,
        title: "嵌入内容",
      };
    case "marquee":
      return {
        text: "欢迎来到 YYDS 课程平台 · 优质课程持续上新",
        speed: 40,
      };
    case "socialLinks":
      return {
        items: [
          { id: newId("soc"), label: "微信公众号", href: "#" },
          { id: newId("soc"), label: "社群", href: "#" },
        ],
      };
    case "stats":
      return {
        items: [
          { id: newId("st"), label: "学员", value: "10,000+" },
          { id: newId("st"), label: "课程", value: "200+" },
          { id: newId("st"), label: "好评率", value: "98%" },
        ],
      };
    case "blankCard":
      return {
        title: "卡片标题",
        body: "在此填写说明文案",
        minHeight: 80,
      };
    default:
      return { placeholder: "搜索课程 / 资料" };
  }
}

export function createModule(type: PageModuleType): PageModule {
  return {
    id: newModuleId(),
    type,
    props: defaultModuleProps(type) as PageModule["props"],
    layout: defaultModuleLayout(),
  };
}

function slugify(input: string) {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || `page-${Date.now().toString(36).slice(-6)}`;
}

export function createTemplate(type: PageTemplateType, name?: string): PageTemplate {
  const now = new Date().toISOString();
  const label = name?.trim() || `${PAGE_TEMPLATE_TYPE_LABEL[type]}模板`;
  let modules: PageModule[];
  if (type === "home") {
    modules = [
      createModule("banner"),
      createModule("search"),
      createModule("courses"),
    ];
  } else if (type === "custom") {
    modules = [createModule("image"), createModule("richtext")];
  } else if (PAGE_SLOT_SET.has(type)) {
    const slotMod = createModule("pageSlot");
    (slotMod.props as PageSlotModuleProps).slot = type as PageSlotId;
    modules = [createModule("richtext"), slotMod];
  } else {
    modules = [createModule("richtext")];
  }

  return {
    id: newTemplateId(),
    type,
    name: label,
    slug: type === "custom" ? slugify(label) : "",
    isDefault: false,
    locked: false,
    coverUrl: "",
    backgroundUrl: "",
    modules,
    createdAt: now,
    updatedAt: now,
  };
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeSlide(raw: unknown): BannerSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const url = asString(o.url).trim();
  if (!url) return null;
  return {
    id: asString(o.id) || newId("slide"),
    url: url.slice(0, 800),
    alt: asString(o.alt).slice(0, 120),
    href: asString(o.href).slice(0, 500),
  };
}

function normalizeLayout(raw: unknown): PageModuleLayout | undefined {
  // 旧模板无 layout 字段 → undefined，渲染端按 flow 全宽处理
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const mode = asString(o.mode, "flow") === "absolute" ? "absolute" : "flow";
  const colRaw = asString(o.column, "full");
  const column =
    colRaw === "left" || colRaw === "right" ? colRaw : "full";
  return {
    mode,
    column,
    x: asNumber(o.x, 0, 0, 100),
    y: asNumber(o.y, 0, 0, 4000),
    width: asNumber(o.width, 100, 10, 100),
    zIndex: asNumber(o.zIndex, 1, 0, 100),
  };
}

function normalizeIdList<T extends { id: string }>(
  raw: unknown,
  mapOne: (item: unknown) => T | null,
  fallback: T[],
  max: number,
): T[] {
  if (!Array.isArray(raw)) return fallback;
  const list = raw.map(mapOne).filter((x): x is T => Boolean(x));
  return list.length ? list.slice(0, max) : fallback;
}

function normalizeModuleProps(
  type: PageModuleType,
  raw: unknown,
): PageModulePropsMap[PageModuleType] {
  const o =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const defaults = defaultModuleProps(type);

  switch (type) {
    case "search":
      return {
        placeholder:
          asString(o.placeholder, (defaults as SearchModuleProps).placeholder).slice(
            0,
            80,
          ) || "搜索课程 / 资料",
      };
    case "banner": {
      const slides = Array.isArray(o.slides)
        ? o.slides.map(normalizeSlide).filter((s): s is BannerSlide => Boolean(s))
        : [];
      return {
        slides: slides.length
          ? slides.slice(0, 12)
          : (defaults as BannerModuleProps).slides,
        height: asNumber(o.height, (defaults as BannerModuleProps).height, 80, 420),
      };
    }
    case "image":
      return {
        url: asString(o.url, (defaults as ImageModuleProps).url).slice(0, 800),
        alt: asString(o.alt).slice(0, 120),
        href: asString(o.href).slice(0, 500),
        radius: asNumber(o.radius, (defaults as ImageModuleProps).radius, 0, 40),
      };
    case "courses":
      return {
        title: asString(o.title, (defaults as CoursesModuleProps).title).slice(0, 80) ||
          "热门课程",
        subtitle: asString(o.subtitle).slice(0, 160),
        limit: asNumber(o.limit, (defaults as CoursesModuleProps).limit, 1, 24),
        categorySlug: asString(o.categorySlug).slice(0, 80),
      };
    case "categories":
      return {
        title:
          asString(o.title, (defaults as CategoriesModuleProps).title).slice(0, 80) ||
          "课程分类",
      };
    case "teachers":
      return {
        title:
          asString(o.title, (defaults as TeachersModuleProps).title).slice(0, 80) ||
          "名师风采",
        limit: asNumber(o.limit, (defaults as TeachersModuleProps).limit, 1, 24),
      };
    case "spacer":
      return {
        height: asNumber(o.height, (defaults as SpacerModuleProps).height, 8, 200),
      };
    case "richtext":
      return {
        html: asString(o.html, (defaults as RichtextModuleProps).html).slice(0, 20000),
      };
    case "pageSlot": {
      const slot = asString(o.slot, (defaults as PageSlotModuleProps).slot);
      return {
        slot: (PAGE_SLOT_SET.has(slot) ? slot : "courses") as PageSlotId,
      };
    }
    case "video":
      return {
        url: asString(o.url).slice(0, 800),
        poster: asString(o.poster, (defaults as VideoModuleProps).poster).slice(0, 800),
        title: asString(o.title, (defaults as VideoModuleProps).title).slice(0, 120),
      };
    case "animation": {
      const kindRaw = asString(o.kind, "css");
      const kind =
        kindRaw === "gif" || kindRaw === "lottie" ? kindRaw : "css";
      const presetRaw = asString(o.cssPreset, "float");
      const cssPreset =
        presetRaw === "fade" ||
        presetRaw === "pulse" ||
        presetRaw === "shine"
          ? presetRaw
          : "float";
      return {
        kind,
        src: asString(o.src).slice(0, 800),
        cssPreset,
        title: asString(o.title, (defaults as AnimationModuleProps).title).slice(
          0,
          80,
        ),
        height: asNumber(
          o.height,
          (defaults as AnimationModuleProps).height,
          60,
          400,
        ),
      };
    }
    case "button": {
      const alignRaw = asString(o.align, "center");
      const align =
        alignRaw === "left" || alignRaw === "right" ? alignRaw : "center";
      const variantRaw = asString(o.variant, "primary");
      const variant =
        variantRaw === "outline" || variantRaw === "soft"
          ? variantRaw
          : "primary";
      return {
        text:
          asString(o.text, (defaults as ButtonModuleProps).text).slice(0, 40) ||
          "立即了解",
        href: asString(o.href).slice(0, 500),
        align,
        variant,
      };
    }
    case "dualColumn":
      return {
        leftTitle: asString(
          o.leftTitle,
          (defaults as DualColumnModuleProps).leftTitle,
        ).slice(0, 80),
        leftHtml: asString(
          o.leftHtml,
          (defaults as DualColumnModuleProps).leftHtml,
        ).slice(0, 8000),
        rightImage: asString(
          o.rightImage,
          (defaults as DualColumnModuleProps).rightImage,
        ).slice(0, 800),
        rightHref: asString(o.rightHref).slice(0, 500),
      };
    case "divider": {
      const styleRaw = asString(o.style, "solid");
      const style =
        styleRaw === "dashed" || styleRaw === "dotted" ? styleRaw : "solid";
      return {
        style,
        color: asString(o.color, (defaults as DividerModuleProps).color).slice(
          0,
          32,
        ),
        thickness: asNumber(
          o.thickness,
          (defaults as DividerModuleProps).thickness,
          1,
          8,
        ),
      };
    }
    case "heading": {
      const levelNum = asNumber(o.level, 2, 1, 3) as 1 | 2 | 3;
      const alignRaw = asString(o.align, "left");
      const align =
        alignRaw === "center" || alignRaw === "right" ? alignRaw : "left";
      return {
        text:
          asString(o.text, (defaults as HeadingModuleProps).text).slice(0, 120) ||
          "章节标题",
        level: levelNum,
        align,
      };
    }
    case "notice": {
      const toneRaw = asString(o.tone, "info");
      const tone =
        toneRaw === "warn" || toneRaw === "success" ? toneRaw : "info";
      return {
        text: asString(o.text, (defaults as NoticeModuleProps).text).slice(0, 200),
        tone,
      };
    }
    case "countdown":
      return {
        title: asString(o.title, (defaults as CountdownModuleProps).title).slice(
          0,
          80,
        ),
        targetAt: asString(
          o.targetAt,
          (defaults as CountdownModuleProps).targetAt,
        ).slice(0, 40),
      };
    case "linkCard":
      return {
        title: asString(o.title, (defaults as LinkCardModuleProps).title).slice(
          0,
          80,
        ),
        description: asString(o.description).slice(0, 200),
        href: asString(o.href).slice(0, 500),
        imageUrl: asString(o.imageUrl).slice(0, 800),
      };
    case "audio":
      return {
        url: asString(o.url).slice(0, 800),
        title: asString(o.title, (defaults as AudioModuleProps).title).slice(0, 80),
      };
    case "iconRow": {
      const fallback = (defaults as IconRowModuleProps).items;
      const items = normalizeIdList(
        o.items,
        (item) => {
          if (!item || typeof item !== "object") return null;
          const it = item as Record<string, unknown>;
          return {
            id: asString(it.id) || newId("icon"),
            icon: asString(it.icon, "⭐").slice(0, 8) || "⭐",
            label: asString(it.label).slice(0, 20) || "入口",
            href: asString(it.href).slice(0, 500),
          };
        },
        fallback,
        8,
      );
      return { items };
    }
    case "faq": {
      const fallback = (defaults as FaqModuleProps).items;
      const items = normalizeIdList(
        o.items,
        (item) => {
          if (!item || typeof item !== "object") return null;
          const it = item as Record<string, unknown>;
          const question = asString(it.question).trim();
          if (!question) return null;
          return {
            id: asString(it.id) || newId("faq"),
            question: question.slice(0, 120),
            answer: asString(it.answer).slice(0, 1000),
          };
        },
        fallback,
        20,
      );
      return {
        title: asString(o.title, (defaults as FaqModuleProps).title).slice(0, 80),
        items,
      };
    }
    case "testimonial": {
      const fallback = (defaults as TestimonialModuleProps).items;
      const items = normalizeIdList(
        o.items,
        (item) => {
          if (!item || typeof item !== "object") return null;
          const it = item as Record<string, unknown>;
          return {
            id: asString(it.id) || newId("tm"),
            name: asString(it.name).slice(0, 40) || "学员",
            quote: asString(it.quote).slice(0, 400),
            avatar: asString(it.avatar).slice(0, 800),
          };
        },
        fallback,
        12,
      );
      return {
        title: asString(o.title, (defaults as TestimonialModuleProps).title).slice(
          0,
          80,
        ),
        items,
      };
    }
    case "coupon":
      return {
        title: asString(o.title, (defaults as CouponModuleProps).title).slice(0, 80),
        subtitle: asString(o.subtitle).slice(0, 120),
        href: asString(o.href).slice(0, 500),
      };
    case "gallery": {
      const cols = asNumber(o.columns, 2, 2, 3) as 2 | 3;
      const fallback = (defaults as GalleryModuleProps).images;
      const images = normalizeIdList(
        o.images,
        (item) => {
          if (!item || typeof item !== "object") return null;
          const it = item as Record<string, unknown>;
          const url = asString(it.url).trim();
          if (!url) return null;
          return {
            id: asString(it.id) || newId("gal"),
            url: url.slice(0, 800),
            alt: asString(it.alt).slice(0, 80),
          };
        },
        fallback,
        24,
      );
      return { columns: cols, images };
    }
    case "embed": {
      // 业务：仅保留 https，避免 javascript: / 相对危险协议注入 iframe
      let url = asString(o.url).trim().slice(0, 800);
      if (url && !/^https:\/\//i.test(url)) url = "";
      return {
        url,
        height: asNumber(o.height, (defaults as EmbedModuleProps).height, 100, 800),
        title: asString(o.title, (defaults as EmbedModuleProps).title).slice(0, 80),
      };
    }
    case "marquee":
      return {
        text: asString(o.text, (defaults as MarqueeModuleProps).text).slice(0, 500),
        speed: asNumber(o.speed, (defaults as MarqueeModuleProps).speed, 10, 100),
      };
    case "socialLinks": {
      const fallback = (defaults as SocialLinksModuleProps).items;
      const items = normalizeIdList(
        o.items,
        (item) => {
          if (!item || typeof item !== "object") return null;
          const it = item as Record<string, unknown>;
          return {
            id: asString(it.id) || newId("soc"),
            label: asString(it.label).slice(0, 40) || "链接",
            href: asString(it.href).slice(0, 500),
          };
        },
        fallback,
        12,
      );
      return { items };
    }
    case "stats": {
      const fallback = (defaults as StatsModuleProps).items;
      const items = normalizeIdList(
        o.items,
        (item) => {
          if (!item || typeof item !== "object") return null;
          const it = item as Record<string, unknown>;
          return {
            id: asString(it.id) || newId("st"),
            label: asString(it.label).slice(0, 40) || "指标",
            value: asString(it.value).slice(0, 40) || "0",
          };
        },
        fallback,
        8,
      );
      return { items };
    }
    case "blankCard":
      return {
        title: asString(o.title, (defaults as BlankCardModuleProps).title).slice(
          0,
          80,
        ),
        body: asString(o.body, (defaults as BlankCardModuleProps).body).slice(
          0,
          500,
        ),
        minHeight: asNumber(
          o.minHeight,
          (defaults as BlankCardModuleProps).minHeight,
          40,
          400,
        ),
      };
    default:
      return defaults;
  }
}

function normalizeModule(raw: unknown): PageModule | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = asString(o.type);
  if (!MODULE_TYPE_SET.has(type)) return null;
  const moduleType = type as PageModuleType;
  const layout = normalizeLayout(o.layout);
  return {
    id: asString(o.id) || newModuleId(),
    type: moduleType,
    props: normalizeModuleProps(moduleType, o.props) as PageModule["props"],
    ...(layout ? { layout } : {}),
  };
}

/** 保存前净化模块列表（校验 type / props / layout） */
export function normalizePageModules(raw: unknown): PageModule[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeModule)
    .filter((m): m is PageModule => Boolean(m))
    .slice(0, 40);
}

function normalizeTemplate(raw: unknown): PageTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = asString(o.type);
  if (!TEMPLATE_TYPE_SET.has(type)) return null;
  const tplType = type as PageTemplateType;
  const modules = Array.isArray(o.modules)
    ? o.modules.map(normalizeModule).filter((m): m is PageModule => Boolean(m))
    : [];
  const name = asString(o.name).trim().slice(0, 80) || PAGE_TEMPLATE_TYPE_LABEL[tplType];
  const now = new Date().toISOString();
  let slug = asString(o.slug).trim().slice(0, 64);
  if (tplType === "custom" && !slug) slug = slugify(name);
  if (tplType !== "custom") slug = "";

  const id = asString(o.id) || newTemplateId();
  const locked =
    asBoolean(o.locked) || isSystemDefaultTemplateId(id);

  return {
    id,
    type: tplType,
    name,
    slug,
    isDefault: asBoolean(o.isDefault),
    locked,
    coverUrl: asString(o.coverUrl).slice(0, 800),
    backgroundUrl: asString(o.backgroundUrl).slice(0, 800),
    // 锁定模板永远不带 DIY 模块，前台走系统经典页
    modules: locked ? [] : modules.slice(0, 40),
    createdAt: asString(o.createdAt) || now,
    updatedAt: asString(o.updatedAt) || now,
  };
}

/**
 * 每个 type 最多一份默认：多份时保留第一个 isDefault，其余关掉。
 * custom 的 slug 全局唯一（冲突时追加后缀）。
 * 系统锁定模板强制保留锁定态与空模块。
 */
export function normalizeTemplatesConfig(
  templates: PageTemplate[],
): PageTemplatesConfig {
  const seenDefault = new Set<PageTemplateType>();
  const seenSlug = new Set<string>();
  const seenId = new Set<string>();
  const next: PageTemplate[] = [];

  for (const tpl of templates) {
    let id = tpl.id;
    // 系统锁定 id 不可被改写成随机 id
    if (!isSystemDefaultTemplateId(id)) {
      if (!id || seenId.has(id)) id = newTemplateId();
    }
    if (seenId.has(id)) continue;
    seenId.add(id);

    const locked = Boolean(tpl.locked) || isSystemDefaultTemplateId(id);
    let isDefault = tpl.isDefault;
    // 旧「首页默认模板」DIY 壳不再抢默认
    if (
      isDefault &&
      !locked &&
      tpl.type === "home" &&
      tpl.name === "首页默认模板" &&
      isAutoHomeStub(tpl)
    ) {
      isDefault = false;
    }
    if (isDefault) {
      if (seenDefault.has(tpl.type)) isDefault = false;
      else seenDefault.add(tpl.type);
    }

    let slug = tpl.slug;
    if (tpl.type === "custom") {
      let candidate = slug || slugify(tpl.name);
      let n = 2;
      while (seenSlug.has(candidate)) {
        candidate = `${slugify(tpl.name)}-${n}`.slice(0, 64);
        n += 1;
      }
      slug = candidate;
      seenSlug.add(slug);
    } else {
      slug = "";
    }

    const name = locked
      ? systemDefaultTemplateName(tpl.type)
      : tpl.name;

    next.push({
      ...tpl,
      id,
      slug,
      name,
      isDefault,
      locked,
      modules: locked ? [] : tpl.modules,
      coverUrl: locked ? "" : tpl.coverUrl,
      backgroundUrl: locked ? "" : tpl.backgroundUrl,
    });
  }

  return { templates: next };
}

export function systemDefaultTemplateName(type: PageTemplateType) {
  const label = PAGE_TEMPLATE_TYPE_LABEL[type] || type;
  return `系统默认·${label}（不可改删）`;
}

/** 同步导航时写入的首页三模块壳（banner/search/courses），未深度定制 */
function isAutoHomeStub(tpl: PageTemplate) {
  if (tpl.modules.length !== 3) return false;
  const kinds = tpl.modules.map((m) => m.type).join(",");
  return kinds === "banner,search,courses";
}

export const DEFAULT_PAGE_TEMPLATES: PageTemplatesConfig = {
  templates: [],
};

export function parsePageTemplates(
  raw: string | null | undefined,
): PageTemplatesConfig {
  if (!raw?.trim()) return structuredClone(DEFAULT_PAGE_TEMPLATES);
  try {
    const parsed = JSON.parse(raw) as Partial<PageTemplatesConfig> | PageTemplate[];
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.templates)
        ? parsed.templates
        : [];
    const templates = list
      .map(normalizeTemplate)
      .filter((t): t is PageTemplate => Boolean(t));
    return normalizeTemplatesConfig(templates);
  } catch {
    return structuredClone(DEFAULT_PAGE_TEMPLATES);
  }
}

export function stringifyPageTemplates(config: PageTemplatesConfig) {
  return JSON.stringify(normalizeTemplatesConfig(config.templates));
}

/**
 * 仅返回「已设为默认」的模板。
 * 未点「设为默认」的新建模板绝不落前台，避免盖掉系统原有首页/介绍页。
 */
export function getDefaultTemplate(
  config: PageTemplatesConfig,
  type: PageTemplateType,
): PageTemplate | null {
  return (
    config.templates.find((t) => t.type === type && t.isDefault) || null
  );
}

export function getTemplateById(
  config: PageTemplatesConfig,
  id: string,
): PageTemplate | null {
  return config.templates.find((t) => t.id === id) || null;
}

export function getCustomTemplateBySlug(
  config: PageTemplatesConfig,
  slug: string,
): PageTemplate | null {
  const key = slug.trim();
  if (!key) return null;
  return (
    config.templates.find((t) => t.type === "custom" && t.slug === key) || null
  );
}

export function publicTemplatePath(template: PageTemplate) {
  switch (template.type) {
    case "home":
      return "/";
    case "company":
      return "/about/company";
    case "person":
      return "/about/person";
    case "courses":
      return "/courses";
    case "meetup":
      return "/meetup";
    case "shop":
      return "/shop";
    case "products":
      return "/products";
    case "forum":
      return "/forum";
    case "games":
      return "/games";
    case "account":
      return "/account";
    case "custom":
      return `/p/${template.slug}`;
    default:
      return `/p/${template.slug}`;
  }
}

export function moduleLabel(type: PageModuleType) {
  return PAGE_MODULE_LIBRARY.find((m) => m.type === type)?.label || type;
}

/**
 * 复制模板时：生成新模块 id，避免多副本共享同一 id。
 * 锁定/空模块源用 starter 模块；否则深拷贝源模块并换 id。
 */
export function cloneModulesForDuplicate(
  sourceModules: PageModule[],
  fallbackModules: PageModule[],
): PageModule[] {
  const base =
    sourceModules.length > 0
      ? structuredClone(sourceModules)
      : structuredClone(fallbackModules);
  return base.map((m) => ({
    ...m,
    id: newModuleId(),
    layout: m.layout ? { ...resolveModuleLayout(m.layout) } : defaultModuleLayout(),
  }));
}

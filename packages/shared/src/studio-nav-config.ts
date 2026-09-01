/**
 * Studio 后台导航配置
 *
 * 默认菜单在 DEFAULT_STUDIO_NAV；内容管理可覆盖文案与链接，存 SiteSettings.studioNavJson。
 * 改默认菜单：改本文件；改线上文案：走 CMS，不必发版。
 *
 * 分区（见 studio-nav.tsx）：
 * - topBase：创作者中心（概览/素材/课程/分销/营销；订单查看仅站长可见）
 * - topAdmin：站长管理（用户/商家/产品/装修/内容/系统设置），不出现在创作者中心 Tab
 *   「装修」含网站装扮与页面模板；页面模板不再单独占顶栏 Tab，走装修子导航
 * - courses：产品中心子导航（创建 / 我的课程 / 我的约搭 / 我的资料）
 *
 * 可见性（见 packages/shared/src/roles.ts）：
 * - 站长：创作者中心看 topBase；站长管理看 topAdmin
 * - 老师/入驻商家：topBase（老师无营销；无订单查看）
 * - 加盟代理：overview + media + courses + distribution + marketing
 *
 * 「资料」与单课/专栏同属 Course.productType，创建入口在 compose（类型选「资料」），
 * 列表可按类型筛；子导航「我的资料」只是快捷筛选页，避免用户找不到入口。
 *
 * 「我的约搭」管 Meetup 活动（发起人视角），勿与 productType=MEETUP 壳商品混进课程列表。
 */

export type StudioNavLink = {
  /** 稳定键，排序/合并时用，不要靠中文 label */
  key: string;
  label: string;
  href: string;
};

export type StudioNavConfig = {
  /** 创作者中心顶部导航（含站长在创作者侧可见的「订单查看」） */
  topBase: StudioNavLink[];
  /** 站长管理顶部导航（仅 ADMIN；与创作者中心分离） */
  topAdmin: StudioNavLink[];
  /** 产品中心子导航（创建 / 课程 / 约搭 / 资料） */
  courses: StudioNavLink[];
};

/**
 * 站长管理 Tab 的稳定 key；合并时从创作者列表剥出，避免 CMS 旧数据卡在创作者导航。
 * templates 已降级为装修子项，仍保留 key 以便剥离子导航旧数据，默认顶栏不再渲染。
 */
export const STUDIO_ADMIN_HUB_NAV_KEYS = [
  "admin",
  "users",
  "merchants",
  "products",
  "shop",
  "meetup",
  "forum",
  "decorate",
  "templates",
  "cms",
  "wechat-mp",
  "person-social",
  "bg-music",
  "settings",
] as const;

/** 仅站长在创作者中心可见（不属于站长管理五件套） */
export const STUDIO_CREATOR_ADMIN_ONLY_KEYS = ["orders"] as const;

export const DEFAULT_STUDIO_NAV: StudioNavConfig = {
  topBase: [
    { key: "overview", label: "概览", href: "/studio" },
    { key: "media", label: "素材中心", href: "/studio/media" },
    { key: "courses", label: "课程与资料", href: "/studio/courses" },
    // 商家/代理也可上架商城商品（站长在 admin 区另有入口）
    { key: "shop", label: "商城商品", href: "/studio/shop" },
    { key: "distribution", label: "分销管理", href: "/studio/distribution" },
    { key: "marketing", label: "营销", href: "/studio/marketing" },
    // 订单查看留在创作者侧，便于站长边管课边看单；非站长会被 StudioNav 滤掉
    { key: "orders", label: "订单查看", href: "/studio/orders" },
  ],
  topAdmin: [
    { key: "admin", label: "站长概览", href: "/studio/admin" },
    { key: "users", label: "用户管理", href: "/studio/users" },
    { key: "merchants", label: "商家管理", href: "/studio/merchants" },
    // 全站可售产品（Course）次序/置顶/精华与增删改
    { key: "products", label: "产品管理", href: "/studio/products" },
    // 商城商品（productType=PRODUCT）：与课程/资料组课入口隔离
    { key: "shop", label: "商城商品", href: "/studio/shop" },
    // 约搭活动（Meetup）：全站增删改，与课程/商城并列；创作者侧另有「我的约搭」
    { key: "meetup", label: "约搭管理", href: "/studio/meetup" },
    { key: "forum", label: "论坛", href: "/studio/forum" },
    // 顶栏只保留「装修」；网站装扮 / 页面模板在 DecorateSubnav 切换
    { key: "decorate", label: "装修", href: "/studio/decorate" },
    { key: "cms", label: "内容管理", href: "/studio/cms" },
    { key: "wechat-mp", label: "公众号宣传", href: "/studio/wechat-mp" },
    { key: "person-social", label: "个人IP投稿", href: "/studio/person-social" },
    { key: "bg-music", label: "背景音乐", href: "/studio/bg-music" },
    { key: "settings", label: "系统设置", href: "/studio/settings" },
  ],
  // 默认：创建在左；约搭与课程/资料平行（活动语义，不进课程列表）
  courses: [
    { key: "compose", label: "创建产品", href: "/studio/courses/compose" },
    { key: "list", label: "我的课程", href: "/studio/courses" },
    { key: "meetup-mine", label: "我的约搭", href: "/studio/meetup/mine" },
    { key: "materials", label: "我的资料", href: "/studio/materials" },
  ],
};

const ADMIN_HUB_KEY_SET = new Set<string>(STUDIO_ADMIN_HUB_NAV_KEYS);
const CREATOR_ADMIN_ONLY_KEY_SET = new Set<string>(
  STUDIO_CREATOR_ADMIN_ONLY_KEYS,
);

function normalizeHref(value: string, fallback: string) {
  const href = value.trim().slice(0, 300);
  if (!href) return fallback;
  if (
    href.startsWith("/") ||
    href.startsWith("https://") ||
    href.startsWith("http://")
  ) {
    return href;
  }
  return fallback;
}

function asLinkArray(stored: unknown): Partial<StudioNavLink>[] {
  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (raw): raw is Partial<StudioNavLink> =>
      Boolean(raw) && typeof raw === "object",
  );
}

/**
 * 合并 CMS 覆盖与默认项。
 * 为何要迁移：旧版把站长五项塞进 topAdmin 并与 topBase 拼在创作者 Tab；
 * 若 CMS 曾把商家/装修等写进 topBase，或把订单留在 topAdmin，不剥出会串区。
 */
function migrateStoredSections(parsed: Partial<StudioNavConfig>): {
  topBase: Partial<StudioNavLink>[];
  topAdmin: Partial<StudioNavLink>[];
  courses: Partial<StudioNavLink>[];
} {
  const baseRaw = asLinkArray(parsed.topBase);
  const adminRaw = asLinkArray(parsed.topAdmin);
  const coursesRaw = asLinkArray(parsed.courses);

  const topBase: Partial<StudioNavLink>[] = [];
  const topAdmin: Partial<StudioNavLink>[] = [];
  const seenBase = new Set<string>();
  const seenAdmin = new Set<string>();

  for (const item of baseRaw) {
    const key = String(item.key || "");
    if (!key) continue;
    // 站长管理项误落在创作者列表 → 归到 topAdmin
    if (ADMIN_HUB_KEY_SET.has(key)) {
      if (!seenAdmin.has(key)) {
        seenAdmin.add(key);
        topAdmin.push(item);
      }
      continue;
    }
    if (!seenBase.has(key)) {
      seenBase.add(key);
      topBase.push(item);
    }
  }

  for (const item of adminRaw) {
    const key = String(item.key || "");
    if (!key) continue;
    // 订单查看应留在创作者侧（仅站长可见），不要占站长管理 Tab
    if (CREATOR_ADMIN_ONLY_KEY_SET.has(key)) {
      if (!seenBase.has(key)) {
        seenBase.add(key);
        topBase.push(item);
      }
      continue;
    }
    if (!seenAdmin.has(key)) {
      seenAdmin.add(key);
      topAdmin.push(item);
    }
  }

  // 旧 CMS 没有「个人IP投稿」时，插到公众号宣传后面，避免被挤到菜单末尾
  if (!seenAdmin.has("person-social")) {
    seenAdmin.add("person-social");
    const entry = { key: "person-social" };
    const wechatIdx = topAdmin.findIndex(
      (item) => String(item.key || "") === "wechat-mp",
    );
    if (wechatIdx >= 0) topAdmin.splice(wechatIdx + 1, 0, entry);
    else topAdmin.push(entry);
  }

  return {
    topBase,
    topAdmin,
    // 产品中心子菜单：补「我的约搭」、旧序把创建挪到课程前
    courses: migrateCoursesStoredOrder(coursesRaw, DEFAULT_STUDIO_NAV.courses),
  };
}

/**
 * 旧 studioNavJson 常缺 meetup-mine，且把 compose 排在 list 后。
 * 缺新项时按默认相对位置插入；仅在「补约搭入口」那次尽量把创建挪到我的课程前。
 * 已含 meetup-mine 的配置视为运营已可排序，完整尊重其顺序。
 */
function migrateCoursesStoredOrder(
  stored: Partial<StudioNavLink>[],
  defaults: StudioNavLink[],
): Partial<StudioNavLink>[] {
  const defaultKeys = defaults.map((d) => d.key);
  const defaultIndex = new Map(defaultKeys.map((k, i) => [k, i]));

  const byKey = new Map<string, Partial<StudioNavLink>>();
  const order: string[] = [];
  for (const item of stored) {
    const key = String(item.key || "");
    if (!key || !defaultIndex.has(key) || byKey.has(key)) continue;
    byKey.set(key, item);
    order.push(key);
  }

  const hadMeetupMine = order.includes("meetup-mine");

  for (const key of defaultKeys) {
    if (order.includes(key)) continue;
    const defIdx = defaultIndex.get(key)!;
    let insertAt = order.length;
    for (let i = 0; i < order.length; i += 1) {
      const existingDefIdx = defaultIndex.get(order[i]!)!;
      if (existingDefIdx > defIdx) {
        insertAt = i;
        break;
      }
    }
    order.splice(insertAt, 0, key);
    byKey.set(key, { key });
  }

  // 旧数据补约搭时顺带纠正「我的课程 → 创建产品」；已自定义过（含约搭项）则不强制
  if (!hadMeetupMine) {
    const composeIdx = order.indexOf("compose");
    const listIdx = order.indexOf("list");
    if (composeIdx >= 0 && listIdx >= 0 && composeIdx > listIdx) {
      order.splice(composeIdx, 1);
      const newListIdx = order.indexOf("list");
      order.splice(newListIdx, 0, "compose");
    }
  }

  return order.map((key) => byKey.get(key) || { key });
}

function mergeSection(
  defaults: StudioNavLink[],
  stored: unknown,
): StudioNavLink[] {
  const allowed = new Map(defaults.map((d) => [d.key, d]));
  const order: string[] = [];
  const overrides = new Map<string, { label: string; href: string }>();

  if (Array.isArray(stored)) {
    for (const raw of stored) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Partial<StudioNavLink>;
      const key = String(item.key || "");
      if (!key || !allowed.has(key) || order.includes(key)) continue;
      order.push(key);
      overrides.set(key, {
        label: String(item.label || ""),
        href: String(item.href || ""),
      });
    }
  }

  for (const d of defaults) {
    if (!order.includes(d.key)) order.push(d.key);
  }

  return order.map((key) => {
    const def = allowed.get(key)!;
    const override = overrides.get(key);
    return {
      key,
      label: (override?.label.trim() || def.label).slice(0, 40),
      href: normalizeHref(override?.href || "", def.href),
    };
  });
}

export function parseStudioNav(raw: string | null | undefined): StudioNavConfig {
  if (!raw?.trim()) return structuredClone(DEFAULT_STUDIO_NAV);
  try {
    const parsed = JSON.parse(raw) as Partial<StudioNavConfig>;
    const migrated = migrateStoredSections(parsed);
    return {
      topBase: mergeSection(DEFAULT_STUDIO_NAV.topBase, migrated.topBase),
      topAdmin: mergeSection(DEFAULT_STUDIO_NAV.topAdmin, migrated.topAdmin),
      courses: mergeSection(DEFAULT_STUDIO_NAV.courses, migrated.courses),
    };
  } catch {
    return structuredClone(DEFAULT_STUDIO_NAV);
  }
}

export function stringifyStudioNav(config: StudioNavConfig) {
  // 保存前再迁移一次，防止 CMS 面板把旧分区原样写回
  const migrated = migrateStoredSections(config);
  return JSON.stringify({
    topBase: mergeSection(DEFAULT_STUDIO_NAV.topBase, migrated.topBase),
    topAdmin: mergeSection(DEFAULT_STUDIO_NAV.topAdmin, migrated.topAdmin),
    courses: mergeSection(DEFAULT_STUDIO_NAV.courses, migrated.courses),
  });
}

export function studioNavLabel(
  items: StudioNavLink[],
  key: string,
  fallback: string,
) {
  return items.find((item) => item.key === key)?.label || fallback;
}

export function studioNavHref(
  items: StudioNavLink[],
  key: string,
  fallback: string,
) {
  return items.find((item) => item.key === key)?.href || fallback;
}

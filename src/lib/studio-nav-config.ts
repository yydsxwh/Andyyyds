/**
 * Studio 后台导航配置
 *
 * 默认菜单在 DEFAULT_STUDIO_NAV；内容管理可覆盖文案与链接，存 SiteSettings.studioNavJson。
 * 改默认菜单：改本文件；改线上文案：走 CMS，不必发版。
 */

export type StudioNavLink = {
  /** 稳定键，排序/合并时用，不要靠中文 label */
  key: string;
  label: string;
  href: string;
};

export type StudioNavConfig = {
  /** 讲师/管理员通用顶部导航 */
  topBase: StudioNavLink[];
  /** 仅管理员可见的顶部导航 */
  topAdmin: StudioNavLink[];
  /** 课程中心子导航 */
  courses: StudioNavLink[];
};

export const DEFAULT_STUDIO_NAV: StudioNavConfig = {
  topBase: [
    { key: "overview", label: "概览", href: "/studio" },
    { key: "media", label: "素材中心", href: "/studio/media" },
    { key: "courses", label: "课程中心", href: "/studio/courses" },
    { key: "distribution", label: "分销管理", href: "/studio/distribution" },
  ],
  topAdmin: [
    { key: "orders", label: "订单查看", href: "/studio/orders" },
    { key: "merchants", label: "商家管理", href: "/studio/merchants" },
    { key: "decorate", label: "店铺装修", href: "/studio/decorate" },
    { key: "cms", label: "内容管理", href: "/studio/cms" },
    { key: "settings", label: "系统设置", href: "/studio/settings" },
  ],
  courses: [
    { key: "list", label: "我的课程", href: "/studio/courses" },
    { key: "compose", label: "创建课程", href: "/studio/courses/compose" },
  ],
};

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
    return {
      topBase: mergeSection(DEFAULT_STUDIO_NAV.topBase, parsed.topBase),
      topAdmin: mergeSection(DEFAULT_STUDIO_NAV.topAdmin, parsed.topAdmin),
      courses: mergeSection(DEFAULT_STUDIO_NAV.courses, parsed.courses),
    };
  } catch {
    return structuredClone(DEFAULT_STUDIO_NAV);
  }
}

export function stringifyStudioNav(config: StudioNavConfig) {
  return JSON.stringify({
    topBase: mergeSection(DEFAULT_STUDIO_NAV.topBase, config.topBase),
    topAdmin: mergeSection(DEFAULT_STUDIO_NAV.topAdmin, config.topAdmin),
    courses: mergeSection(DEFAULT_STUDIO_NAV.courses, config.courses),
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

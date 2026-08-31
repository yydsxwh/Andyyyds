/**
 * 导航栏菜单 ↔ 页面模板类型。
 * 每种导航页始终保留一份「系统默认」锁定模板（不可改删），
 * 站长误设其它 DIY 为默认后，可再设回系统默认以恢复原页面。
 */

import {
  createModule,
  createTemplate,
  systemDefaultTemplateId,
  systemDefaultTemplateName,
  type PageModule,
  type PageTemplate,
  type PageTemplateType,
  type PageTemplatesConfig,
} from "./page-templates";

/** 与门户导航 / 站长常用入口对应的系统页模板（不含 custom） */
export const NAV_PAGE_TEMPLATE_TYPES = [
  "home",
  "company",
  "person",
  "courses",
  "meetup",
  "shop",
  "products",
  "forum",
  "games",
  "account",
] as const;

export type NavPageTemplateType = (typeof NAV_PAGE_TEMPLATE_TYPES)[number];

export type NavPageTemplateDef = {
  type: NavPageTemplateType;
  name: string;
  path: string;
  /** 默认模板内嵌的功能插槽；首页用营销模块，无 slot */
  slot?:
    | "company"
    | "person"
    | "courses"
    | "meetup"
    | "shop"
    | "products"
    | "forum"
    | "games"
    | "account";
};

export const NAV_PAGE_TEMPLATE_DEFS: NavPageTemplateDef[] = [
  { type: "home", name: "首页默认模板", path: "/" },
  {
    type: "company",
    name: "公司介绍默认模板",
    path: "/about/company",
    slot: "company",
  },
  {
    type: "person",
    name: "个人介绍默认模板",
    path: "/about/person",
    slot: "person",
  },
  {
    type: "courses",
    name: "网课资料默认模板",
    path: "/courses",
    slot: "courses",
  },
  {
    type: "meetup",
    name: "约搭默认模板",
    path: "/meetup",
    slot: "meetup",
  },
  {
    type: "shop",
    name: "商城默认模板",
    path: "/shop",
    slot: "shop",
  },
  {
    type: "products",
    name: "软件产品默认模板",
    path: "/products",
    slot: "products",
  },
  {
    type: "forum",
    name: "论坛默认模板",
    path: "/forum",
    slot: "forum",
  },
  {
    type: "games",
    name: "游戏中心默认模板",
    path: "/games",
    slot: "games",
  },
  {
    type: "account",
    name: "个人中心默认模板",
    path: "/account",
    slot: "account",
  },
];

export function isNavPageTemplateType(
  value: string,
): value is NavPageTemplateType {
  return (NAV_PAGE_TEMPLATE_TYPES as readonly string[]).includes(value);
}

function defaultModulesForNav(def: NavPageTemplateDef): PageModule[] {
  // 仅供「新建 DIY」草稿使用；系统锁定模板 modules 恒为空
  if (def.type === "home") {
    return [
      createModule("banner"),
      createModule("search"),
      createModule("courses"),
    ];
  }
  if (!def.slot) return [createModule("richtext")];
  const slotMod = createModule("pageSlot");
  (slotMod.props as { slot: string }).slot = def.slot;
  // 不再写入「可在模板编辑器增删模块」类占位：该文案仅站长可见，且新建 DIY 直接放功能区即可
  return [slotMod];
}

function buildLockedSystemTemplate(def: NavPageTemplateDef): PageTemplate {
  const now = new Date().toISOString();
  const type = def.type as PageTemplateType;
  return {
    id: systemDefaultTemplateId(type),
    type,
    name: systemDefaultTemplateName(type),
    slug: "",
    // 同类型尚无其它默认时，系统锁定页作为默认（前台=经典布局）
    isDefault: false,
    locked: true,
    coverUrl: "",
    backgroundUrl: "",
    modules: [],
    createdAt: now,
    updatedAt: now,
  };
}

function templatesSignature(templates: PageTemplate[]) {
  return JSON.stringify(
    templates.map((t) => ({
      id: t.id,
      type: t.type,
      name: t.name,
      isDefault: t.isDefault,
      locked: t.locked,
      modulesLen: t.modules.length,
      coverUrl: t.coverUrl,
      backgroundUrl: t.backgroundUrl,
      slug: t.slug,
    })),
  );
}

/**
 * 确保每个导航页都有一份锁定的「系统默认」模板，永久保存在列表中。
 * - 不可编辑 / 不可删除（由 API 与 UI 强制）
 * - 模块为空：设为默认时前台走系统经典页（含首页介绍文案）
 * - 若该类型没有任何默认，则把系统锁定页标为默认
 */
export function ensureNavDefaultTemplates(
  config: PageTemplatesConfig,
): { config: PageTemplatesConfig; added: number; changed: boolean } {
  const before = templatesSignature(config.templates);
  let templates = [...config.templates];
  let added = 0;

  for (const def of NAV_PAGE_TEMPLATE_DEFS) {
    const type = def.type as PageTemplateType;
    const sysId = systemDefaultTemplateId(type);
    const existingIdx = templates.findIndex((t) => t.id === sysId);
    if (existingIdx < 0) {
      templates.push(buildLockedSystemTemplate(def));
      added += 1;
    } else {
      // 强制保持锁定与空模块，防止历史脏数据改坏
      const cur = templates[existingIdx];
      templates[existingIdx] = {
        ...cur,
        id: sysId,
        type,
        name: systemDefaultTemplateName(type),
        locked: true,
        modules: [],
        coverUrl: "",
        backgroundUrl: "",
        slug: "",
      };
    }
  }

  // 每种类型：若无人占用默认，则系统锁定页成为默认（可随时改回）
  for (const def of NAV_PAGE_TEMPLATE_DEFS) {
    const type = def.type as PageTemplateType;
    const hasDefault = templates.some((t) => t.type === type && t.isDefault);
    if (hasDefault) continue;
    const sysId = systemDefaultTemplateId(type);
    templates = templates.map((t) =>
      t.id === sysId ? { ...t, isDefault: true } : t,
    );
  }

  const changed = before !== templatesSignature(templates);
  return { config: { templates }, added, changed };
}

/** 创建指定导航页类型的新 DIY 模板（可编辑，非锁定） */
export function createNavPageTemplate(
  type: PageTemplateType,
  name?: string,
): PageTemplate {
  const def = NAV_PAGE_TEMPLATE_DEFS.find((d) => d.type === type);
  if (!def) {
    return createTemplate(type, name);
  }
  const base = createTemplate(type, name || `${def.name.replace("默认模板", "")}自定义`);
  return {
    ...base,
    locked: false,
    isDefault: false,
    modules: defaultModulesForNav(def),
  };
}

/**
 * 前台门户配置：顶部导航 + 公司/个人介绍页文案
 *
 * 存 SiteSettings.portalJson；内容管理可改。默认即可先上线门户壳子。
 */

export type PortalNavLink = {
  key: string;
  label: string;
  href: string;
  /** false 时不在导航显示（保留配置） */
  enabled?: boolean;
  /** true 时跳转到「即将开放」提示页也可直接链到 /shop 等占位页 */
  comingSoon?: boolean;
};

export type PortalAboutPage = {
  /** 页面主标题 */
  title: string;
  /** 副标题 / 一句话 */
  subtitle: string;
  /** 正文，空行分段 */
  body: string;
  /** 侧栏或底部要点，可选 */
  highlights: { label: string; text: string }[];
};

/** 联系我们：内容管理可改；首页左上角直接展开展示 */
export type PortalContact = {
  /** 是否在前台显示联系信息 */
  enabled: boolean;
  /** 区块标题旁文案（兼容旧字段） */
  linkLabel: string;
  /** 展示标题 */
  title: string;
  phone: string;
  wechat: string;
  /** QQ 号 */
  qq: string;
  /** 微信公众号 */
  wechatMp: string;
  /** 小红书号 */
  xiaohongshu: string;
  /** 抖音号 */
  douyin: string;
  /** B 站账号 */
  bilibili: string;
  email: string;
  address: string;
  /** 营业/服务时间 */
  hours: string;
  /** 补充说明（多行） */
  note: string;
};

export type PortalConfig = {
  nav: PortalNavLink[];
  company: PortalAboutPage;
  person: PortalAboutPage;
  contact: PortalContact;
};

export const DEFAULT_PORTAL_CONTACT: PortalContact = {
  enabled: true,
  linkLabel: "联系我们",
  title: "联系我们",
  phone: "",
  wechat: "",
  qq: "",
  wechatMp: "",
  xiaohongshu: "",
  douyin: "",
  bilibili: "",
  email: "",
  address: "",
  hours: "",
  note: "欢迎通过微信、QQ 或者电话与我们联系，我们会尽快回复。",
};

export const DEFAULT_PORTAL: PortalConfig = {
  nav: [
    { key: "home", label: "首页", href: "/" },
    { key: "company", label: "公司介绍", href: "/about/company" },
    { key: "person", label: "个人介绍", href: "/about/person" },
    // 顶栏只留「网课资料」；课程/资料广场在页内 Tab 同级切换，不与首页/商城抢位
    { key: "courses", label: "网课资料", href: "/courses" },
    // 约搭：线下结伴 / 活动匹配广场（类似「一起玩」，非小程序复刻）
    { key: "meetup", label: "约搭", href: "/meetup" },
    { key: "shop", label: "商城", href: "/shop" },
    { key: "forum", label: "大学论坛", href: "/forum", comingSoon: true },
    { key: "games", label: "游戏中心", href: "/games", comingSoon: true },
  ],
  contact: structuredClone(DEFAULT_PORTAL_CONTACT),
  company: {
    title: "公司介绍",
    subtitle: "把内容、服务与数字化能力，做成可持续经营的产品。",
    body: [
      "我们是一家面向学习与成长场景的数字化内容公司，专注把专业经验变成可交付、可运营的产品与服务。",
      "当前已上线知识付费与商城能力：课程上架、在线学习、商城购物、支付收款与创作者后台。后续将逐步开放大学论坛与游戏中心等模块，形成一体多业态门户。",
      "若你希望合作、采购课程或了解企业服务，欢迎通过站内注册账号后与我们联系。",
    ].join("\n\n"),
    highlights: [
      { label: "核心业务", text: "知识付费与内容运营" },
      { label: "产品方向", text: "门户化多模块平台" },
      { label: "服务对象", text: "学员、创作者与合作机构" },
    ],
  },
  person: {
    title: "个人介绍",
    subtitle: "用产品思维做内容，用长期主义做连接。",
    body: [
      "你好，我是本站创始人。我长期关注教育、内容付费与互联网产品，希望把「能学、能买、能互动」放在同一个站点里。",
      "这个网站从知识付费起步，正在扩展为包含介绍、商城、论坛与游戏中心的多功能门户。欢迎关注后续更新，也欢迎交流合作想法。",
    ].join("\n\n"),
    highlights: [
      { label: "角色", text: "创始人 / 产品负责人" },
      { label: "关注", text: "知识付费 · 社区 · 数字产品" },
      { label: "态度", text: "先做可用，再做丰富" },
    ],
  },
};

function normalizeAbout(
  raw: Partial<PortalAboutPage> | undefined,
  fallback: PortalAboutPage,
): PortalAboutPage {
  const highlights = Array.isArray(raw?.highlights)
    ? raw!.highlights
        .map((h) => ({
          label: String(h?.label || "").trim().slice(0, 40),
          text: String(h?.text || "").trim().slice(0, 120),
        }))
        .filter((h) => h.label || h.text)
        .slice(0, 8)
    : fallback.highlights;
  return {
    title: (raw?.title || fallback.title).trim().slice(0, 80) || fallback.title,
    subtitle: (raw?.subtitle || fallback.subtitle).trim().slice(0, 200) || fallback.subtitle,
    body: (raw?.body || fallback.body).trim().slice(0, 20000) || fallback.body,
    highlights: highlights.length ? highlights : fallback.highlights,
  };
}

/** 规范化单条导航；缺字段时用默认项兜底 */
function normalizeNavItem(
  item: Partial<PortalNavLink> | undefined,
  fallback: PortalNavLink,
): PortalNavLink {
  const key = String(item?.key || fallback.key).trim().slice(0, 40) || fallback.key;
  return {
    key,
    label:
      String(item?.label || fallback.label).trim().slice(0, 40) || fallback.label,
    href:
      String(item?.href || fallback.href).trim().slice(0, 300) || fallback.href,
    enabled: item?.enabled !== false,
    // 商城已上线：旧 CMS 若仍标 comingSoon，运行时清掉，避免顶栏仍进占位页
    comingSoon: key === "shop" ? false : Boolean(item?.comingSoon),
  };
}

/**
 * 资料广场不得作为顶栏与「网课资料」同级的项。
 * 生产 CMS 若仍存有旧的 materials 导航，运行时剥离，无需立刻改库。
 */
function isMaterialsTopNavItem(item: PortalNavLink): boolean {
  return (
    item.key === "materials" ||
    item.href === "/materials" ||
    item.label === "资料广场"
  );
}

/**
 * 合并门户导航：优先保留 CMS 已保存的数组顺序（拖拽排序依赖此行为）。
 * 缺省默认项追加到末尾；旧库「知识付费」等自定义 label 会保留。
 * 旧的顶栏「资料广场」会被剥掉（入口改由页内 Tab 承担）。
 */
function mergePortalNav(
  saved: Array<Partial<PortalNavLink> | undefined> | undefined,
): PortalNavLink[] {
  if (!Array.isArray(saved) || saved.length === 0) {
    return structuredClone(DEFAULT_PORTAL.nav);
  }

  const normalizedSaved = saved
    .map((item, index) =>
      normalizeNavItem(item, DEFAULT_PORTAL.nav[index] || DEFAULT_PORTAL.nav[0]),
    )
    .filter((item) => item.label && item.href)
    .filter((item) => !isMaterialsTopNavItem(item));

  const seenKeys = new Set<string>();
  const merged: PortalNavLink[] = [];

  // 按保存顺序输出，同 key 只保留首次出现，避免脏数据打乱排版
  for (const item of normalizedSaved) {
    if (seenKeys.has(item.key)) continue;
    seenKeys.add(item.key);
    merged.push(item);
  }

  // 代码新增的默认导航项：库里还没有时补到末尾，不覆盖管理员排好的顺序
  for (const defaultItem of DEFAULT_PORTAL.nav) {
    if (seenKeys.has(defaultItem.key)) continue;
    if (isMaterialsTopNavItem(defaultItem)) continue;
    merged.push({ ...defaultItem });
    seenKeys.add(defaultItem.key);
  }

  return merged.slice(0, 20);
}

function normalizeContact(
  raw: Partial<PortalContact> | undefined,
): PortalContact {
  const base = DEFAULT_PORTAL_CONTACT;
  return {
    enabled: raw?.enabled !== false,
    linkLabel:
      String(raw?.linkLabel || base.linkLabel).trim().slice(0, 20) ||
      base.linkLabel,
    title:
      String(raw?.title || base.title).trim().slice(0, 40) || base.title,
    phone: String(raw?.phone || "").trim().slice(0, 40),
    wechat: String(raw?.wechat || "").trim().slice(0, 60),
    qq: String(raw?.qq || "").trim().slice(0, 40),
    wechatMp: String(raw?.wechatMp || "").trim().slice(0, 60),
    xiaohongshu: String(raw?.xiaohongshu || "").trim().slice(0, 60),
    douyin: String(raw?.douyin || "").trim().slice(0, 60),
    bilibili: String(raw?.bilibili || "").trim().slice(0, 60),
    email: String(raw?.email || "").trim().slice(0, 120),
    address: String(raw?.address || "").trim().slice(0, 200),
    hours: String(raw?.hours || "").trim().slice(0, 80),
    note: String(raw?.note ?? base.note).trim().slice(0, 2000),
  };
}

/** 是否已填写至少一项可展示的联系方式 */
export function hasContactDetails(contact: PortalContact) {
  return Boolean(
    contact.phone ||
      contact.wechat ||
      contact.qq ||
      contact.wechatMp ||
      contact.xiaohongshu ||
      contact.douyin ||
      contact.bilibili ||
      contact.email ||
      contact.address ||
      contact.hours ||
      contact.note,
  );
}

export function parsePortal(raw: string | null | undefined): PortalConfig {
  if (!raw?.trim()) return structuredClone(DEFAULT_PORTAL);
  try {
    const parsed = JSON.parse(raw) as Partial<PortalConfig>;
    const nav = mergePortalNav(parsed.nav);

    return {
      nav: nav.length ? nav : structuredClone(DEFAULT_PORTAL.nav),
      company: normalizeAbout(parsed.company, DEFAULT_PORTAL.company),
      person: normalizeAbout(parsed.person, DEFAULT_PORTAL.person),
      contact: normalizeContact(parsed.contact),
    };
  } catch {
    return structuredClone(DEFAULT_PORTAL);
  }
}

export function stringifyPortal(config: PortalConfig) {
  return JSON.stringify(config);
}

/** 正文按空行切成段落，供介绍页渲染 */
export function splitPortalBody(body: string) {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

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

export type PortalConfig = {
  nav: PortalNavLink[];
  company: PortalAboutPage;
  person: PortalAboutPage;
};

export const DEFAULT_PORTAL: PortalConfig = {
  nav: [
    { key: "home", label: "首页", href: "/" },
    { key: "company", label: "公司介绍", href: "/about/company" },
    { key: "person", label: "个人介绍", href: "/about/person" },
    { key: "courses", label: "知识付费", href: "/courses" },
    { key: "shop", label: "商城", href: "/shop", comingSoon: true },
    { key: "forum", label: "大学论坛", href: "/forum", comingSoon: true },
    { key: "games", label: "游戏中心", href: "/games", comingSoon: true },
  ],
  company: {
    title: "公司介绍",
    subtitle: "把内容、服务与数字化能力，做成可持续经营的产品。",
    body: [
      "我们是一家面向学习与成长场景的数字化内容公司，专注把专业经验变成可交付、可运营的产品与服务。",
      "当前已上线知识付费能力：课程上架、在线学习、支付收款与创作者后台。后续将逐步开放商城、大学论坛与游戏中心等模块，形成一体多业态门户。",
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

export function parsePortal(raw: string | null | undefined): PortalConfig {
  if (!raw?.trim()) return structuredClone(DEFAULT_PORTAL);
  try {
    const parsed = JSON.parse(raw) as Partial<PortalConfig>;
    const nav = Array.isArray(parsed.nav)
      ? parsed.nav
          .map((item, index) => {
            const fallback = DEFAULT_PORTAL.nav[index] || DEFAULT_PORTAL.nav[0];
            return {
              key: String(item?.key || fallback.key).trim().slice(0, 40) || fallback.key,
              label:
                String(item?.label || fallback.label).trim().slice(0, 40) ||
                fallback.label,
              href:
                String(item?.href || fallback.href).trim().slice(0, 300) ||
                fallback.href,
              enabled: item?.enabled !== false,
              comingSoon: Boolean(item?.comingSoon),
            };
          })
          .filter((item) => item.label && item.href)
          .slice(0, 20)
      : DEFAULT_PORTAL.nav;

    return {
      nav: nav.length ? nav : DEFAULT_PORTAL.nav,
      company: normalizeAbout(parsed.company, DEFAULT_PORTAL.company),
      person: normalizeAbout(parsed.person, DEFAULT_PORTAL.person),
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

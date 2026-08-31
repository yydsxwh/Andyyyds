/** 门户默认中文标签 → UI 词条 key（仅当站长没改过显示名称时，才用来替换前台主文案） */
const LABEL_TO_KEY: Record<string, string> = {
  首页: "nav.home",
  公司介绍: "nav.company",
  个人介绍: "nav.person",
  网课资料: "nav.courses",
  约搭: "nav.meetup",
  商城: "nav.shop",
  软件产品: "nav.products",
  大学论坛: "nav.forum",
  论坛: "nav.forum",
  游戏中心: "nav.games",
  个人中心: "nav.account",
  创作者中心: "nav.studio",
  代理中心: "nav.agent",
  站长管理: "nav.admin",
  登录: "nav.login",
  注册: "nav.register",
  消息: "nav.messages",
  退出: "nav.logout",
};

/** 按路径认默认入口；只用于英文悬浮，不覆盖 CMS 显示名称 */
const HREF_TO_KEY: Record<string, string> = {
  "/": "nav.home",
  "/about/company": "nav.company",
  "/about/person": "nav.person",
  "/courses": "nav.courses",
  "/materials": "nav.courses",
  "/meetup": "nav.meetup",
  "/shop": "nav.shop",
  "/products": "nav.products",
  "/forum": "nav.forum",
  "/games": "nav.games",
  "/account": "nav.account",
  "/studio": "nav.studio",
  "/studio/admin": "nav.admin",
  "/login": "nav.login",
  "/register": "nav.register",
  "/messages": "nav.messages",
};

const PORTAL_KEY_TO_MESSAGE: Record<string, string> = {
  home: "nav.home",
  company: "nav.company",
  person: "nav.person",
  courses: "nav.courses",
  meetup: "nav.meetup",
  shop: "nav.shop",
  products: "nav.products",
  forum: "nav.forum",
  games: "nav.games",
};

/**
 * 只认「仍是默认中文名」的导航项，用来决定访客主文案是否走语言包。
 */
export function navMessageKey(input: { label?: string }): string | null {
  const label = (input.label || "").trim();
  if (label && LABEL_TO_KEY[label]) return LABEL_TO_KEY[label];
  return null;
}

/**
 * 站长双语悬浮用的词条。改过显示名称（如「论坛」）仍按路径/key 出 Forum，不改主文案。
 */
export function navHoverMessageKey(input: {
  label?: string;
  href?: string;
  key?: string;
}): string | null {
  const byLabel = navMessageKey({ label: input.label });
  if (byLabel) return byLabel;
  const portalKey = String(input.key || "").trim();
  if (portalKey && PORTAL_KEY_TO_MESSAGE[portalKey]) {
    return PORTAL_KEY_TO_MESSAGE[portalKey];
  }
  const href = String(input.href || "").trim();
  if (href && HREF_TO_KEY[href]) return HREF_TO_KEY[href];
  return null;
}

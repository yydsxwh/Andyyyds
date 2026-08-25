/** 门户默认中文标签 → UI 词条 key（无正文译文时仍可本地化导航） */
const LABEL_TO_KEY: Record<string, string> = {
  首页: "nav.home",
  公司介绍: "nav.company",
  个人介绍: "nav.person",
  网课资料: "nav.courses",
  约搭: "nav.meetup",
  商城: "nav.shop",
  软件产品: "nav.products",
  大学论坛: "nav.forum",
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

export function navMessageKey(input: {
  label?: string;
  href?: string;
}): string | null {
  const label = (input.label || "").trim();
  if (label && LABEL_TO_KEY[label]) return LABEL_TO_KEY[label];
  const href = (input.href || "").trim();
  if (href && HREF_TO_KEY[href]) return HREF_TO_KEY[href];
  return null;
}

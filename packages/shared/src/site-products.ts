/**
 * 面向用户的产品包（与 packages/<名> / @andyyyds/<名> 一一对应）。
 * 顶栏/汉堡菜单兜底、客户端侧栏等应完整露出这些项。
 */

export type SiteProductPackage = {
  id: string;
  /** 前台展示名 */
  label: string;
  href: string;
  /** i18n 词条 key */
  navKey: string;
};

export const SITE_PRODUCT_PACKAGES: readonly SiteProductPackage[] = [
  {
    id: "company",
    label: "公司介绍",
    href: "/about/company",
    navKey: "nav.company",
  },
  {
    id: "person",
    label: "个人 IP",
    href: "/about/person",
    navKey: "nav.person",
  },
  {
    id: "courses",
    label: "网课资料",
    href: "/courses",
    navKey: "nav.courses",
  },
  {
    id: "meetup",
    label: "约搭",
    href: "/meetup",
    navKey: "nav.meetup",
  },
  {
    id: "forum",
    label: "论坛",
    href: "/forum",
    navKey: "nav.forum",
  },
  {
    id: "mathcode",
    label: "识图转 LaTeX",
    href: "/products/mathcode",
    navKey: "nav.mathcode",
  },
  {
    id: "docs",
    label: "网页文档",
    href: "/products/docs",
    navKey: "nav.docs",
  },
] as const;

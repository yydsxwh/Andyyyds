/**
 * 可售产品类型（Course.productType）
 * - COURSE 单课：独立可售「小食」，自有章节/课时
 * - COLUMN 专栏：套餐 SKU，打包多门单课（CourseBundleItem）；购后开通所含单课
 * - MATERIAL 资料包 → 资料广场（/materials）
 * - PRODUCT 商城商品 → 商城（/shop）；可含规格/多图/购物车
 * 单课+专栏在课程广场；资料在资料广场；商城商品在商城。
 */

export const PRODUCT_TYPES = ["COURSE", "COLUMN", "MATERIAL", "PRODUCT"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  COURSE: "单课",
  COLUMN: "专栏",
  MATERIAL: "资料",
  PRODUCT: "商城商品",
};

export function isProductType(value: string): value is ProductType {
  return (PRODUCT_TYPES as readonly string[]).includes(value);
}

export function productTypeLabel(value: string): string {
  return isProductType(value) ? PRODUCT_TYPE_LABEL[value] : value;
}

/** 课程广场展示：单课 + 专栏 */
export function isCoursePlazaType(value: string): boolean {
  return value === "COURSE" || value === "COLUMN";
}

/** 资料广场展示 */
export function isMaterialPlazaType(value: string): boolean {
  return value === "MATERIAL";
}

/** 商城展示 */
export function isShopPlazaType(value: string): boolean {
  return value === "PRODUCT";
}

/**
 * 详情页路径：资料走 /materials，商城走 /shop，其余走 /courses。
 * 路径段保持原始字符，交给 Next Link / router 编码一次；
 * 此处再 encodeURIComponent 会导致双重编码 → 前台 404。
 */
export function productDetailPath(slug: string, productType: string): string {
  if (productType === "MATERIAL") return `/materials/${slug}`;
  if (productType === "PRODUCT") return `/shop/${slug}`;
  return `/courses/${slug}`;
}

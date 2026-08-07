/**
 * 可售产品类型（Course.productType）
 * - COURSE 单课：独立可售「小食」，自有章节/课时
 * - COLUMN 专栏：套餐 SKU，打包多门单课（CourseBundleItem）；购后开通所含单课
 * - MATERIAL 资料包 → 资料广场（/materials）
 * - PRODUCT 商城商品 → 商城（/shop）；可含规格/多图/购物车
 * - MEETUP 约搭活动壳商品 → 约搭详情（/meetup/:id）；报名费走订单/分销/优惠券
 * 单课+专栏在课程广场；资料在资料广场；商城商品在商城；约搭在约搭广场。
 */

export const PRODUCT_TYPES = [
  "COURSE",
  "COLUMN",
  "MATERIAL",
  "PRODUCT",
  "MEETUP",
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  COURSE: "单课",
  COLUMN: "专栏",
  MATERIAL: "资料",
  PRODUCT: "商城商品",
  MEETUP: "约搭",
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

/** 约搭可售壳（不进课程/资料/商城广场） */
export function isMeetupProductType(value: string): boolean {
  return value === "MEETUP";
}

/**
 * 可走「课程/专栏/资料」工作室列表与章节编辑的类型。
 * 约搭壳(MEETUP)、商城(PRODUCT)有独立入口与表单，禁止混进课程管理以免出现「编辑章节」等误操作。
 */
export const COURSE_STUDIO_PRODUCT_TYPES = [
  "COURSE",
  "COLUMN",
  "MATERIAL",
] as const;
export type CourseStudioProductType =
  (typeof COURSE_STUDIO_PRODUCT_TYPES)[number];

export function isCourseStudioProductType(
  value: string,
): value is CourseStudioProductType {
  return (COURSE_STUDIO_PRODUCT_TYPES as readonly string[]).includes(value);
}

/** Prisma where：课程工作室「我的课程」默认只含单课/专栏/资料 */
export function courseStudioProductTypeWhere(
  filter?: CourseStudioProductType | "all",
):
  | { productType: CourseStudioProductType }
  | { productType: { in: CourseStudioProductType[] } } {
  if (filter && filter !== "all") {
    return { productType: filter };
  }
  return { productType: { in: [...COURSE_STUDIO_PRODUCT_TYPES] } };
}

/**
 * 约搭壳 slug = meetup.id。误开课程编辑时跳活动表单（时间/地点/分档），不是章节课时。
 * from=course-edit 用于页面提示「约搭不是课程」。
 */
export function meetupActivityEditPath(
  meetupIdOrProductSlug: string,
  opts?: { fromCourseEdit?: boolean },
): string {
  const base = `/meetup/${meetupIdOrProductSlug}/edit`;
  return opts?.fromCourseEdit ? `${base}?from=course-edit` : base;
}

/**
 * 详情页路径：资料走 /materials，商城走 /shop，约搭走 /meetup，其余走 /courses。
 * 约搭壳商品的 slug = meetup.id，便于支付成功后回跳详情。
 * 路径段保持原始字符，交给 Next Link / router 编码一次；
 * 此处再 encodeURIComponent 会导致双重编码 → 前台 404。
 */
export function productDetailPath(slug: string, productType: string): string {
  if (productType === "MATERIAL") return `/materials/${slug}`;
  if (productType === "PRODUCT") return `/shop/${slug}`;
  if (productType === "MEETUP") return `/meetup/${slug}`;
  return `/courses/${slug}`;
}

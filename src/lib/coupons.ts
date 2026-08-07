/**
 * 优惠券业务规则（金额单位：分）
 *
 * 类型：
 * - FIXED   定额减免：discountCents 为减免金额
 * - PERCENT 比例折扣：percentOff 为减免百分比 1–99
 *           中文「九折」= 减 10% → percentOff=10（不存 0.9，避免浮点）
 *
 * 商品适用范围：
 * - ALL      全站商品可用
 * - SELECTED 仅 CouponProduct 关联的商品可用（1 个=单品；多个=多选）
 */

export const COUPON_TYPES = ["FIXED", "PERCENT"] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

export const COUPON_TYPE_LABEL: Record<CouponType, string> = {
  FIXED: "定额减免",
  PERCENT: "比例折扣",
};

/** 券适用商品范围：全站 / 指定商品（含单品与多选） */
export const COUPON_PRODUCT_SCOPES = ["ALL", "SELECTED"] as const;
export type CouponProductScope = (typeof COUPON_PRODUCT_SCOPES)[number];

export const COUPON_PRODUCT_SCOPE_LABEL: Record<CouponProductScope, string> = {
  ALL: "全站商品",
  SELECTED: "指定商品",
};

export function isCouponType(value: string): value is CouponType {
  return (COUPON_TYPES as readonly string[]).includes(value);
}

export function isCouponProductScope(value: string): value is CouponProductScope {
  return (COUPON_PRODUCT_SCOPES as readonly string[]).includes(value);
}

/** 优惠券用于校验/计价的最小字段集 */
export type CouponDiscountInput = {
  type: string;
  discountCents: number;
  percentOff: number;
  minAmount: number;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
  /** 缺省按 ALL，兼容旧数据 */
  productScope?: string | null;
  /** SELECTED 时适用的商品 id；ALL 时可省略 */
  productIds?: string[] | null;
};

/**
 * 按券类型计算减免额（分），且不超过订单原价。
 * PERCENT 用整数除法向下取整，避免多减。
 */
export function calcCouponDiscount(
  priceCents: number,
  coupon: Pick<CouponDiscountInput, "type" | "discountCents" | "percentOff">,
): number {
  if (priceCents <= 0) return 0;

  let discount = 0;
  if (coupon.type === "PERCENT") {
    const pct = Math.min(99, Math.max(0, Math.floor(coupon.percentOff)));
    discount = Math.floor((priceCents * pct) / 100);
  } else {
    // 默认 / 历史数据均按定额减免
    discount = Math.max(0, Math.floor(coupon.discountCents));
  }

  return Math.min(discount, priceCents);
}

/**
 * 是否适用于指定商品。
 * ALL → 全站；SELECTED → 须在关联列表中；SELECTED 但未配置商品 → 不可用。
 */
export function couponAppliesToProduct(
  coupon: Pick<CouponDiscountInput, "productScope" | "productIds">,
  courseId: string,
): boolean {
  const scope = coupon.productScope || "ALL";
  if (scope === "ALL") return true;
  if (scope !== "SELECTED") return false;
  const ids = coupon.productIds || [];
  return ids.includes(courseId);
}

/**
 * 校验券是否可用于当前订单（不含「该用户是否已兑过」——由调用方查 CouponRedemption）。
 * 传入 courseId 时会校验商品适用范围。
 * 返回中文错误文案；通过则返回 null。
 */
export function validateCouponForOrder(
  coupon: CouponDiscountInput | null | undefined,
  priceCents: number,
  now: Date = new Date(),
  courseId?: string,
): string | null {
  if (!coupon) return "优惠券不存在";
  if (!coupon.isActive) return "优惠券已停用";
  if (coupon.startsAt && coupon.startsAt > now) return "优惠券尚未开始";
  if (coupon.expiresAt && coupon.expiresAt < now) return "优惠券已过期";
  if (coupon.usedCount >= coupon.maxUses) return "优惠券已领完";
  if (priceCents < coupon.minAmount) {
    return coupon.minAmount > 0
      ? `未满最低消费 ¥${(coupon.minAmount / 100).toFixed(coupon.minAmount % 100 === 0 ? 0 : 2)}`
      : "优惠券不可用";
  }

  if (courseId && !couponAppliesToProduct(coupon, courseId)) {
    return "该优惠券不适用于当前商品";
  }

  if (coupon.type === "PERCENT") {
    if (coupon.percentOff < 1 || coupon.percentOff > 99) {
      return "优惠券配置无效";
    }
  } else if (coupon.discountCents <= 0) {
    return "优惠券配置无效";
  }

  return null;
}

/** 后台创建/编辑时校验面额与类型 */
export function validateCouponValueInput(input: {
  type: CouponType;
  discountCents: number;
  percentOff: number;
}): string | null {
  if (input.type === "PERCENT") {
    if (!Number.isInteger(input.percentOff) || input.percentOff < 1 || input.percentOff > 99) {
      return "比例折扣请填写 1–99（如 10 表示减 10%，相当于九折）";
    }
    return null;
  }
  if (!Number.isInteger(input.discountCents) || input.discountCents < 1) {
    return "定额减免金额须至少 1 分";
  }
  return null;
}

/** 创建时校验商品范围：SELECTED 至少选 1 个商品 */
export function validateCouponProductScopeInput(input: {
  productScope: CouponProductScope;
  productIds: string[];
}): string | null {
  if (input.productScope === "ALL") return null;
  if (!input.productIds.length) {
    return "指定商品时请至少选择一个商品";
  }
  return null;
}

/** 列表/购买页展示文案，如「减 ¥20」或「减 10%（九折）」 */
export function formatCouponBenefit(coupon: {
  type: string;
  discountCents: number;
  percentOff: number;
}): string {
  if (coupon.type === "PERCENT") {
    const off = coupon.percentOff;
    const zhe = ((100 - off) / 10).toFixed(off % 10 === 0 ? 0 : 1);
    return `减 ${off}%（${zhe}折）`;
  }
  const yuan = coupon.discountCents / 100;
  return `减 ¥${yuan.toFixed(coupon.discountCents % 100 === 0 ? 0 : 2)}`;
}

/** 后台列表展示适用范围摘要 */
export function formatCouponProductScope(coupon: {
  productScope?: string | null;
  productIds?: string[] | null;
  productTitles?: string[] | null;
}): string {
  const scope = coupon.productScope || "ALL";
  if (scope === "ALL") return "全站商品";
  const titles = coupon.productTitles?.filter(Boolean) || [];
  const ids = coupon.productIds || [];
  if (titles.length === 1) return `单品：${titles[0]}`;
  if (titles.length > 1) return `${titles.length} 个指定商品`;
  if (ids.length === 1) return "指定 1 个商品";
  if (ids.length > 1) return `指定 ${ids.length} 个商品`;
  return "指定商品（未配置）";
}

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().slice(0, 32);
}

/**
 * 一键生成可读券码：前缀 + 随机字母数字（排除易混淆字符）。
 * 仅生成候选，是否唯一由调用方查库确认。
 */
export function generateCouponCode(prefix = "YYDS"): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  const raw = `${prefix}${suffix}`;
  return normalizeCouponCode(raw);
}

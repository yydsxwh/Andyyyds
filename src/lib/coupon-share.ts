/**
 * 优惠券分享链接与第三方分享入口。
 * 分享链带 ?coupon=券码；打开后前台预填，下单仍以服务端校验为准。
 */

import { siteBaseUrl } from "@/lib/invite";
import { productDetailPath } from "@/lib/product-types";
import { normalizeCouponCode } from "@/lib/coupons";

export const COUPON_QUERY_KEY = "coupon";
export const COUPON_STORAGE_KEY = "yyds_coupon";

/** 通用领券落地页（全站券 / 多商品券） */
export function couponClaimUrl(code: string, base?: string) {
  const root = (base || siteBaseUrl()).replace(/\/$/, "");
  const normalized = normalizeCouponCode(code);
  return `${root}/coupon?${COUPON_QUERY_KEY}=${encodeURIComponent(normalized)}`;
}

/** 指定商品详情页分享链（打开即预填券码） */
export function couponProductUrl(
  slug: string,
  code: string,
  productType = "COURSE",
  base?: string,
) {
  const root = (base || siteBaseUrl()).replace(/\/$/, "");
  const path = productDetailPath(slug, productType)
    .split("/")
    .map((seg, i) => (i <= 1 || !seg ? seg : encodeURIComponent(seg)))
    .join("/");
  const normalized = normalizeCouponCode(code);
  return `${root}${path}?${COUPON_QUERY_KEY}=${encodeURIComponent(normalized)}`;
}

/**
 * 选最优分享链：
 * - 指定且仅 1 个商品 → 直达该商品详情
 * - 全站或多商品 → 领券落地页（可再选商品）
 */
export function resolveCouponShareUrl(input: {
  code: string;
  productScope?: string | null;
  products?: Array<{
    slug: string;
    productType: string;
  }>;
  base?: string;
}): string {
  const scope = input.productScope || "ALL";
  const products = input.products || [];
  if (scope === "SELECTED" && products.length === 1) {
    return couponProductUrl(
      products[0].slug,
      input.code,
      products[0].productType,
      input.base,
    );
  }
  return couponClaimUrl(input.code, input.base);
}

/** QQ 网页分享（PC / 手机浏览器均可打开选好友） */
export function qqShareUrl(opts: {
  url: string;
  title: string;
  summary?: string;
}) {
  const u = new URL("https://connect.qq.com/widget/shareqq/index.html");
  u.searchParams.set("url", opts.url);
  u.searchParams.set("title", opts.title);
  u.searchParams.set("summary", opts.summary || opts.title);
  u.searchParams.set("desc", opts.summary || opts.title);
  return u.toString();
}

export function couponShareTitle(couponTitle: string, code: string) {
  return `优惠券「${couponTitle}」券码 ${code}`;
}

export function couponShareSummary(benefit: string) {
  return `送你一张优惠券：${benefit}。打开链接即可使用。`;
}

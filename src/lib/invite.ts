/**
 * 邀请链接拼装：注册页、课程/资料页、全站首页均可带 ?ref=邀请码
 * 便于分销归因；注册与下单侧统一按码解析邀请人。
 */

import { productDetailPath } from "@/lib/product-types";

export function siteBaseUrl(fallback = "https://www.yydsxwh.com") {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    fallback
  ).replace(/\/$/, "");
}

/** 全站邀请注册链接 */
export function inviteRegisterUrl(code: string, base?: string) {
  const root = (base || siteBaseUrl()).replace(/\/$/, "");
  return `${root}/register?ref=${encodeURIComponent(code)}`;
}

/** 课程/资料分享链接（带邀请码；资料走 /materials） */
export function inviteProductUrl(
  slug: string,
  code: string,
  productType = "COURSE",
  base?: string,
) {
  const root = (base || siteBaseUrl()).replace(/\/$/, "");
  // 外链需自行编码路径段；站内 Link 用 productDetailPath（不二次编码）
  const path = productDetailPath(slug, productType)
    .split("/")
    .map((seg, i) => (i <= 1 || !seg ? seg : encodeURIComponent(seg)))
    .join("/");
  return `${root}${path}?ref=${encodeURIComponent(code)}`;
}

/** @deprecated 请优先用 inviteProductUrl；保留以兼容旧调用 */
export function inviteCourseUrl(slug: string, code: string, base?: string) {
  return inviteProductUrl(slug, code, "COURSE", base);
}

/** 全站首页宣传链接 */
export function inviteHomeUrl(code: string, base?: string) {
  const root = (base || siteBaseUrl()).replace(/\/$/, "");
  return `${root}/?ref=${encodeURIComponent(code)}`;
}

export const REFERRAL_STORAGE_KEY = "yyds_ref";

"use client";

/**
 * 捕获 URL 上的 ?coupon=券码，写入 localStorage，供购买页预填。
 * 与邀请码 ReferralCapture 并列挂在全局 layout。
 */

import { useEffect } from "react";
import {
  COUPON_QUERY_KEY,
  COUPON_STORAGE_KEY,
} from "@/lib/coupon-share";
import { normalizeCouponCode } from "@/lib/coupons";

export function CouponCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get(COUPON_QUERY_KEY) || params.get("couponCode") || "";
      const code = normalizeCouponCode(raw);
      if (code) {
        window.localStorage.setItem(COUPON_STORAGE_KEY, code);
      }
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}

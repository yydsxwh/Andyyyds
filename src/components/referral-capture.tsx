"use client";

/**
 * 捕获 URL 上的 ?ref=邀请码，写入 localStorage，供注册 / 下单归因。
 * 挂在全局 layout，课程分享链与首页宣传链均可生效。
 */

import { useEffect } from "react";
import { REFERRAL_STORAGE_KEY } from "@/lib/invite";
import { normalizeReferralCode } from "@/lib/referral-code";

export function ReferralCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("ref") || params.get("referralCode") || "";
      const code = normalizeReferralCode(raw);
      if (code) {
        window.localStorage.setItem(REFERRAL_STORAGE_KEY, code);
      }
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}

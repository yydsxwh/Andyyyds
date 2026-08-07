/**
 * 邀请码格式校验与规范化。
 * 站长可手工指定；注册时仍用 makeReferralCode() 自动生成。
 */

/** 字母数字，长度 4–16；存库统一大写，避免大小写重复 */
const REFERRAL_RE = /^[A-Za-z0-9]{4,16}$/;

export function normalizeReferralCode(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase();
}

export function isValidReferralCode(code: string): boolean {
  return REFERRAL_RE.test(code);
}

export function referralCodeError(raw: string): string | null {
  const code = normalizeReferralCode(raw);
  if (!code) return "请填写邀请码";
  if (!isValidReferralCode(code)) {
    return "邀请码须为 4～16 位字母或数字";
  }
  return null;
}

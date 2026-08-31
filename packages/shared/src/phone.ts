/**
 * 手机号规范化与校验（中国大陆 11 位）。
 * 登录 / 发短信前统一成纯数字，避免空格、+86 导致对不上库。
 */

const CN_MOBILE = /^1[3-9]\d{9}$/;

/** 去掉空格、横线、+86 / 0086 前缀，得到 11 位数字或空串 */
export function normalizePhone(raw: string | null | undefined): string {
  let value = String(raw || "").trim().replace(/[\s\-()]/g, "");
  if (value.startsWith("+86")) value = value.slice(3);
  else if (value.startsWith("0086")) value = value.slice(4);
  if (value.startsWith("86") && value.length === 13) value = value.slice(2);
  return value;
}

export function isValidCnMobile(phone: string): boolean {
  return CN_MOBILE.test(phone);
}

/** 展示用脱敏：138****8000 */
export function maskPhone(phone: string): string {
  if (!isValidCnMobile(phone)) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}

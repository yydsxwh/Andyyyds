/**
 * 金额换算：前台用「元」（最多两位小数），库内用「分」整数。
 * 用字符串解析避免 19.9 * 100 浮点误差。
 */

/** 校验元金额字符串：非负、最多两位小数 */
export function isValidYuanInput(value: string | number): boolean {
  const s = String(value ?? "").trim();
  if (!s) return false;
  return /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(s);
}

/**
 * 元 → 分。非法输入抛错。
 * 例："99.9" → 9990；"99.90" → 9990；0 → 0
 */
export function yuanToCents(value: string | number): number {
  const s = String(value ?? "").trim();
  if (!isValidYuanInput(s)) {
    throw new Error("价格须为非负数字，最多两位小数（精确到分）");
  }
  const neg = s.startsWith("-");
  if (neg) throw new Error("价格不能为负");
  const [intPart, fracRaw = ""] = s.split(".");
  const frac = (fracRaw + "00").slice(0, 2);
  const cents = Number(intPart) * 100 + Number(frac);
  if (!Number.isFinite(cents) || cents < 0) {
    throw new Error("价格无效");
  }
  return cents;
}

/** 分 → 用于表单回填的元字符串（去掉多余尾零时仍保留两位可选） */
export function centsToYuanString(cents: number): string {
  const n = Math.max(0, Math.floor(cents || 0));
  const yuan = n / 100;
  return n % 100 === 0 ? String(yuan) : yuan.toFixed(2);
}

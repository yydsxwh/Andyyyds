/**
 * 本轮微调提示词：前后端共用清洗规则。
 * 单独成文件，避免客户端再去引 mathcode.ts（里面有站点设置 / 密钥解析）。
 */

/** 过长会挤掉正文识别额度 */
export const MATHCODE_USER_HINT_MAX_CHARS = 2000;

/**
 * 只清洗控制符和长度。提示词是附加指令，不能替换保真规则，
 * 否则用户写一句「帮我补全没拍到的步骤」就会诱导模型编造。
 */
export function sanitizeMathcodeUserHint(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, MATHCODE_USER_HINT_MAX_CHARS);
}

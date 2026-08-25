/**
 * 账号密码登录的「登录名」规则。
 * 与邮箱分开：账号通道只认 username，邮箱通道只认真实邮箱。
 */

const USERNAME_RE = /^[a-z][a-z0-9_]{3,19}$/;

/** 易被误认为系统账号的保留名 */
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "root",
  "system",
  "support",
  "official",
  "yyds",
  "null",
  "undefined",
]);

/** 规范化：去空白、转小写 */
export function normalizeUsername(raw: string): string {
  return (raw || "").trim().toLowerCase();
}

/**
 * 校验登录名。合法：4–20 位，小写字母开头，仅字母/数字/下划线。
 */
export function validateUsername(raw: string): {
  ok: true;
  username: string;
} | {
  ok: false;
  error: string;
} {
  const username = normalizeUsername(raw);
  if (!username) {
    return { ok: false, error: "请填写登录账号" };
  }
  if (username.includes("@")) {
    return { ok: false, error: "账号登录请使用登录名，邮箱请改用「邮箱」方式" };
  }
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error: "登录账号须为 4–20 位：小写字母开头，仅含字母、数字、下划线",
    };
  }
  if (RESERVED_USERNAMES.has(username)) {
    return { ok: false, error: "该登录账号不可用，请换一个" };
  }
  return { ok: true, username };
}

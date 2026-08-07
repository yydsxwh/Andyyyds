/**
 * 登录邮箱相关的纯函数（可在客户端与服务端共用）。
 * 微信/手机自动注册使用占位邮箱，不能用于真实邮箱登录。
 */

export function wechatPlaceholderEmail(openid: string) {
  const safe = openid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 28) || "user";
  return `wx_${safe}@wechat.local`;
}

export function phonePlaceholderEmail(phone: string) {
  return `phone_${phone}@phone.local`;
}

/**
 * 占位邮箱：绑定真实邮箱后，邮箱 / 手机 / 微信三种登录指向同一账号。
 */
export function isPlaceholderEmail(email: string) {
  const e = (email || "").trim().toLowerCase();
  return e.endsWith("@wechat.local") || e.endsWith("@phone.local");
}

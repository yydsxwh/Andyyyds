/**
 * 主站登录回跳校验。
 *
 * 只接受站内相对路径。禁止 //evil、带协议的伪路径、登录循环地址。
 * 原页回跳存在主站自己的 OIDC 事务 Cookie 里，不把绝对 URL 交给外部。
 */

const MAX_NEXT_LENGTH = 500;

export function safeNextPath(
  raw: string | null | undefined,
  fallback = "/",
): string {
  const value = (raw || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("://")) return fallback;
  const pathOnly = value.split("?")[0] || "";
  if (isAuthLoopPath(pathOnly)) return fallback;
  return value.slice(0, MAX_NEXT_LENGTH) || fallback;
}

export function isAuthLoopPath(pathname: string): boolean {
  const path = (pathname || "").split("?")[0] || "";
  if (path === "/login" || path === "/register") return true;
  return path === "/api/auth" || path.startsWith("/api/auth/");
}

/** 顶栏登录/注册：把当前页做成 next，避免固定跳个人中心 */
export function nextFromCurrentLocation(
  pathname: string | null | undefined,
  search = "",
): string {
  const path = (pathname || "/").trim() || "/";
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  const query = search && !search.startsWith("?") ? `?${search}` : search;
  return safeNextPath(`${path}${query || ""}`);
}

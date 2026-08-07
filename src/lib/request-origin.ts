/**
 * 从请求还原浏览器可见的站点 Origin。
 *
 * 反代到 Node 后，Route Handler 的 `req.url` 经常是
 * `https://localhost:3000/...`（监听地址），不能拿来拼 303 Location，
 * 否则退出登录会把用户甩到本机并 ERR_CONNECTION_REFUSED。
 * 优先读 Host / X-Forwarded-*，与浏览器当前访问域名保持一致。
 */

function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]"
  );
}

/**
 * @returns 形如 `https://www.example.com`；无法从请求头可靠判断时返回 null
 */
export function getRequestPublicOrigin(req: Request): string | null {
  const forwardedHost = req.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const hostHeader = (forwardedHost || req.headers.get("host") || "").trim();
  if (!hostHeader) return null;

  const hostname = hostHeader.split(":")[0] || "";
  const forwardedProto = req.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();

  // 生产反代若误把内网 Host 配成 localhost，且已带 https 转发头，则放弃本机地址，交给公网配置回退
  if (isLoopbackHostname(hostname) && forwardedProto === "https") {
    return null;
  }

  const proto =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : isLoopbackHostname(hostname)
        ? "http"
        : "https";

  return `${proto}://${hostHeader}`;
}

import Link from "next/link";
import { SiteHeaderNav, type HeaderNavLink } from "@/components/site-header-nav";
import { getSession } from "@/lib/auth";
import { DEFAULT_LOGO_URL } from "@/lib/decorate";
import { getDecorateConfig, getPortalConfig } from "@/lib/site-settings";

/**
 * 全站顶栏：门户导航（公司/个人/知识付费/商城等）+ 登录态相关入口
 */
export async function SiteHeader() {
  const [session, decorate, portal] = await Promise.all([
    getSession(),
    getDecorateConfig(),
    getPortalConfig(),
  ]);
  const logoUrl = decorate.logoUrl || DEFAULT_LOGO_URL;

  // 门户主导航（来自内容管理 / 默认配置）
  const links: HeaderNavLink[] = portal.nav
    .filter((item) => item.enabled !== false)
    .map((item) => ({ href: item.href, label: item.label }));

  // 登录后追加个人学习与后台入口（不占用门户配置）
  if (session) {
    links.push({ href: "/learn", label: "我的学习" });
    if (session.role === "TEACHER" || session.role === "ADMIN") {
      links.push({ href: "/studio", label: "创作者中心" });
    }
    if (session.role === "ADMIN") {
      links.push({ href: "/studio/cms", label: "内容管理" });
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(247,243,235,0.78)] backdrop-blur-md">
      <div className="container relative flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={decorate.brandName || "歪歪艾斯"}
            className="h-9 w-auto max-w-[140px] object-contain sm:h-10 sm:max-w-[200px]"
          />
          {decorate.showBrandText ? (
            <span className="brand-mark hidden text-lg text-[var(--ink)] sm:inline">
              {decorate.brandName}
            </span>
          ) : null}
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <SiteHeaderNav links={links} />
          {session ? (
            <>
              <span className="hidden max-w-[8rem] truncate text-sm text-[var(--muted)] sm:inline">
                {session.name}
              </span>
              <form action="/api/auth/logout" method="post">
                <button
                  className="btn btn-secondary px-3 py-2 text-sm sm:px-4"
                  type="submit"
                >
                  退出
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="btn btn-secondary px-3 py-2 text-sm sm:px-4"
              >
                登录
              </Link>
              <Link
                href="/register"
                className="btn btn-primary px-3 py-2 text-sm sm:px-4"
              >
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

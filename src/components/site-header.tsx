import Link from "next/link";
import { getSession } from "@/lib/auth";
import { DEFAULT_LOGO_URL } from "@/lib/decorate";
import { getDecorateConfig } from "@/lib/site-settings";

export async function SiteHeader() {
  const [session, decorate] = await Promise.all([
    getSession(),
    getDecorateConfig(),
  ]);
  const logoUrl = decorate.logoUrl || DEFAULT_LOGO_URL;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(247,243,235,0.78)] backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={decorate.brandName || "歪歪艾斯"}
            className="h-10 w-auto max-w-[200px] object-contain"
          />
          {decorate.showBrandText ? (
            <span className="brand-mark text-lg text-[var(--ink)]">
              {decorate.brandName}
            </span>
          ) : null}
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-[var(--muted)] md:flex">
          <Link href="/courses" className="hover:text-[var(--ink)]">
            课程广场
          </Link>
          <Link href="/learn" className="hover:text-[var(--ink)]">
            我的学习
          </Link>
          {session && (session.role === "TEACHER" || session.role === "ADMIN") ? (
            <>
              <Link href="/studio" className="hover:text-[var(--ink)]">
                创作者中心
              </Link>
              <Link href="/studio/media" className="hover:text-[var(--ink)]">
                素材中心
              </Link>
              {session.role === "ADMIN" ? (
                <>
                  <Link href="/studio/decorate" className="hover:text-[var(--ink)]">
                    店铺装修
                  </Link>
                  <Link href="/studio/cms" className="hover:text-[var(--ink)]">
                    内容管理
                  </Link>
                  <Link href="/studio/settings" className="hover:text-[var(--ink)]">
                    系统设置
                  </Link>
                </>
              ) : null}
            </>
          ) : null}
        </nav>
        <div className="flex items-center gap-2">
          {session ? (
            <>
              <span className="hidden text-sm text-[var(--muted)] sm:inline">
                {session.name}
              </span>
              <form action="/api/auth/logout" method="post">
                <button className="btn btn-secondary px-4 py-2 text-sm" type="submit">
                  退出
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-secondary px-4 py-2 text-sm">
                登录
              </Link>
              <Link href="/register" className="btn btn-primary px-4 py-2 text-sm">
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

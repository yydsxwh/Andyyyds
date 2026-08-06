import Link from "next/link";
import { SiteHeaderNav, type HeaderNavLink } from "@/components/site-header-nav";
import { UserAvatar } from "@/components/user-avatar";
import { getSession } from "@/lib/auth";
import { DEFAULT_LOGO_URL } from "@/lib/decorate";
import { canAccessStudio, isAdmin } from "@/lib/roles";
import {
  getDecorateConfig,
  getPortalConfig,
  getStudioNavConfig,
} from "@/lib/site-settings";
import { resolveStoredAccessUrl } from "@/lib/storage";

/**
 * 全站顶栏：门户导航（公司/个人/网课资料/商城等）+ 登录态相关入口
 * 课程广场与资料广场不占顶栏位，在 /courses|/materials 页内 Tab 切换。
 * 桌面端导航水平居中；字号由 --fs-nav / --fs-brand 控制（站长可在装扮里调）。
 */
export async function SiteHeader() {
  const [session, decorate, portal, studioNav] = await Promise.all([
    getSession(),
    getDecorateConfig(),
    getPortalConfig(),
    getStudioNavConfig(),
  ]);
  const logoUrl = decorate.logoUrl || DEFAULT_LOGO_URL;
  // 顶栏头像：私有 OSS 需签名；无头像时用昵称首字占位
  const avatarDisplayUrl = session?.avatarUrl
    ? await resolveStoredAccessUrl(session.avatarUrl)
    : "";

  // 门户主导航（来自内容管理 / 默认配置）
  const links: HeaderNavLink[] = portal.nav
    .filter((item) => item.enabled !== false)
    .map((item) => ({ href: item.href, label: item.label }));

  // 登录后追加后台入口；个人中心改由右上角头像进入（菜单仍保留「个人中心」便于手机端）
  if (session) {
    links.push({ href: "/account", label: "个人中心" });
    if (canAccessStudio(session.role)) {
      links.push({
        href: "/studio",
        label: session.role === "AGENT" ? "代理中心" : "创作者中心",
      });
    }
    if (isAdmin(session.role)) {
      // 顶栏「站长管理」落到站长概览；子菜单用 CMS 可改的 topAdmin 文案（去掉概览自身）
      const adminChildren = studioNav.topAdmin
        .filter((item) => item.key !== "admin")
        .map((item) => ({ href: item.href, label: item.label }));
      links.push({
        href: "/studio/admin",
        label: "站长管理",
        children: adminChildren,
      });
    }
  }

  return (
    <header className="sticky top-0 z-40 overflow-visible border-b border-[var(--line)] bg-[rgba(255,255,255,0.82)] backdrop-blur-md">
      {/*
        三区布局：左品牌、中导航（绝对居中）、右账号。
        不用固定 h-14 裁切大字号；min-height + 纵向居中适配站长调大的 --fs-nav。
      */}
      <div className="relative flex min-h-14 w-full items-center gap-2 px-2.5 py-2 sm:min-h-16 sm:gap-3 sm:px-3 lg:px-4">
        <Link
          href="/"
          className="relative z-10 flex shrink-0 items-center gap-1.5 self-center sm:gap-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={decorate.brandName || "歪歪艾斯"}
            className="h-8 w-auto max-w-[112px] shrink-0 object-contain object-left sm:h-9 sm:max-w-[160px]"
          />
          {decorate.showBrandText ? (
            <span
              className="brand-mark whitespace-nowrap leading-none text-[var(--ink)]"
              style={{ fontSize: "var(--fs-brand)" }}
            >
              {decorate.brandName}
            </span>
          ) : null}
        </Link>

        {/* 桌面导航绝对居中整条顶栏；汉堡菜单仍落在右侧账号区 */}
        <div className="relative z-10 ml-auto flex min-w-0 items-center gap-2 sm:gap-3 lg:gap-4">
          <SiteHeaderNav links={links} />
          {session ? (
            <>
              {/* 右上角头像+昵称 → 个人中心；触控区域足够大，手机可点 */}
              <Link
                href="/account"
                className="flex min-h-10 max-w-[11rem] items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-black/5 sm:max-w-[14rem]"
                title="个人中心"
              >
                <UserAvatar
                  name={session.name}
                  src={avatarDisplayUrl || null}
                  size="sm"
                />
                <span
                  className="hidden min-w-0 truncate text-[var(--ink)] sm:inline"
                  style={{ fontSize: "var(--fs-nav)" }}
                >
                  {session.name}
                </span>
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  className="btn btn-secondary min-h-10 px-3 py-2 sm:px-4"
                  type="submit"
                  style={{ fontSize: "var(--fs-nav)" }}
                >
                  退出
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="btn btn-secondary min-h-10 px-3 py-2 sm:px-4"
                style={{ fontSize: "var(--fs-nav)" }}
              >
                登录
              </Link>
              <Link
                href="/register"
                className="btn btn-fire min-h-10 px-3 py-2 sm:px-4"
                style={{ fontSize: "var(--fs-nav)" }}
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

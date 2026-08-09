import Link from "next/link";
import { ChatUnreadBadge } from "@/components/chat/chat-unread-badge";
import { SiteHeaderNav, type HeaderNavLink } from "@/components/site-header-nav";
import { SiteHomeClock } from "@/components/site-home-clock";
import { UserAvatar } from "@/components/user-avatar";
import { getSession } from "@/lib/auth";
import { DEFAULT_LOGO_URL } from "@/lib/decorate";
import { typoRoleClass, typoRoleStyle } from "@/lib/site-typography";
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
 * 桌面端三栏网格居中导航，避免绝对定位换行后盖住下方按钮（曾导致误点进 404）。
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

  // 门户主导航；若 CMS 全部关闭则回退默认入口，避免手机汉堡只剩「导航菜单」空壳
  const enabledPortalNav = portal.nav.filter((item) => item.enabled !== false);
  const portalNavSource =
    enabledPortalNav.length > 0
      ? enabledPortalNav
      : [
          { href: "/", label: "首页" },
          { href: "/about/company", label: "公司介绍" },
          { href: "/about/person", label: "个人介绍" },
          { href: "/courses", label: "网课资料" },
          { href: "/meetup", label: "约搭" },
          { href: "/shop", label: "商城" },
          { href: "/forum", label: "大学论坛" },
          { href: "/games", label: "游戏中心" },
        ];
  const links: HeaderNavLink[] = portalNavSource.map((item) => ({
    href: item.href,
    label: item.label,
  }));

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
    <header className="glass-bar tilt-glass-bar sticky top-0 z-40 border-b">
      {/*
        左品牌 | 中导航 | 右账号：导航占中间列水平居中，不绝对定位到整页，
        换行也只在顶栏内增高，不会盖住「下一步」等页面按钮。
        窄屏：品牌文案可截断；登录/注册用紧凑 padding，避免挤掉汉堡或横向溢出。
      */}
      <div className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 px-2 py-2 sm:min-h-16 sm:gap-3 sm:px-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:px-4">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-1.5 self-center sm:gap-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={decorate.brandName || "歪歪艾斯"}
            className="h-8 w-auto max-w-[72px] shrink-0 object-contain object-left sm:h-9 sm:max-w-[160px]"
          />
          {decorate.showBrandText ? (
            <span
              className={`brand-mark min-w-0 truncate leading-none text-[var(--ink)] ${typoRoleClass("brand")}`}
              style={typoRoleStyle("brand")}
            >
              {decorate.brandName}
            </span>
          ) : null}
        </Link>

        {/* 桌面导航：中间列居中；窄屏隐藏，改用右侧汉堡 */}
        <div className="hidden min-w-0 justify-center lg:flex">
          <SiteHeaderNav links={links} variant="desktop" />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-3 lg:gap-4">
          {/* 仅首页：动态时钟 + 时区 + 惜时警示 */}
          <SiteHomeClock />
          <SiteHeaderNav links={links} variant="mobile" />
          {session ? (
            <>
              <ChatUnreadBadge />
              {/* 右上角头像+昵称 → 个人中心；触控区域足够大，手机可点 */}
              <Link
                href="/account"
                className="flex min-h-[var(--control-h)] max-w-[9rem] items-center gap-1.5 rounded-full py-1 pl-1 pr-1.5 transition active:bg-black/5 sm:max-w-[14rem] sm:gap-2 sm:pr-2"
                title="个人中心"
              >
                <UserAvatar
                  name={session.name}
                  src={avatarDisplayUrl || null}
                  size="sm"
                />
                <span
                  className={`hidden min-w-0 truncate text-[var(--ink)] sm:inline ${typoRoleClass("nav")}`}
                  style={typoRoleStyle("nav")}
                >
                  {session.name}
                </span>
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  className={`btn btn-secondary btn-compact sm:px-4 ${typoRoleClass("nav")}`}
                  type="submit"
                  style={typoRoleStyle("nav")}
                >
                  退出
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={`btn btn-secondary btn-compact sm:px-4 ${typoRoleClass("nav")}`}
                style={typoRoleStyle("nav")}
              >
                登录
              </Link>
              <Link
                href="/register"
                className={`btn btn-fire btn-compact sm:px-4 ${typoRoleClass("nav")}`}
                style={typoRoleStyle("nav")}
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

import Link from "next/link";
import { ChatUnreadBadge } from "@/components/chat/chat-unread-badge";
import { SiteHeaderNav, type HeaderNavLink } from "@/components/site-header-nav";
import { SiteHomeClock } from "@/components/site-home-clock";
import { UserAvatar } from "@/components/user-avatar";
import { getSession } from "@/lib/auth";
import { DEFAULT_LOGO_URL } from "@/lib/decorate";
import { BilingualHover } from "@/components/i18n/bilingual-hover";
import { resolveContentText } from "@/lib/i18n/content-resolve";
import { getRequestLocaleContext } from "@/lib/i18n/get-request-locale";
import { translateMessage } from "@/lib/i18n/messages";
import { navMessageKey } from "@/lib/i18n/nav-labels";
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
  const [session, decorate, portal, studioNav, localeCtx] = await Promise.all([
    getSession(),
    getDecorateConfig(),
    getPortalConfig(),
    getStudioNavConfig(),
    getRequestLocaleContext(),
  ]);
  const { locale, contentLocale, bilingual } = localeCtx;
  const t = (key: string) => translateMessage(locale, key);
  const tEn = (key: string) => translateMessage("en", key);

  const logoUrl = decorate.logoUrl || DEFAULT_LOGO_URL;
  const avatarDisplayUrl = session?.avatarUrl
    ? await resolveStoredAccessUrl(session.avatarUrl)
    : "";

  const brandResolved = await resolveContentText({
    entityType: "decorate",
    entityId: "default",
    field: "brandName",
    source: decorate.brandName || "歪歪艾斯",
    locale: contentLocale,
  });
  // 站长：默认中文品牌名，英文悬浮；访客看匹配语言
  const brandPrimary = bilingual
    ? brandResolved.source
    : brandResolved.text;
  const brandSecondary =
    bilingual && brandResolved.text !== brandResolved.source
      ? brandResolved.text
      : undefined;

  const enabledPortalNav = portal.nav.filter((item) => item.enabled !== false);
  const portalNavSource =
    enabledPortalNav.length > 0
      ? enabledPortalNav
      : [
          { key: "home", href: "/", label: "首页" },
          { key: "company", href: "/about/company", label: "公司介绍" },
          { key: "person", href: "/about/person", label: "个人介绍" },
          { key: "courses", href: "/courses", label: "网课资料" },
          { key: "meetup", href: "/meetup", label: "约搭" },
          { key: "shop", href: "/shop", label: "商城" },
          { key: "forum", href: "/forum", label: "大学论坛" },
          { key: "games", href: "/games", label: "游戏中心" },
        ];

  const links: HeaderNavLink[] = await Promise.all(
    portalNavSource.map(async (item) => {
      const key = navMessageKey({ label: item.label, href: item.href });
      if (key) {
        return {
          href: item.href,
          label: bilingual ? t(key) : t(key),
          labelSecondary: bilingual ? tEn(key) : undefined,
        };
      }
      if (item.key) {
        const resolved = await resolveContentText({
          entityType: "portal",
          entityId: "default",
          field: `nav.${item.key}.label`,
          source: item.label,
          locale: contentLocale,
        });
        return {
          href: item.href,
          label: bilingual ? resolved.source : resolved.text,
          labelSecondary:
            bilingual && resolved.text !== resolved.source
              ? resolved.text
              : undefined,
        };
      }
      return { href: item.href, label: item.label };
    }),
  );

  if (session) {
    links.push({
      href: "/account",
      label: t("nav.account"),
      labelSecondary: bilingual ? tEn("nav.account") : undefined,
    });
    if (canAccessStudio(session.role)) {
      const studioKey = session.role === "AGENT" ? "nav.agent" : "nav.studio";
      links.push({
        href: "/studio",
        label: t(studioKey),
        labelSecondary: bilingual ? tEn(studioKey) : undefined,
      });
    }
    if (isAdmin(session.role)) {
      const adminChildren = studioNav.topAdmin
        .filter((item) => item.key !== "admin")
        .map((item) => ({ href: item.href, label: item.label }));
      links.push({
        href: "/studio/admin",
        label: t("nav.admin"),
        labelSecondary: bilingual ? tEn("nav.admin") : undefined,
        children: adminChildren,
      });
    }
  }

  return (
    <header className="glass-bar tilt-glass-bar sticky top-0 z-40 border-b">
      <div className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 px-2 py-2 sm:min-h-16 sm:gap-3 sm:px-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:px-4">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-1.5 self-center sm:gap-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={brandPrimary}
            className="h-8 w-auto max-w-[72px] shrink-0 object-contain object-left sm:h-9 sm:max-w-[160px]"
          />
          {decorate.showBrandText ? (
            <span
              className={`brand-mark min-w-0 truncate leading-none text-[var(--ink)] ${typoRoleClass("brand")}`}
              style={typoRoleStyle("brand")}
            >
              <BilingualHover
                primary={brandPrimary}
                secondary={brandSecondary}
              />
            </span>
          ) : null}
        </Link>

        <div className="hidden min-w-0 justify-center lg:flex">
          <SiteHeaderNav links={links} variant="desktop" />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-3 lg:gap-4">
          <SiteHomeClock />
          <SiteHeaderNav links={links} variant="mobile" />
          {session ? (
            <>
              <ChatUnreadBadge />
              <Link
                href="/account"
                className="flex min-h-[var(--control-h)] max-w-[9rem] items-center gap-1.5 rounded-full py-1 pl-1 pr-1.5 transition active:bg-black/5 sm:max-w-[14rem] sm:gap-2 sm:pr-2"
                title={bilingual ? tEn("nav.account") : t("nav.account")}
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
                  title={bilingual ? tEn("nav.logout") : undefined}
                >
                  {t("nav.logout")}
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
                {t("nav.login")}
              </Link>
              <Link
                href="/register"
                className={`btn btn-fire btn-compact sm:px-4 ${typoRoleClass("nav")}`}
                style={typoRoleStyle("nav")}
              >
                {t("nav.register")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

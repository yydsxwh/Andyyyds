import Link from "next/link";
import { ChatUnreadBadge } from "@/components/chat/chat-unread-badge";
import { SiteHeaderNav, type HeaderNavLink } from "@/components/site-header-nav";
import { SiteHomeClock } from "@/components/site-home-clock";
import { SiteHomeLogo } from "@/components/site-home-logo";
import { SiteHomePngLogos } from "@/components/site-home-png-logos";
import { UserAvatar } from "@/components/user-avatar";
import { getSession } from "@andyyyds/shared/auth";
import { DEFAULT_LOGO_URL } from "@andyyyds/shared/decorate";
import { BilingualHover } from "@/components/i18n/bilingual-hover";
import { resolveContentText } from "@andyyyds/shared/i18n/content-resolve";
import { getRequestLocaleContext } from "@andyyyds/shared/i18n/get-request-locale";
import { translateMessage } from "@andyyyds/shared/i18n/messages";
import { navHoverMessageKey, navMessageKey } from "@andyyyds/shared/i18n/nav-labels";
import { typoRoleClass, typoRoleStyle } from "@andyyyds/shared/site-typography";
import { canAccessStudio, canManageDecorate, hasRole, isAdmin } from "@andyyyds/shared/roles";
import {
  getDecorateConfig,
  getPortalConfig,
  getStudioNavConfig,
} from "@andyyyds/shared/site-settings";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";

/**
 * 游戏中心并进「软件产品」下拉，少占顶栏一位；软件产品关掉时仍单独露出游戏。
 */
function nestGamesUnderProducts(links: HeaderNavLink[]): HeaderNavLink[] {
  const isGames = (item: HeaderNavLink) => item.href === "/games";
  const isProducts = (item: HeaderNavLink) => item.href === "/products";
  const games = links.find(isGames);
  if (!games?.href) return links;
  const rest = links.filter((item) => !isGames(item));
  const productsIndex = rest.findIndex(isProducts);
  if (productsIndex < 0) return links;
  const products = rest[productsIndex];
  const children = [...(products.children || [])];
  if (!children.some((child) => child.href === games.href)) {
    children.push({
      href: games.href,
      label: games.label,
      labelSecondary: games.labelSecondary,
    });
  }
  rest[productsIndex] = { ...products, children };
  return rest;
}

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
          { key: "products", href: "/products", label: "软件产品" },
          { key: "forum", href: "/forum", label: "论坛" },
          { key: "games", href: "/games", label: "游戏中心" },
        ];

  const mappedPortalLinks: HeaderNavLink[] = await Promise.all(
    portalNavSource.map(async (item) => {
      const displayKey = navMessageKey({ label: item.label });
      const hoverKey = navHoverMessageKey({
        label: item.label,
        href: item.href,
        key: item.key,
      });
      // 主文案：改过的 CMS 名称（如「论坛」）必须保留；未改过的才走语言包
      let label = item.label;
      if (displayKey) {
        label = bilingual ? item.label : t(displayKey);
      } else if (item.key) {
        const resolved = await resolveContentText({
          entityType: "portal",
          entityId: "default",
          field: `nav.${item.key}.label`,
          source: item.label,
          locale: contentLocale,
        });
        label = bilingual ? resolved.source : resolved.text;
      }
      const fromCatalogEn = hoverKey ? tEn(hoverKey) : "";
      return {
        href: item.href,
        label,
        labelSecondary:
          bilingual && fromCatalogEn && fromCatalogEn !== label
            ? fromCatalogEn
            : undefined,
      };
    }),
  );

  const links: HeaderNavLink[] = nestGamesUnderProducts(mappedPortalLinks);

  if (session) {
    links.push({
      href: "/account",
      label: t("nav.account"),
      labelSecondary: bilingual ? tEn("nav.account") : undefined,
    });
    if (canAccessStudio(session.role)) {
      const studioKey = hasRole(session, "AGENT") ? "nav.agent" : "nav.studio";
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
    <>
    <header className="glass-bar tilt-glass-bar sticky top-0 z-40 overflow-visible border-b">
      <div className="relative grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:min-h-16 sm:gap-3 sm:px-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:px-4">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-1.5 self-center sm:gap-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={brandPrimary}
            className="h-8 w-auto max-w-[56px] shrink-0 object-contain object-left sm:h-9 sm:max-w-[160px]"
          />
          {decorate.showBrandText ? (
            <span
              className={`brand-mark hidden min-w-0 truncate leading-none text-[var(--ink)] min-[380px]:inline ${typoRoleClass("brand")}`}
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

        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-3 lg:gap-4">
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
                className={`btn btn-secondary btn-compact px-2.5 text-sm sm:px-4 ${typoRoleClass("nav")}`}
                style={typoRoleStyle("nav")}
              >
                {t("nav.login")}
              </Link>
              <Link
                href="/register"
                className={`btn btn-fire btn-compact hidden min-[420px]:inline-flex sm:px-4 ${typoRoleClass("nav")}`}
                style={typoRoleStyle("nav")}
              >
                {t("nav.register")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
    {/* 自由布局启用后时钟改走首页画布，避免顶栏与画布各画一只 */}
    {decorate.homeWidgetLayout?.enabled ? null : (
      <>
        <SiteHomeLogo
          config={decorate.homeLogo}
          canDrag={Boolean(session && canManageDecorate(session))}
        />
        <SiteHomeClock
          config={decorate.homeClock}
          canDrag={Boolean(session && canManageDecorate(session))}
        />
      </>
    )}
    <SiteHomePngLogos
      config={decorate.homeLogo}
      canDrag={Boolean(session && canManageDecorate(session))}
    />
    </>
  );
}

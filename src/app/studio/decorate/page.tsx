import Link from "next/link";
import { redirect } from "next/navigation";
import { DecoratePanel } from "@/components/decorate-panel";
import { DecorateSubnav } from "@/components/decorate-subnav";
import { HomeWidgetLayoutEditor } from "@/components/home-widget-layout-editor";
import { SiteThemePanel } from "@/components/site-theme-panel";
import { StudioNav } from "@/components/studio-nav";
import { TiltParallaxToggle } from "@/components/tilt-parallax-provider";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";
import {
  getDecorateConfig,
  getPortalConfig,
} from "@andyyyds/shared/site-settings";

export const dynamic = "force-dynamic";

export default async function StudioDecoratePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.role)) redirect("/studio");

  const [decorate, portal] = await Promise.all([
    getDecorateConfig(),
    getPortalConfig(),
  ]);
  const homeCards = portal.nav.filter(
    (item) =>
      item.enabled !== false &&
      item.key !== "home" &&
      item.key !== "games",
  );

  return (
    <div className="container space-y-8 py-8 sm:py-12">
      <StudioNav current="decorate" area="admin" />
      <div>
        <h1 className="text-3xl font-semibold">装修</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          网站装扮负责主题配色与门面；页面模板负责首页与自定义页的模块编排。两者互不影响。
        </p>
      </div>

      <DecorateSubnav current="decorate" />

      {/* 页面模板入口：避免用户以为 DIY 布局仍是顶栏独立项 */}
      <Link
        href="/studio/templates"
        className="surface flex min-h-[5.5rem] flex-col justify-center rounded-[24px] px-5 py-4 transition hover:-translate-y-0.5 hover:border-[var(--brand)]/35 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <div>
          <div className="text-lg font-semibold text-[var(--ink)]">
            页面模板 DIY
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            模块编排首页、自定义页与个人中心模板；保存写入页面模板配置，不改动主题装扮。
          </p>
        </div>
        <span className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--brand)] px-5 text-sm font-medium text-white sm:mt-0 sm:shrink-0">
          进入页面模板
        </span>
      </Link>

      <div>
        <h2 className="text-xl font-semibold">网站装扮</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          一键主题、换背景、换配色与轻量版式：点选只在本页试穿，确认后点「保存装扮」才全站生效。下方可继续配置
          Logo 与首页主视觉。
        </p>
      </div>

      <SiteThemePanel initial={decorate} />

      <details open className="surface rounded-[28px] p-5 sm:p-6">
        <summary className="cursor-pointer list-none touch-manipulation text-lg font-semibold">
          首页卡片与时钟：拖动 / 改大小
          <span className="mt-1 block text-sm font-normal text-[var(--muted)]">
            自由摆放门户入口卡片和时钟。启用并保存后，前台首页按此位置与尺寸显示；未启用时保持原来的栅格和顶栏时钟。
          </span>
        </summary>
        <div className="mt-6">
          <HomeWidgetLayoutEditor
            initial={decorate.homeWidgetLayout}
            navItems={homeCards}
            clockConfig={decorate.homeClock}
          />
        </div>
      </details>

      {/* 本机体验开关：不写 decorateJson，避免全站访客被微信权限打扰 */}
      <TiltParallaxToggle />

      {/* 手机默认展开：窄屏上折叠易被忽略，站长在微信里也要能直接改 Logo/Banner */}
      <details open className="surface rounded-[28px] p-5 sm:p-6">
        <summary className="cursor-pointer list-none touch-manipulation text-lg font-semibold">
          门面装修：Logo / 首页文案 / Banner / 点击链接
          <span className="mt-1 block text-sm font-normal text-[var(--muted)]">
            配置品牌标识、首页主视觉图片，以及每张图/按钮的跳转地址
          </span>
        </summary>
        <div className="mt-6">
          <DecoratePanel initial={decorate} />
        </div>
      </details>
    </div>
  );
}

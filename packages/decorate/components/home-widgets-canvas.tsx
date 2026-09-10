import { ConfigurableLink } from "@/components/configurable-link";
import { HomePortalCardBody } from "@andyyyds/decorate/components/home-portal-card-body";
import { SiteHomeClock } from "@andyyyds/decorate/components/site-home-clock";
import { SiteHomeLogo } from "@andyyyds/decorate/components/site-home-logo";
import type { HomeClockConfig } from "@andyyyds/decorate/lib/home-clock";
import type { HomeLogoConfig } from "@andyyyds/decorate/lib/home-logo";
import {
  HOME_WIDGET_CLOCK_ID,
  HOME_WIDGET_LOGO_ID,
  homeWidgetBoxStyle,
  homeWidgetNavId,
  mergeHomeWidgetBoxes,
  resolveCanvasMinHeightPx,
  type HomeWidgetLayoutConfig,
} from "@andyyyds/decorate/lib/home-widget-layout";
import type { PortalNavLink } from "@andyyyds/shared/portal";
import { typoRoleClass, typoRoleStyle } from "@andyyyds/decorate/lib/site-typography";

export function HomeWidgetsCanvas({
  modules,
  layout,
  clockConfig,
  logoConfig,
  className = "",
}: {
  modules: PortalNavLink[];
  layout: HomeWidgetLayoutConfig;
  clockConfig?: HomeClockConfig | null;
  logoConfig?: HomeLogoConfig | null;
  className?: string;
}) {
  const navKeys = modules.map((item) => item.key);
  const boxes = mergeHomeWidgetBoxes(layout.items, navKeys);
  const minHeight = resolveCanvasMinHeightPx(boxes, layout.canvasMinHeightPx);
  const clockBox = boxes[HOME_WIDGET_CLOCK_ID];
  const logoBox = boxes[HOME_WIDGET_LOGO_ID];

  return (
    <div className={`relative w-full ${className}`} style={{ minHeight }}>
      {logoBox ? (
        <div
          className="absolute z-20 overflow-visible"
          style={homeWidgetBoxStyle(logoBox)}
        >
          <SiteHomeLogo fill config={logoConfig} className="h-full w-full" />
        </div>
      ) : null}
      {clockBox ? (
        <div
          className="absolute z-20 overflow-visible"
          style={homeWidgetBoxStyle(clockBox)}
        >
          <SiteHomeClock fill config={clockConfig} className="h-full w-full" />
        </div>
      ) : null}
      {modules.map((item) => {
        const box = boxes[homeWidgetNavId(item.key)];
        if (!box) return null;
        return (
          <ConfigurableLink
            key={item.key}
            href={item.href}
            openInNewTab={Boolean(item.openInNewTab)}
            className="surface-soft group absolute block overflow-hidden rounded-[28px] p-5 transition touch-manipulation hover:-translate-y-0.5 active:-translate-y-0.5"
            style={homeWidgetBoxStyle(box)}
          >
            <HomePortalCardBody
              label={item.label}
              comingSoon={item.comingSoon}
            />
          </ConfigurableLink>
        );
      })}
    </div>
  );
}

export function HomeWidgetsSection({
  modules,
  layout,
  clockConfig,
  logoConfig,
}: {
  modules: PortalNavLink[];
  layout: HomeWidgetLayoutConfig;
  clockConfig?: HomeClockConfig | null;
  logoConfig?: HomeLogoConfig | null;
}) {
  return (
    <section className="pb-14">
      <div className="container">
        <div className="mb-6">
          <h2
            className={`font-semibold ${typoRoleClass("sectionTitle")}`}
            style={typoRoleStyle("sectionTitle")}
          >
            门户入口
          </h2>
          <p
            className={`mt-2 text-[var(--muted)] ${typoRoleClass("sectionDesc")}`}
            style={typoRoleStyle("sectionDesc")}
          >
            多功能站点正在扩展：介绍、知识付费、约搭、商城与大学论坛已可用，游戏中心陆续开放
          </p>
        </div>
        <HomeWidgetsCanvas
          modules={modules}
          layout={layout}
          clockConfig={clockConfig}
          logoConfig={logoConfig}
        />
      </div>
    </section>
  );
}

export function isHomeWidgetLayoutEnabled(
  layout: HomeWidgetLayoutConfig | undefined,
) {
  return layout?.enabled === true;
}

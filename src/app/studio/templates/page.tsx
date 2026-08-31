import { redirect } from "next/navigation";
import { DecorateSubnav } from "@/components/decorate-subnav";
import { PageTemplateListPanel } from "@/components/page-template-list-panel";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { ensureNavDefaultTemplates } from "@andyyyds/shared/nav-page-templates";
import { stringifyPageTemplates } from "@andyyyds/shared/page-templates";
import { isAdmin } from "@andyyyds/shared/roles";
import {
  getPageTemplatesConfig,
  getSiteSettings,
  invalidateSiteSettingsCache,
} from "@andyyyds/shared/site-settings";

export const dynamic = "force-dynamic";

export default async function StudioTemplatesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.role)) redirect("/studio");

  let config = await getPageTemplatesConfig();
  const settings = await getSiteSettings();

  // 打开列表时自动补齐/修复各导航页的系统锁定默认模板
  const ensured = ensureNavDefaultTemplates(config);
  if (ensured.changed) {
    await prisma.siteSettings.update({
      where: { id: "default" },
      data: {
        pageTemplatesJson: stringifyPageTemplates(ensured.config),
      },
    });
    invalidateSiteSettingsCache();
    config = ensured.config;
  }

  return (
    <div className="container space-y-8 py-8 sm:py-12">
      <StudioNav current="decorate" area="admin" />
      <div>
        <h1 className="text-3xl font-semibold">页面模板</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          每种导航页都有一份「系统默认」（不可改删）；误设其它模板后，再把它设为默认即可恢复原页面。自定义 DIY 须点「设为默认」才上前台。主题配色在「网站装扮」。
        </p>
      </div>
      <DecorateSubnav current="templates" />
      <PageTemplateListPanel
        initial={config.templates}
        siteUrl={settings.siteUrl || ""}
      />
    </div>
  );
}

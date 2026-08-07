import { redirect } from "next/navigation";
import { SiteSettingsPanel } from "@/components/site-settings-panel";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { getSiteSettings, publicSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function StudioSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.role)) redirect("/studio");

  const settings = publicSiteSettings(await getSiteSettings());

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="settings" area="admin" />
      <div>
        <h1 className="text-3xl font-semibold">系统设置</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          配置站点地址、公众号接口、支付，以及存储分流：课程视频用点播、其他文件用
          OSS。各分区可独立保存。文案请到「内容管理」，视觉请到「装修」。
        </p>
      </div>
      <SiteSettingsPanel initial={settings} />
    </div>
  );
}

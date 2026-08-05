import { redirect } from "next/navigation";
import { SiteSettingsPanel } from "@/components/site-settings-panel";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { getSiteSettings, publicSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function StudioSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/studio");

  const settings = publicSiteSettings(await getSiteSettings());

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="settings" />
      <div>
        <h1 className="text-3xl font-semibold">系统设置</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          配置微信支付、支付宝与素材存储方式。密钥仅站长可改，保存后即时生效，无需改服务器文件。
        </p>
      </div>
      <SiteSettingsPanel initial={settings} />
    </div>
  );
}

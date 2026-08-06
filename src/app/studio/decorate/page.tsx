import { redirect } from "next/navigation";
import { DecoratePanel } from "@/components/decorate-panel";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { getDecorateConfig } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function StudioDecoratePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/studio");

  const decorate = await getDecorateConfig();

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="decorate" />
      <div>
        <h1 className="text-3xl font-semibold">店铺装修</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          自由配置站点 Logo、首页主视觉与 Banner。保存后前台即时生效。
        </p>
      </div>
      <DecoratePanel initial={decorate} />
    </div>
  );
}

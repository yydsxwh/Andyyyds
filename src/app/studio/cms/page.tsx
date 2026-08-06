import { redirect } from "next/navigation";
import { CmsPanel } from "@/components/cms-panel";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import {
  getOrderFormConfig,
  getStudioNavConfig,
  getUiCopy,
} from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function StudioCmsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/studio");

  const [uiCopy, orderForm, studioNav] = await Promise.all([
    getUiCopy(),
    getOrderFormConfig(),
    getStudioNavConfig(),
  ]);

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="cms" />
      <div>
        <h1 className="text-3xl font-semibold">内容管理</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          管理后台导航、文案与下单信息采集字段。视觉门面请到「店铺装修」。
        </p>
      </div>
      <CmsPanel initial={{ uiCopy, orderForm, studioNav }} />
    </div>
  );
}

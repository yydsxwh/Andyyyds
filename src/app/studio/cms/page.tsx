import { redirect } from "next/navigation";
import { CmsPanel } from "@/components/cms-panel";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";
import {
  getOrderFormConfig,
  getPortalConfig,
  getStudioNavConfig,
  getUiCopy,
} from "@andyyyds/shared/site-settings";

export const dynamic = "force-dynamic";

export default async function StudioCmsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.role)) redirect("/studio");

  const [uiCopy, orderForm, studioNav, portal] = await Promise.all([
    getUiCopy(),
    getOrderFormConfig(),
    getStudioNavConfig(),
    getPortalConfig(),
  ]);

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="cms" area="admin" />
      <div>
        <h1 className="text-3xl font-semibold">内容管理</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          点击分区展开编辑；可按区分保存，也可一次保存全部。视觉门面请到「装修」。
        </p>
      </div>
      <CmsPanel initial={{ uiCopy, orderForm, studioNav, portal }} />
    </div>
  );
}

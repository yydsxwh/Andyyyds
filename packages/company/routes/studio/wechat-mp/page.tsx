import { redirect } from "next/navigation";
import { StudioNav } from "@/components/studio-nav";
import { WechatMpPromoPanel } from "@andyyyds/company/components/wechat-mp-promo-panel";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

/** 站长：公众号图文与合集 → 公司宣传 */
export default async function StudioWechatMpPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.role)) redirect("/studio");

  return (
    <div className="container space-y-6 py-10 sm:py-12">
      <StudioNav current="wechat-mp" area="admin" />
      <div>
        <h1 className="text-2xl font-semibold">公众号宣传</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          同步自己公众号的已发表图文与主页合集，展示在前台「公司介绍」。
        </p>
      </div>
      <WechatMpPromoPanel />
    </div>
  );
}

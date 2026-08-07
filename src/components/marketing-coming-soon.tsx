import { redirect } from "next/navigation";
import {
  MarketingSubnav,
  type MarketingNavKey,
} from "@/components/marketing-subnav";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { canManageMarketing } from "@/lib/roles";

/** 营销占位页（拼团 / VIP / 短链） */
export async function MarketingComingSoonView({
  title,
  navKey,
  blurb,
}: {
  title: string;
  navKey: Extract<MarketingNavKey, "group-buy" | "vip" | "short-links">;
  blurb: string;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageMarketing(session.role)) redirect("/studio");

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="marketing" />
      <div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{blurb}</p>
      </div>
      <MarketingSubnav current={navKey} />
      <div className="surface rounded-[28px] p-8 text-center">
        <p className="text-lg font-medium text-[var(--brand)]">即将开放</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          功能规划中，敬请期待。可先使用优惠券与分销完成获客。
        </p>
      </div>
    </div>
  );
}

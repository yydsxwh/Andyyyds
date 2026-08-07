import Link from "next/link";
import { redirect } from "next/navigation";
import { MarketingSubnav } from "@/components/marketing-subnav";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { canManageMarketing } from "@/lib/roles";

export const dynamic = "force-dynamic";

const CARDS = [
  {
    title: "优惠券",
    desc: "比例折扣与定额减免，支持门槛、库存与有效期。",
    href: "/studio/marketing/coupons",
    ready: true,
  },
  {
    title: "拼团",
    desc: "多人成团享优惠价。",
    href: "/studio/marketing/group-buy",
    ready: false,
  },
  {
    title: "VIP会员",
    desc: "会员等级与专属权益。",
    href: "/studio/marketing/vip",
    ready: false,
  },
  {
    title: "分销",
    desc: "邀请码、佣金与分销比例配置。",
    href: "/studio/distribution",
    ready: true,
  },
  {
    title: "短链生成",
    desc: "活动短链与追踪。",
    href: "/studio/marketing/short-links",
    ready: false,
  },
] as const;

export default async function StudioMarketingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageMarketing(session.role)) redirect("/studio");

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="marketing" />
      <div>
        <h1 className="text-3xl font-semibold">营销中心</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          管理优惠与增长工具。当前已开放优惠券；拼团 / VIP / 短链即将上线。
        </p>
      </div>
      <MarketingSubnav current="hub" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="surface block rounded-[24px] p-5 transition hover:border-[var(--brand)]"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{card.title}</h2>
              {!card.ready ? (
                <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs text-[var(--brand)]">
                  即将开放
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

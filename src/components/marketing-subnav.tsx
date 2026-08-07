/**
 * 营销中心子导航：优惠券 / 拼团 / VIP / 分销 / 短链
 */

import Link from "next/link";

const LINKS = [
  { key: "hub", label: "概览", href: "/studio/marketing" },
  { key: "coupons", label: "优惠券", href: "/studio/marketing/coupons" },
  { key: "group-buy", label: "拼团", href: "/studio/marketing/group-buy" },
  { key: "vip", label: "VIP会员", href: "/studio/marketing/vip" },
  { key: "distribution", label: "分销", href: "/studio/distribution" },
  { key: "short-links", label: "短链生成", href: "/studio/marketing/short-links" },
] as const;

export type MarketingNavKey = (typeof LINKS)[number]["key"];

export function MarketingSubnav({ current }: { current: MarketingNavKey }) {
  return (
    <div className="flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const active = current === link.key;
        return (
          <Link
            key={link.key}
            href={link.href}
            className={`min-h-10 whitespace-nowrap rounded-full px-4 py-2.5 text-base ${
              active
                ? "bg-[var(--brand-soft)] font-medium text-[var(--brand)]"
                : "border border-[var(--line)] bg-white/70 text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/shop", label: "首页", match: (p: string) => p === "/shop" || p.startsWith("/shop/") },
  { href: "/cart", label: "购物车", match: (p: string) => p.startsWith("/cart") },
  { href: "/orders", label: "订单", match: (p: string) => p.startsWith("/orders") },
] as const;

/** 商城底部导航：窄屏固定底栏，对标淘宝「逛/车/订单」 */
export function ShopBottomNav() {
  const pathname = usePathname() || "";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--card)]/95 backdrop-blur-md safe-pb"
      aria-label="商城导航"
    >
      <div className="mx-auto flex max-w-lg">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center text-xs ${
                active
                  ? "font-semibold text-[var(--fire)]"
                  : "text-[var(--muted)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

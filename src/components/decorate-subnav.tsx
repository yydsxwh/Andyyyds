/**
 * 装修子导航：网站装扮（主题/配色/门面）与页面模板（模块 DIY）同属「装修」。
 * 顶栏只保留一个「装修」入口，细节切换在此完成。
 */

import Link from "next/link";

const LINKS = [
  { key: "decorate", label: "网站装扮", href: "/studio/decorate" },
  { key: "templates", label: "页面模板", href: "/studio/templates" },
] as const;

export type DecorateNavKey = (typeof LINKS)[number]["key"];

export function DecorateSubnav({ current }: { current: DecorateNavKey }) {
  return (
    <nav
      className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="装修子导航"
    >
      {LINKS.map((link) => {
        const active = current === link.key;
        return (
          <Link
            key={link.key}
            href={link.href}
            className={`min-h-11 shrink-0 touch-manipulation whitespace-nowrap rounded-full px-4 py-2.5 text-base ${
              active
                ? "bg-[var(--brand-soft)] font-medium text-[var(--brand)]"
                : "border border-[var(--line)] bg-white/70 text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

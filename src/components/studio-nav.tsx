import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getStudioNavConfig } from "@/lib/site-settings";

export async function StudioNav({
  current,
}: {
  current:
    | "overview"
    | "media"
    | "courses"
    | "compose"
    | "distribution"
    | "orders"
    | "merchants"
    | "decorate"
    | "cms"
    | "settings";
}) {
  const [session, nav] = await Promise.all([getSession(), getStudioNavConfig()]);
  const links =
    session?.role === "ADMIN"
      ? [...nav.topBase, ...nav.topAdmin]
      : [...nav.topBase];

  // 兼容旧 compose 高亮为课程中心
  const activeKey = current === "compose" ? "courses" : current;

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => {
        const active = activeKey === link.key;
        return (
          <Link
            key={link.key}
            href={link.href}
            className={`rounded-full px-4 py-2 text-sm ${
              active
                ? "bg-[var(--brand)] text-white"
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

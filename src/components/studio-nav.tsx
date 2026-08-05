import Link from "next/link";
import { getSession } from "@/lib/auth";

const baseLinks = [
  { href: "/studio", label: "概览", key: "overview" },
  { href: "/studio/media", label: "素材中心", key: "media" },
  { href: "/studio/compose", label: "用素材做课", key: "compose" },
  { href: "/studio/distribution", label: "分销管理", key: "distribution" },
] as const;

const adminLinks = [
  { href: "/studio/merchants", label: "商家管理", key: "merchants" },
  { href: "/studio/settings", label: "系统设置", key: "settings" },
] as const;

export async function StudioNav({
  current,
}: {
  current:
    | "overview"
    | "media"
    | "compose"
    | "distribution"
    | "merchants"
    | "settings";
}) {
  const session = await getSession();
  const links =
    session?.role === "ADMIN" ? [...baseLinks, ...adminLinks] : [...baseLinks];

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => {
        const active = current === link.key;
        return (
          <Link
            key={link.href}
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

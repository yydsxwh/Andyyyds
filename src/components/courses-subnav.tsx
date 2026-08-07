import Link from "next/link";
import { getStudioNavConfig } from "@/lib/site-settings";

export async function CoursesSubnav({
  current,
  canCreate = true,
}: {
  current: "list" | "materials" | "compose";
  /** 老师不可见「创建课程/资料」（无 canCreateSellableProducts） */
  canCreate?: boolean;
}) {
  const nav = await getStudioNavConfig();
  // 老师可看列表与「我的资料」，但不能进 compose 创建可售产品
  const links = canCreate
    ? nav.courses
    : nav.courses.filter((link) => link.key !== "compose");

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => {
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

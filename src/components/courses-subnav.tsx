import Link from "next/link";
import { getStudioNavConfig } from "@/lib/site-settings";

export async function CoursesSubnav({
  current,
}: {
  current: "list" | "compose";
}) {
  const nav = await getStudioNavConfig();

  return (
    <div className="flex flex-wrap gap-2">
      {nav.courses.map((link) => {
        const active = current === link.key;
        return (
          <Link
            key={link.key}
            href={link.href}
            className={`rounded-full px-4 py-2 text-sm ${
              active
                ? "bg-[rgba(15,107,92,0.14)] font-medium text-[var(--brand)]"
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

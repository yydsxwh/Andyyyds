import Link from "next/link";
import {
  FORUM_SPACE_KIND_LABEL,
  FORUM_SPACE_LIST_PATH,
  type ForumSpaceKind,
} from "@andyyyds/forum/lib/forum-space";

const SECTIONS: ForumSpaceKind[] = ["UNIVERSITY", "CIRCLE", "CITY"];

export function ForumSectionNav({ current }: { current: ForumSpaceKind }) {
  return (
    <nav className="-mx-1 flex gap-2 overflow-x-auto px-1" aria-label="论坛分区">
      {SECTIONS.map((kind) => {
        const active = kind === current;
        return (
          <Link
            key={kind}
            href={FORUM_SPACE_LIST_PATH[kind]}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm ${
              active
                ? "bg-[var(--brand)] text-white"
                : "bg-[var(--line)]/40"
            }`}
          >
            {FORUM_SPACE_KIND_LABEL[kind]}
          </Link>
        );
      })}
    </nav>
  );
}

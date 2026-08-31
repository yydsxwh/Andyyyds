"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FORUM_UNIVERSITY_REGION_LABEL,
  type ForumUniversityRegion,
} from "@andyyyds/forum/lib/forum-university";

export type ForumCampusCard = {
  id: string;
  name: string;
  slug: string;
  slogan: string;
  description: string;
  logoUrl: string;
  region: string;
  _count: { members: number; posts: number };
};

type Tab = "CHINA" | "INTERNATIONAL";

export function ForumCampusDirectory({ cards }: { cards: ForumCampusCard[] }) {
  const [tab, setTab] = useState<Tab>("CHINA");
  const grouped = useMemo(() => {
    const china = cards.filter((card) => (card.region || "CHINA") !== "INTERNATIONAL");
    const intl = cards.filter((card) => card.region === "INTERNATIONAL");
    return { CHINA: china, INTERNATIONAL: intl };
  }, [cards]);
  const visible = grouped[tab];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {(["CHINA", "INTERNATIONAL"] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm ${
              tab === key
                ? "bg-[var(--brand)] text-white"
                : "bg-[var(--line)]/40"
            }`}
            onClick={() => setTab(key)}
          >
            {FORUM_UNIVERSITY_REGION_LABEL[key as ForumUniversityRegion]}
            <span className="ml-1.5 opacity-80">{grouped[key].length}</span>
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="surface rounded-[28px] px-5 py-12 text-center text-sm text-[var(--muted)]">
          这一类还没有高校分区。
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((uni) => (
            <Link
              key={uni.id}
              href={`/forum/${uni.slug}`}
              className="surface block rounded-[28px] p-5 active:opacity-80"
            >
              <div className="flex items-center gap-3">
                {uni.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={uni.logoUrl}
                    alt=""
                    className="h-12 w-12 rounded-2xl object-cover"
                  />
                ) : (
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand)]/10 text-lg font-semibold text-[var(--brand)]">
                    {uni.name.slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">{uni.name}</h2>
                  <p className="text-xs text-[var(--muted)]">
                    {uni._count.members} 人 · {uni._count.posts} 帖
                  </p>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                {uni.slogan || uni.description || "点击进入本校专区"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";

export type ForumSpaceCard = {
  id: string;
  name: string;
  slug: string;
  slogan: string;
  description: string;
  logoUrl: string;
  _count: { members: number; posts: number };
};

export function ForumSpaceDirectory({
  cards,
  emptyText,
  fallbackBlurb,
}: {
  cards: ForumSpaceCard[];
  emptyText: string;
  fallbackBlurb: string;
}) {
  if (cards.length === 0) {
    return (
      <p className="surface rounded-[28px] px-5 py-12 text-center text-sm text-[var(--muted)]">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((space) => (
        <Link
          key={space.id}
          href={`/forum/${space.slug}`}
          className="surface block rounded-[28px] p-5 active:opacity-80"
        >
          <div className="flex items-center gap-3">
            {space.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={space.logoUrl}
                alt=""
                className="h-12 w-12 rounded-2xl object-cover"
              />
            ) : (
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand)]/10 text-lg font-semibold text-[var(--brand)]">
                {space.name.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{space.name}</h2>
              <p className="text-xs text-[var(--muted)]">
                {space._count.members} 人 · {space._count.posts} 帖
              </p>
            </div>
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
            {space.slogan || space.description || fallbackBlurb}
          </p>
        </Link>
      ))}
    </div>
  );
}

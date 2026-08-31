import Link from "next/link";

export type PlazaTab = "courses" | "materials";

type Props = {
  active: PlazaTab;
  /** 副文案随当前 Tab 变化（课程/资料语气不同） */
  subtitle: string;
};

const TABS: { id: PlazaTab; label: string; href: string }[] = [
  { id: "courses", label: "课程广场", href: "/courses" },
  { id: "materials", label: "资料广场", href: "/materials" },
];

/**
 * 网课资料下的同级广场切换：课程广场 | 资料广场。
 * 顶栏只留「网课资料」入口，资料不与首页/商城抢同级导航位。
 */
export function PlazaSwitcher({ active, subtitle }: Props) {
  return (
    <div className="mb-8 space-y-3">
      <div
        className="flex flex-wrap items-baseline gap-x-3 gap-y-2 sm:gap-x-4"
        role="tablist"
        aria-label="课程与资料广场切换"
      >
        {TABS.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <span key={tab.id} className="inline-flex items-baseline gap-x-3 sm:gap-x-4">
              {index > 0 ? (
                <span
                  className="select-none text-2xl font-light text-[var(--line)] sm:text-3xl"
                  aria-hidden
                >
                  |
                </span>
              ) : null}
              <Link
                href={tab.href}
                role="tab"
                aria-selected={selected}
                className={`min-h-11 touch-manipulation text-2xl font-semibold transition sm:text-3xl ${
                  selected
                    ? "text-[var(--ink)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {tab.label}
                {selected ? (
                  <span
                    className="mt-1 block h-0.5 w-full rounded-full bg-[var(--brand)]"
                    aria-hidden
                  />
                ) : (
                  <span className="mt-1 block h-0.5 w-full" aria-hidden />
                )}
              </Link>
            </span>
          );
        })}
      </div>
      <p className="text-[var(--muted)]">{subtitle}</p>
    </div>
  );
}

import { splitPortalBody, type PortalAboutPage } from "@/lib/portal";

type Props = {
  page: PortalAboutPage;
};

/** 公司 / 个人介绍页共用版式 */
export function AboutPageView({ page }: Props) {
  const paragraphs = splitPortalBody(page.body);

  return (
    <div className="container py-12 sm:py-16">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1.4fr_0.8fr] lg:items-start">
        <article className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--brand)]">门户介绍</p>
            <h1 className="brand-mark text-4xl font-semibold tracking-tight sm:text-5xl">
              {page.title}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
              {page.subtitle}
            </p>
          </div>
          <div className="space-y-4 text-base leading-8 text-[var(--ink)]">
            {paragraphs.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
        </article>

        <aside className="surface rounded-[28px] p-6 sm:p-7">
          <h2 className="text-lg font-semibold">要点</h2>
          <ul className="mt-5 space-y-4">
            {page.highlights.map((item) => (
              <li key={item.label + item.text} className="border-t border-[var(--line)] pt-4 first:border-t-0 first:pt-0">
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  {item.label}
                </div>
                <div className="mt-1 text-sm leading-6">{item.text}</div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

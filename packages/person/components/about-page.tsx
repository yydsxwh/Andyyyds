import { splitPortalBody, type PortalAboutPage } from "@andyyyds/shared/portal";

type Props = {
  page: PortalAboutPage;
  /** 外层已包 container 时避免双重留白（公司介绍+公众号宣传） */
  embedded?: boolean;
};

/** 公司 / 个人介绍页共用版式：加宽内容区、放大正文字号 */
export function AboutPageView({ page, embedded = false }: Props) {
  const paragraphs = splitPortalBody(page.body);

  const inner = (
    <div className="grid gap-8 lg:grid-cols-[1.55fr_0.85fr] lg:items-start lg:gap-10">
      <article className="space-y-5 sm:space-y-6">
        <div className="space-y-3">
          <p className="text-base font-medium text-[var(--brand)] sm:text-lg">
            门户介绍
          </p>
          <h1 className="brand-mark text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            {page.title}
          </h1>
          <p className="text-lg leading-8 text-[var(--muted)] sm:text-xl sm:leading-9">
            {page.subtitle}
          </p>
        </div>
        <div className="space-y-4 text-lg leading-9 text-[var(--ink)] sm:text-xl sm:leading-9">
          {paragraphs.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>
      </article>

      <aside className="surface rounded-[28px] p-5 sm:p-7">
        <h2 className="text-xl font-semibold sm:text-2xl">要点</h2>
        <ul className="mt-5 space-y-4">
          {page.highlights.map((item) => (
            <li
              key={item.label + item.text}
              className="border-t border-[var(--line)] pt-4 first:border-t-0 first:pt-0"
            >
              <div className="text-sm font-medium text-[var(--muted)]">
                {item.label}
              </div>
              <div className="mt-1 text-base leading-7 sm:text-lg sm:leading-8">
                {item.text}
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );

  if (embedded) return inner;
  return <div className="container py-10 sm:py-12">{inner}</div>;
}

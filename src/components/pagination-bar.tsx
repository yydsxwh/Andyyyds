import Link from "next/link";

type Props = {
  /** 当前页，从 1 起 */
  page: number;
  /** 总页数 */
  totalPages: number;
  /** 生成某一页的 href，如 (p) => `/about/company?page=${p}#articles` */
  hrefForPage: (page: number) => string;
};

/**
 * 分页：首页 / 上一页 / 页码 / 下一页 / 尾页。
 * 触控友好，窄屏可横滑页码。
 */
export function PaginationBar({ page, totalPages, hrefForPage }: Props) {
  if (totalPages <= 1) return null;

  const current = Math.min(Math.max(1, page), totalPages);
  // 当前页附近窗口，避免页数很多时按钮挤爆
  const windowSize = 5;
  let start = Math.max(1, current - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages: number[] = [];
  for (let p = start; p <= end; p += 1) pages.push(p);

  const btn =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 text-sm font-medium transition hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:pointer-events-none disabled:opacity-40";
  const active =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--brand)] bg-[var(--brand-soft)] px-3 text-sm font-semibold text-[var(--brand-strong)]";

  return (
    <nav
      className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="分页"
    >
      <p className="text-sm text-[var(--muted)] sm:text-base">
        第 {current} / {totalPages} 页
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {current <= 1 ? (
          <span className={`${btn} opacity-40`}>首页</span>
        ) : (
          <Link href={hrefForPage(1)} className={btn}>
            首页
          </Link>
        )}
        {current <= 1 ? (
          <span className={`${btn} opacity-40`}>上一页</span>
        ) : (
          <Link href={hrefForPage(current - 1)} className={btn}>
            上一页
          </Link>
        )}

        <div className="flex max-w-full gap-1.5 overflow-x-auto py-0.5">
          {start > 1 ? (
            <span className="inline-flex min-h-11 items-center px-1 text-[var(--muted)]">
              …
            </span>
          ) : null}
          {pages.map((p) =>
            p === current ? (
              <span key={p} className={active} aria-current="page">
                {p}
              </span>
            ) : (
              <Link key={p} href={hrefForPage(p)} className={btn}>
                {p}
              </Link>
            ),
          )}
          {end < totalPages ? (
            <span className="inline-flex min-h-11 items-center px-1 text-[var(--muted)]">
              …
            </span>
          ) : null}
        </div>

        {current >= totalPages ? (
          <span className={`${btn} opacity-40`}>下一页</span>
        ) : (
          <Link href={hrefForPage(current + 1)} className={btn}>
            下一页
          </Link>
        )}
        {current >= totalPages ? (
          <span className={`${btn} opacity-40`}>尾页</span>
        ) : (
          <Link href={hrefForPage(totalPages)} className={btn}>
            尾页
          </Link>
        )}
      </div>
    </nav>
  );
}

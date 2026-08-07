import Link from "next/link";
import { PaginationBar } from "@/components/pagination-bar";

export type PromoAlbumCard = {
  id: string;
  title: string;
  coverUrl: string;
  itemCount: number;
};

export type PromoArticleCard = {
  id: string;
  title: string;
  digest: string;
  thumbUrl: string;
  publishedAt: Date | null;
};

export type ArticlePagination = {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
};

/** 公司介绍页：合集 + 最新图文（加宽多列、标题加大、图文分页） */
export function CompanyPromoSections({
  albums,
  articles,
  articlePagination,
}: {
  albums: PromoAlbumCard[];
  articles: PromoArticleCard[];
  articlePagination?: ArticlePagination | null;
}) {
  if (!albums.length && !articles.length) return null;

  const paging = articlePagination;

  return (
    <div className="mt-10 space-y-10 border-t border-[var(--line)] pt-10 sm:mt-12 sm:space-y-12 sm:pt-12">
      {albums.length ? (
        <section>
          <div className="mb-4">
            <h2 className="text-2xl font-semibold sm:text-3xl">合集</h2>
            <p className="mt-1 text-base text-[var(--muted)]">
              来自公众号主页专辑
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {albums.map((album) => (
              <Link
                key={album.id}
                href={`/about/company/albums/${album.id}`}
                className="surface overflow-hidden rounded-[20px] transition hover:-translate-y-0.5"
              >
                {album.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={album.coverUrl}
                    alt=""
                    className="aspect-[16/10] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center bg-[var(--bg-deep)] text-sm text-[var(--muted)]">
                    合集
                  </div>
                )}
                <div className="p-3 sm:p-3.5">
                  <div className="line-clamp-2 text-base font-medium leading-snug sm:text-lg">
                    {album.title}
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    {album.itemCount} 篇
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {articles.length || (paging && paging.totalCount > 0) ? (
        <section id="articles">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold sm:text-3xl">最新图文</h2>
            <p className="mt-1 text-base text-[var(--muted)]">
              同步自公众号已发表内容
              {paging && paging.totalCount > 0
                ? ` · 共 ${paging.totalCount} 篇`
                : ""}
            </p>
          </div>
          {articles.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/about/company/articles/${article.id}`}
                  className="surface overflow-hidden rounded-[20px] transition hover:-translate-y-0.5"
                >
                  {article.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={article.thumbUrl}
                      alt=""
                      className="aspect-[16/10] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[16/10] items-center justify-center bg-[var(--bg-deep)] text-sm text-[var(--muted)]">
                      图文
                    </div>
                  )}
                  <div className="p-3 sm:p-3.5">
                    <div className="line-clamp-2 text-base font-medium leading-snug sm:text-lg">
                      {article.title || "无标题"}
                    </div>
                    {article.digest ? (
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--muted)] sm:text-[15px]">
                        {article.digest}
                      </p>
                    ) : null}
                    {article.publishedAt ? (
                      <p className="mt-1.5 text-sm text-[var(--muted)]">
                        {article.publishedAt.toLocaleDateString("zh-CN")}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              本页暂无图文
            </p>
          )}
          {paging && paging.totalPages > 1 ? (
            <PaginationBar
              page={paging.page}
              totalPages={paging.totalPages}
              hrefForPage={(p) =>
                p <= 1
                  ? "/about/company#articles"
                  : `/about/company?page=${p}#articles`
              }
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

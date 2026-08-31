import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAlbumDetail } from "@andyyyds/company/lib/wechat-mp-album";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const album = await getAlbumDetail(id);
  if (!album) return { title: "合集" };
  return { title: album.title || "合集" };
}

export default async function CompanyAlbumPage({ params }: Props) {
  const { id } = await params;
  const album = await getAlbumDetail(id);
  if (!album) notFound();

  return (
    <div className="container py-8 sm:py-12">
      <Link
        href="/about/company"
        className="text-sm text-[var(--brand)] hover:underline"
      >
        ← 返回公司介绍
      </Link>

      <header className="mt-4 mb-8 flex flex-col gap-4 sm:flex-row sm:items-end">
        {album.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={album.coverUrl}
            alt=""
            className="aspect-[16/10] w-full max-w-sm rounded-[24px] object-cover sm:w-48 sm:shrink-0"
          />
        ) : null}
        <div>
          <p className="text-sm font-medium text-[var(--brand)]">合集</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
            {album.title || "未命名合集"}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            共 {album.items.length} 篇
          </p>
        </div>
      </header>

      {album.items.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {album.items.map((item) => {
            const href = item.article
              ? `/about/company/articles/${item.article.id}`
              : item.wechatUrl || "";
            const title =
              item.article?.title || item.title || "无标题";
            const thumb =
              item.article?.thumbUrl || item.thumbUrl || "";
            const external = !item.article && Boolean(item.wechatUrl);

            const card = (
              <>
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt=""
                    className="aspect-[16/10] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center bg-[var(--bg-deep)] text-sm text-[var(--muted)]">
                    图文
                  </div>
                )}
                <div className="p-4">
                  <div className="line-clamp-2 font-medium">{title}</div>
                  {external ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      打开微信原文
                    </p>
                  ) : null}
                </div>
              </>
            );

            if (!href) {
              return (
                <li
                  key={item.id}
                  className="surface overflow-hidden rounded-[24px] opacity-80"
                >
                  {card}
                </li>
              );
            }

            return (
              <li key={item.id}>
                {external ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="surface block overflow-hidden rounded-[24px] transition hover:-translate-y-0.5"
                  >
                    {card}
                  </a>
                ) : (
                  <Link
                    href={href}
                    className="surface block overflow-hidden rounded-[24px] transition hover:-translate-y-0.5"
                  >
                    {card}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--muted)]">
          合集暂无文章，请在后台刷新合集
        </p>
      )}
    </div>
  );
}

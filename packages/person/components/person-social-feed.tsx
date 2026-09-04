import Link from "next/link";
import { PaginationBar } from "@/components/pagination-bar";
import {
  PERSON_SOCIAL_KIND_LABEL,
  PERSON_SOCIAL_PLATFORM_LABEL,
  type PersonSocialContentKind,
  type PersonSocialPlatform,
} from "@andyyyds/person/lib/person-social";

export type PersonSocialAlbumCard = {
  id: string;
  platform: string;
  title: string;
  coverUrl: string;
  itemCount: number;
};

export type PersonSocialCard = {
  id: string;
  platform: string;
  title: string;
  digest: string;
  coverUrl: string;
  sourceUrl: string;
  publishedAt: Date | null;
  isPinned?: boolean;
  isFeatured?: boolean;
  contentKind?: string;
};

export type PersonSocialPagination = {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
};

const PLATFORM_BADGE: Record<string, string> = {
  BILIBILI: "bg-sky-100 text-sky-800",
  DOUYIN: "bg-zinc-800 text-white",
  XIAOHONGSHU: "bg-[#ff2442] text-white",
  WECHAT_CHANNELS: "bg-emerald-700 text-white",
};

/** 个人介绍页：合集 + 同步自 B站 / 抖音 / 小红书 / 视频号的投稿网格 */
export function PersonSocialFeed({
  albums,
  posts,
  pagination,
}: {
  albums?: PersonSocialAlbumCard[];
  posts: PersonSocialCard[];
  pagination?: PersonSocialPagination | null;
}) {
  const albumList = albums || [];
  if (
    !albumList.length &&
    !posts.length &&
    !(pagination && pagination.totalCount > 0)
  ) {
    return null;
  }
  const paging = pagination;

  return (
    <div className="mt-10 space-y-10 border-t border-[var(--line)] pt-10 sm:mt-12 sm:space-y-12 sm:pt-12">
      {albumList.length ? (
        <section id="albums">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold sm:text-3xl">合集</h2>
            <p className="mt-1 text-base text-[var(--muted)]">
              同步自 B站、抖音、小红书、视频号
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {albumList.map((album) => (
              <Link
                key={album.id}
                href={`/about/person/albums/${album.id}`}
                className="surface overflow-hidden rounded-[20px] transition touch-manipulation hover:-translate-y-0.5 active:-translate-y-0.5"
              >
                {album.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={album.coverUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="aspect-[16/10] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center bg-[var(--bg-deep)] text-sm text-[var(--muted)]">
                    合集
                  </div>
                )}
                <div className="p-3 sm:p-3.5">
                  <div className="line-clamp-2 text-base font-medium leading-snug sm:text-lg">
                    {album.title || "未命名合集"}
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    {PERSON_SOCIAL_PLATFORM_LABEL[
                      album.platform as PersonSocialPlatform
                    ] || album.platform}{" "}
                    · {album.itemCount} 条
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {posts.length || (paging && paging.totalCount > 0) ? (
      <section id="posts" className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold sm:text-3xl">最新投稿</h2>
        <p className="mt-1 text-base text-[var(--muted)]">
          同步自 B站、抖音、小红书、视频号
          {paging && paging.totalCount > 0 ? ` · 共 ${paging.totalCount} 条` : ""}
        </p>
      </div>
      {posts.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {posts.map((post) => {
            const platform = post.platform as PersonSocialPlatform;
            const kind = post.contentKind as PersonSocialContentKind;
            return (
              <a
                key={post.id}
                href={post.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="surface overflow-hidden rounded-[20px] transition touch-manipulation hover:-translate-y-0.5 active:-translate-y-0.5"
              >
                <div className="relative aspect-[16/10] w-full bg-[var(--bg-deep)]">
                  {post.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.coverUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-[var(--muted)]">
                      {PERSON_SOCIAL_PLATFORM_LABEL[platform] || "投稿"}
                    </div>
                  )}
                  <span
                    className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs ${
                      PLATFORM_BADGE[post.platform] || "bg-slate-700/90 text-white"
                    }`}
                  >
                    {PERSON_SOCIAL_PLATFORM_LABEL[platform] || post.platform}
                  </span>
                </div>
                <div className="p-3 sm:p-3.5">
                  <div className="flex flex-wrap items-start gap-1.5">
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {PERSON_SOCIAL_KIND_LABEL[kind] || "投稿"}
                    </span>
                    {post.isPinned ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        置顶
                      </span>
                    ) : null}
                    {post.isFeatured ? (
                      <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">
                        精华
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1.5 line-clamp-2 text-base font-medium leading-snug sm:text-lg">
                    {post.title || "无标题"}
                  </div>
                  {post.publishedAt ? (
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      {post.publishedAt.toLocaleDateString("zh-CN")}
                    </div>
                  ) : null}
                </div>
              </a>
            );
          })}
        </div>
      ) : null}
      {paging ? (
        <PaginationBar
          page={paging.page}
          totalPages={paging.totalPages}
          hrefForPage={(p) => `/about/person?page=${p}#posts`}
        />
      ) : null}
    </section>
      ) : null}
    </div>
  );
}

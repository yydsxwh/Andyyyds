import { PaginationBar } from "@/components/pagination-bar";
import {
  PERSON_SOCIAL_KIND_LABEL,
  PERSON_SOCIAL_PLATFORM_LABEL,
  type PersonSocialContentKind,
  type PersonSocialPlatform,
} from "@andyyyds/person/lib/person-social";

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
};

/** 个人介绍页：同步自 B站 / 抖音 / 小红书的投稿网格 */
export function PersonSocialFeed({
  posts,
  pagination,
}: {
  posts: PersonSocialCard[];
  pagination?: PersonSocialPagination | null;
}) {
  if (!posts.length && !(pagination && pagination.totalCount > 0)) return null;
  const paging = pagination;

  return (
    <section id="posts" className="mt-10 space-y-4 border-t border-[var(--line)] pt-10 sm:mt-12 sm:pt-12">
      <div>
        <h2 className="text-2xl font-semibold sm:text-3xl">最新投稿</h2>
        <p className="mt-1 text-base text-[var(--muted)]">
          同步自 B站、抖音、小红书
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
                className="surface overflow-hidden rounded-[20px] transition hover:-translate-y-0.5"
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
  );
}

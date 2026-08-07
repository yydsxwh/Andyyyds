import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLocalArticleById } from "@/lib/wechat-mp-content";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const article = await getLocalArticleById(id);
  if (!article) return { title: "图文" };
  return {
    title: article.title || "图文",
    description: article.digest || undefined,
  };
}

export default async function CompanyArticlePage({ params }: Props) {
  const { id } = await params;
  const article = await getLocalArticleById(id);
  if (!article) notFound();

  return (
    <div className="container py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/about/company"
          className="text-sm text-[var(--brand)] hover:underline"
        >
          ← 返回公司介绍
        </Link>

        <article className="mt-4 space-y-4">
          <header className="space-y-3">
            <h1 className="text-2xl font-semibold leading-snug sm:text-3xl">
              {article.title || "无标题"}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--muted)]">
              {article.author ? <span>{article.author}</span> : null}
              {article.publishedAt ? (
                <span>
                  {article.publishedAt.toLocaleDateString("zh-CN")}
                </span>
              ) : null}
            </div>
            {article.wechatUrl ? (
              <a
                href={article.wechatUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary inline-flex min-h-11 px-4 text-sm"
              >
                查看微信原文
              </a>
            ) : null}
          </header>

          {article.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.thumbUrl}
              alt=""
              className="w-full rounded-[24px] object-cover"
            />
          ) : null}

          {article.contentHtml ? (
            <div
              className="mp-article prose-page text-[15px] leading-7 text-[var(--ink)] sm:text-base [&_img]:mx-auto [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-xl [&_p]:my-3 [&_section]:my-2"
              dangerouslySetInnerHTML={{ __html: article.contentHtml }}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              正文暂未同步到本站
              {article.wechatUrl ? "，请打开微信原文阅读。" : "。"}
            </p>
          )}
        </article>
      </div>
    </div>
  );
}

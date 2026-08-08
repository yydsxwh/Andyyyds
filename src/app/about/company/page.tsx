import type { Metadata } from "next";
import { AboutPageView } from "@/components/about-page";
import { CompanyPromoSections } from "@/components/company-promo-sections";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { prisma } from "@/lib/db";
import { getPortalConfig } from "@/lib/site-settings";
import { wechatMpArticleOrderBy } from "@/lib/wechat-mp-content";

export const dynamic = "force-dynamic";

/** 公司介绍「最新图文」每页条数（宽屏约 6 列 × 4 行，比原先多两行） */
const ARTICLES_PAGE_SIZE = 24;

export async function generateMetadata(): Promise<Metadata> {
  const portal = await getPortalConfig();
  return {
    title: portal.company.title,
    description: portal.company.subtitle,
  };
}

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function CompanyAboutPage({ searchParams }: Props) {
  const params = await searchParams;
  const requested = Number.parseInt(String(params.page || "1"), 10);
  const pageRaw = Number.isFinite(requested) && requested > 0 ? requested : 1;

  const [portal, albums, articleTotal] = await Promise.all([
    getPortalConfig(),
    prisma.wechatMpAlbum.findMany({
      orderBy: { syncedAt: "desc" },
      include: { _count: { select: { items: true } } },
    }),
    prisma.wechatMpArticle.count({ where: { isDeleted: false } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(articleTotal / ARTICLES_PAGE_SIZE));
  const page = Math.min(pageRaw, totalPages);
  const skip = (page - 1) * ARTICLES_PAGE_SIZE;

  const articles = await prisma.wechatMpArticle.findMany({
    where: { isDeleted: false },
    // 与后台一致：置顶 → 手动排序 → 发布时间
    orderBy: wechatMpArticleOrderBy,
    skip,
    take: ARTICLES_PAGE_SIZE,
  });

  return (
    <NavPageTemplateShell type="company">
      <div className="container py-8 sm:py-10">
        <AboutPageView page={portal.company} embedded />
        <CompanyPromoSections
          albums={albums.map((a) => ({
            id: a.id,
            title: a.title,
            coverUrl: a.coverUrl,
            itemCount: a._count.items,
          }))}
          articles={articles.map((a) => ({
            id: a.id,
            title: a.title,
            digest: a.digest,
            thumbUrl: a.thumbUrl,
            publishedAt: a.publishedAt,
            isPinned: a.isPinned,
            isFeatured: a.isFeatured,
            contentKind: a.contentKind || "news",
          }))}
          articlePagination={{
            page,
            totalPages,
            totalCount: articleTotal,
            pageSize: ARTICLES_PAGE_SIZE,
          }}
        />
      </div>
    </NavPageTemplateShell>
  );
}

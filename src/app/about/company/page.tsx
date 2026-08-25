import type { Metadata } from "next";
import { AboutPageView } from "@/components/about-page";
import { CompanyPromoSections } from "@/components/company-promo-sections";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { prisma } from "@/lib/db";
import { resolveContentText } from "@/lib/i18n/content-resolve";
import { getRequestLocaleContext } from "@/lib/i18n/get-request-locale";
import type { PortalAboutPage } from "@/lib/portal";
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

async function localizeAboutPage(
  page: PortalAboutPage,
  prefix: "company" | "person",
  contentLocale: Awaited<
    ReturnType<typeof getRequestLocaleContext>
  >["contentLocale"],
  bilingual: boolean,
): Promise<PortalAboutPage> {
  const [title, subtitle, body] = await Promise.all([
    resolveContentText({
      entityType: "portal",
      entityId: "default",
      field: `${prefix}.title`,
      source: page.title,
      locale: contentLocale,
    }),
    resolveContentText({
      entityType: "portal",
      entityId: "default",
      field: `${prefix}.subtitle`,
      source: page.subtitle,
      locale: contentLocale,
    }),
    resolveContentText({
      entityType: "portal",
      entityId: "default",
      field: `${prefix}.body`,
      source: page.body,
      locale: contentLocale,
    }),
  ]);
  const highlights = await Promise.all(
    page.highlights.map(async (h, i) => {
      const [label, text] = await Promise.all([
        resolveContentText({
          entityType: "portal",
          entityId: "default",
          field: `${prefix}.highlights.${i}.label`,
          source: h.label,
          locale: contentLocale,
        }),
        resolveContentText({
          entityType: "portal",
          entityId: "default",
          field: `${prefix}.highlights.${i}.text`,
          source: h.text,
          locale: contentLocale,
        }),
      ]);
      return {
        label: bilingual ? label.source : label.text,
        text: bilingual ? text.source : text.text,
      };
    }),
  );
  return {
    ...page,
    title: bilingual ? title.source : title.text,
    subtitle: bilingual ? subtitle.source : subtitle.text,
    body: bilingual ? body.source : body.text,
    highlights,
  };
}

export default async function CompanyAboutPage({ searchParams }: Props) {
  const params = await searchParams;
  const requested = Number.parseInt(String(params.page || "1"), 10);
  const pageRaw = Number.isFinite(requested) && requested > 0 ? requested : 1;

  const [portal, albums, articleTotal, localeCtx] = await Promise.all([
    getPortalConfig(),
    prisma.wechatMpAlbum.findMany({
      orderBy: { syncedAt: "desc" },
      include: { _count: { select: { items: true } } },
    }),
    prisma.wechatMpArticle.count({ where: { isDeleted: false } }),
    getRequestLocaleContext(),
  ]);

  const company = await localizeAboutPage(
    portal.company,
    "company",
    localeCtx.contentLocale,
    localeCtx.bilingual,
  );

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
        <AboutPageView page={company} embedded />
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

import type { Metadata } from "next";
import { AboutPageView } from "@andyyyds/person/components/about-page";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { resolveContentText } from "@andyyyds/shared/i18n/content-resolve";
import { getRequestLocaleContext } from "@andyyyds/shared/i18n/get-request-locale";
import { PersonSocialFeed } from "@andyyyds/person/components/person-social-feed";
import { PERSON_SOCIAL_POST_ORDER_BY } from "@andyyyds/person/lib/person-social";
import { prisma } from "@andyyyds/shared/db";
import type { PortalAboutPage } from "@andyyyds/shared/portal";
import { getPortalConfig } from "@andyyyds/shared/site-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const portal = await getPortalConfig();
  return {
    title: portal.person.title,
    description: portal.person.subtitle,
  };
}

async function localizeAboutPage(
  page: PortalAboutPage,
  contentLocale: Awaited<
    ReturnType<typeof getRequestLocaleContext>
  >["contentLocale"],
  bilingual: boolean,
): Promise<PortalAboutPage> {
  const [title, subtitle, body] = await Promise.all([
    resolveContentText({
      entityType: "portal",
      entityId: "default",
      field: "person.title",
      source: page.title,
      locale: contentLocale,
    }),
    resolveContentText({
      entityType: "portal",
      entityId: "default",
      field: "person.subtitle",
      source: page.subtitle,
      locale: contentLocale,
    }),
    resolveContentText({
      entityType: "portal",
      entityId: "default",
      field: "person.body",
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
          field: `person.highlights.${i}.label`,
          source: h.label,
          locale: contentLocale,
        }),
        resolveContentText({
          entityType: "portal",
          entityId: "default",
          field: `person.highlights.${i}.text`,
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

const POSTS_PAGE_SIZE = 24;

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function PersonAboutPage({ searchParams }: Props) {
  const params = await searchParams;
  const requested = Number.parseInt(String(params.page || "1"), 10);
  const pageRaw = Number.isFinite(requested) && requested > 0 ? requested : 1;

  const [portal, localeCtx, postTotal] = await Promise.all([
    getPortalConfig(),
    getRequestLocaleContext(),
    prisma.personSocialPost.count({ where: { isDeleted: false } }),
  ]);
  const person = await localizeAboutPage(
    portal.person,
    localeCtx.contentLocale,
    localeCtx.bilingual,
  );

  const totalPages = Math.max(1, Math.ceil(postTotal / POSTS_PAGE_SIZE));
  const page = Math.min(pageRaw, totalPages);
  const posts = await prisma.personSocialPost.findMany({
    where: { isDeleted: false },
    orderBy: PERSON_SOCIAL_POST_ORDER_BY,
    skip: (page - 1) * POSTS_PAGE_SIZE,
    take: POSTS_PAGE_SIZE,
  });

  return (
    <NavPageTemplateShell type="person">
      <div className="container py-8 sm:py-10">
        <AboutPageView page={person} embedded />
        <PersonSocialFeed
          posts={posts.map((row) => ({
            id: row.id,
            platform: row.platform,
            title: row.title,
            digest: row.digest,
            coverUrl: row.coverUrl,
            sourceUrl: row.sourceUrl,
            publishedAt: row.publishedAt,
            isPinned: row.isPinned,
            isFeatured: row.isFeatured,
            contentKind: row.contentKind,
          }))}
          pagination={{
            page,
            totalPages,
            totalCount: postTotal,
            pageSize: POSTS_PAGE_SIZE,
          }}
        />
      </div>
    </NavPageTemplateShell>
  );
}

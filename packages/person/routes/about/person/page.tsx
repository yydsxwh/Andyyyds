import { PersonSiteChrome } from "@andyyyds/person/components/person-site-chrome";
import { PersonSiteHome } from "@andyyyds/person/components/person-site-home";
import { listPersonSocialAlbums } from "@andyyyds/person/lib/person-social-album";
import { PERSON_SOCIAL_POST_ORDER_BY } from "@andyyyds/person/lib/person-social";
import { getPersonSocialAccounts } from "@andyyyds/person/lib/person-social-settings";
import { loadPersonSitePublic } from "@andyyyds/person/lib/person-site-store";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";
import { prisma } from "@andyyyds/shared/db";

const POSTS_PAGE_SIZE = 24;

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function PersonAboutPage({ searchParams }: Props) {
  const params = await searchParams;
  const requested = Number.parseInt(String(params.page || "1"), 10);
  const pageRaw = Number.isFinite(requested) && requested > 0 ? requested : 1;

  const [site, session, socialAccounts, postTotal, albums] = await Promise.all([
    loadPersonSitePublic(),
    getSession(),
    getPersonSocialAccounts(),
    prisma.personSocialPost.count({ where: { isDeleted: false } }),
    listPersonSocialAlbums(),
  ]);

  const totalPages = Math.max(1, Math.ceil(postTotal / POSTS_PAGE_SIZE));
  const page = Math.min(pageRaw, totalPages);
  const posts = await prisma.personSocialPost.findMany({
    where: { isDeleted: false },
    orderBy: PERSON_SOCIAL_POST_ORDER_BY,
    skip: (page - 1) * POSTS_PAGE_SIZE,
    take: POSTS_PAGE_SIZE,
  });

  return (
    <PersonSiteChrome profile={site.profile} showAdmin={Boolean(session && isAdmin(session))}>
      <PersonSiteHome
        profile={site.profile}
        socialAccounts={socialAccounts}
        featured={site.featured}
        projects={site.projects}
        blogs={site.blogs}
        portfolio={site.portfolio}
        honors={site.honors}
        grades={site.grades}
        practices={site.practices}
        activities={site.activities}
        interests={site.interests}
        photos={site.photos}
        albums={albums.map((row) => ({
          id: row.id,
          platform: row.platform,
          title: row.title,
          coverUrl: row.coverUrl,
          itemCount: row._count.items,
        }))}
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
    </PersonSiteChrome>
  );
}

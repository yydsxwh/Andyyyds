import { notFound } from "next/navigation";
import { PersonSiteArticle } from "@andyyyds/person/components/person-site-article";
import { PersonSiteChrome } from "@andyyyds/person/components/person-site-chrome";
import { getPersonEntry, getPersonProfile } from "@andyyyds/person/lib/person-site-store";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";

export default async function PersonBlogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [profile, entry, session] = await Promise.all([
    getPersonProfile(),
    getPersonEntry(id, true),
    getSession(),
  ]);
  if (!entry || entry.kind !== "BLOG") notFound();
  return (
    <PersonSiteChrome profile={profile} showAdmin={Boolean(session && isAdmin(session))}>
      <PersonSiteArticle entry={entry} backHref="/about/person/blog" backLabel="全部随笔" />
    </PersonSiteChrome>
  );
}

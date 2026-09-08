import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PersonSiteArticle } from "@andyyyds/person/components/person-site-article";
import { PersonSiteChrome } from "@andyyyds/person/components/person-site-chrome";
import { PERSON_ENTRY_KIND_LABEL, personEntrySectionHref } from "@andyyyds/person/lib/person-site";
import { getPersonEntry, getPersonProfile } from "@andyyyds/person/lib/person-site-store";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const entry = await getPersonEntry(id, true);
  return { title: entry?.title || "个人展示" };
}

export default async function PersonEntryDetailPage({ params }: Props) {
  const { id } = await params;
  const [profile, entry, session] = await Promise.all([
    getPersonProfile(),
    getPersonEntry(id, true),
    getSession(),
  ]);
  if (!entry) notFound();
  return (
    <PersonSiteChrome profile={profile} showAdmin={Boolean(session && isAdmin(session))}>
      <PersonSiteArticle
        entry={entry}
        backHref={personEntrySectionHref(entry.kind)}
        backLabel={PERSON_ENTRY_KIND_LABEL[entry.kind]}
      />
    </PersonSiteChrome>
  );
}

import { PersonSiteChrome } from "@andyyyds/person/components/person-site-chrome";
import { PersonSiteSectionPage } from "@andyyyds/person/components/person-site-section-page";
import { getPersonProfile, listPersonEntries } from "@andyyyds/person/lib/person-site-store";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";

export default async function PersonProjectsPage() {
  const [profile, entries, session] = await Promise.all([
    getPersonProfile(),
    listPersonEntries({ kind: "PROJECT", publishedOnly: true }),
    getSession(),
  ]);
  return (
    <PersonSiteChrome profile={profile} showAdmin={Boolean(session && isAdmin(session))}>
      <PersonSiteSectionPage
        title="项目经历"
        intro="做过的产品、课题与交付，按时间与职责整理。"
        entries={entries}
      />
    </PersonSiteChrome>
  );
}

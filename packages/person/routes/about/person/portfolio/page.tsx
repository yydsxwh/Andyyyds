import { PersonSiteChrome } from "@andyyyds/person/components/person-site-chrome";
import { PersonSiteSectionPage } from "@andyyyds/person/components/person-site-section-page";
import { getPersonProfile, listPersonEntries } from "@andyyyds/person/lib/person-site-store";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";

export default async function PersonPortfolioPage() {
  const [profile, entries, session] = await Promise.all([
    getPersonProfile(),
    listPersonEntries({ kind: "PORTFOLIO", publishedOnly: true }),
    getSession(),
  ]);
  return (
    <PersonSiteChrome profile={profile} showAdmin={Boolean(session && isAdmin(session))}>
      <PersonSiteSectionPage
        title="作品集"
        intro="可展示的作品、设计与成果，一张图说明一件事。"
        entries={entries}
      />
    </PersonSiteChrome>
  );
}

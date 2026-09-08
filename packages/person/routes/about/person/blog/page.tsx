import { PersonSiteChrome } from "@andyyyds/person/components/person-site-chrome";
import { PersonSiteSectionPage } from "@andyyyds/person/components/person-site-section-page";
import { getPersonProfile, listPersonEntries } from "@andyyyds/person/lib/person-site-store";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";

export default async function PersonBlogPage() {
  const [profile, entries, session] = await Promise.all([
    getPersonProfile(),
    listPersonEntries({ kind: "BLOG", publishedOnly: true }),
    getSession(),
  ]);
  return (
    <PersonSiteChrome profile={profile} showAdmin={Boolean(session && isAdmin(session))}>
      <PersonSiteSectionPage
        title="博客 / 技术随笔"
        intro="把做过的事和方法写清楚，方便以后自己也回来看。"
        entries={entries}
      />
    </PersonSiteChrome>
  );
}

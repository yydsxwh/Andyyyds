import { PersonSiteChrome } from "@andyyyds/person/components/person-site-chrome";
import { PersonSiteSectionPage } from "@andyyyds/person/components/person-site-section-page";
import { getPersonProfile, listPersonEntries } from "@andyyyds/person/lib/person-site-store";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";

export default async function PersonLifePage() {
  const [profile, practices, activities, interests, session] = await Promise.all([
    getPersonProfile(),
    listPersonEntries({ kind: "PRACTICE", publishedOnly: true }),
    listPersonEntries({ kind: "ACTIVITY", publishedOnly: true }),
    listPersonEntries({ kind: "INTEREST", publishedOnly: true }),
    getSession(),
  ]);
  return (
    <PersonSiteChrome profile={profile} showAdmin={Boolean(session && isAdmin(session))}>
      <PersonSiteSectionPage
        title="社会实践、课外活动与兴趣"
        intro="课堂之外做过的事，以及长期感兴趣的方向。"
        entries={[...practices, ...activities, ...interests]}
        kinds={["PRACTICE", "ACTIVITY", "INTEREST"]}
      />
    </PersonSiteChrome>
  );
}

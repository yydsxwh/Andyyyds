import { PersonSiteChrome } from "@andyyyds/person/components/person-site-chrome";
import { PersonSiteSectionPage } from "@andyyyds/person/components/person-site-section-page";
import { getPersonProfile, listPersonEntries } from "@andyyyds/person/lib/person-site-store";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";

export default async function PersonHonorsPage() {
  const [profile, honors, grades, session] = await Promise.all([
    getPersonProfile(),
    listPersonEntries({ kind: "HONOR", publishedOnly: true }),
    listPersonEntries({ kind: "GRADE", publishedOnly: true }),
    getSession(),
  ]);
  return (
    <PersonSiteChrome profile={profile} showAdmin={Boolean(session && isAdmin(session))}>
      <PersonSiteSectionPage
        title="成绩与获奖荣誉"
        intro="成绩、证书、竞赛与公开认可，按条目列出。"
        entries={[...honors, ...grades]}
        kinds={["HONOR", "GRADE"]}
      />
    </PersonSiteChrome>
  );
}

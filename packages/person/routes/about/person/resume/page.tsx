import { PersonSiteChrome } from "@andyyyds/person/components/person-site-chrome";
import { PersonSiteSectionPage } from "@andyyyds/person/components/person-site-section-page";
import { PersonFileGallery } from "@andyyyds/person/components/person-file-gallery";
import { getPersonProfile, listPersonEntries } from "@andyyyds/person/lib/person-site-store";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";

export default async function PersonResumePage() {
  const [profile, entries, session] = await Promise.all([
    getPersonProfile(),
    listPersonEntries({ kind: "RESUME", publishedOnly: true }),
    getSession(),
  ]);
  return (
    <PersonSiteChrome profile={profile} showAdmin={Boolean(session && isAdmin(session))}>
      <PersonSiteSectionPage
        title="简历"
        intro="简历文档、作品附件都可以在这里预览或下载，格式不限。"
        entries={entries}
      />
      {entries.map((entry) =>
        entry.files.length ? (
          <div key={entry.id} className="mt-8">
            <h2 className="person-section-title">{entry.title}</h2>
            <PersonFileGallery entryId={entry.id} files={entry.files} />
          </div>
        ) : null,
      )}
    </PersonSiteChrome>
  );
}

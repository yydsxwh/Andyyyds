import { PersonSiteChrome } from "@andyyyds/person/components/person-site-chrome";
import { PersonSiteSectionPage } from "@andyyyds/person/components/person-site-section-page";
import { PersonFileGallery } from "@andyyyds/person/components/person-file-gallery";
import { getPersonProfile, listPersonEntries } from "@andyyyds/person/lib/person-site-store";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";

export default async function PersonIntroPage() {
  const [profile, entries, session] = await Promise.all([
    getPersonProfile(),
    listPersonEntries({ kind: "INTRO_VIDEO", publishedOnly: true }),
    getSession(),
  ]);
  return (
    <PersonSiteChrome profile={profile} showAdmin={Boolean(session && isAdmin(session))}>
      <PersonSiteSectionPage
        title="视频自我介绍"
        intro="可以直接播放。也可以附上字幕、讲稿或其他文件。"
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

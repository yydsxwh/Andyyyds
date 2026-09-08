import { PERSON_ENTRY_KIND_LABEL, type PersonEntryKind, type PersonEntryPayload } from "@andyyyds/person/lib/person-site";
import { PersonEmpty, PersonEntryCard } from "@andyyyds/person/components/person-entry-card";

export function PersonSiteSectionPage({
  title,
  intro,
  entries,
  kinds,
}: {
  title: string;
  intro: string;
  entries: PersonEntryPayload[];
  kinds?: PersonEntryKind[];
}) {
  return (
    <div>
      <p className="person-kicker !text-[var(--ps-gold)]">Personal site</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-[var(--ps-muted)] leading-7">{intro}</p>
      {entries.length ? (
        <div className="person-grid person-grid-2 mt-8">
          {entries.map((entry) => (
            <PersonEntryCard
              key={entry.id}
              entry={entry}
              showKind={kinds && kinds.length > 1 ? PERSON_ENTRY_KIND_LABEL[entry.kind] : undefined}
            />
          ))}
        </div>
      ) : (
        <PersonEmpty>这一栏还没有内容。</PersonEmpty>
      )}
    </div>
  );
}

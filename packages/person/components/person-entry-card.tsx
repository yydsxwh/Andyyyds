import Link from "next/link";
import { personEntryHref, type PersonEntryPayload } from "@andyyyds/person/lib/person-site";

export function PersonEntryCard({
  entry,
  showKind,
}: {
  entry: PersonEntryPayload;
  showKind?: string;
}) {
  const href = personEntryHref(entry);
  const media = entry.coverUrl || entry.images[0];
  return (
    <Link href={href} className="person-card person-tile">
      {media ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media} alt="" />
      ) : (
        <div className="h-16 bg-[var(--ps-gold-soft)]" />
      )}
      <div className="person-tile-body">
        {showKind || entry.period || entry.org ? (
          <p className="person-meta">
            {[showKind, entry.period, entry.org].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        <h3 className="text-lg font-semibold leading-7">{entry.title}</h3>
        {entry.summary ? (
          <p className="text-sm leading-6 text-[var(--ps-muted)]">{entry.summary}</p>
        ) : null}
        {entry.role ? (
          <p className="mt-auto text-xs text-[var(--ps-muted)]">{entry.role}</p>
        ) : null}
        {entry.files?.length ? (
          <p className="text-xs text-[var(--ps-muted)]">{entry.files.length} 个附件，点开可预览或下载</p>
        ) : null}
      </div>
    </Link>
  );
}

export function PersonEmpty({ children }: { children: React.ReactNode }) {
  return <p className="person-empty">{children}</p>;
}

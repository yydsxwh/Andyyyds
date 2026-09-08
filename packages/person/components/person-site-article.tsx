import Link from "next/link";
import { splitPersonAbout, type PersonEntryPayload } from "@andyyyds/person/lib/person-site";

export function PersonSiteArticle({
  entry,
  backHref,
  backLabel,
}: {
  entry: PersonEntryPayload;
  backHref: string;
  backLabel: string;
}) {
  const paragraphs = splitPersonAbout(entry.body || entry.summary);
  return (
    <article className="mx-auto max-w-3xl">
      <Link href={backHref} className="inline-flex min-h-11 items-center text-sm text-[var(--ps-gold)]">
        ← {backLabel}
      </Link>
      <p className="person-meta mt-5">
        {[entry.period, entry.org, entry.role, entry.location].filter(Boolean).join(" · ")}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{entry.title}</h1>
      {entry.summary ? (
        <p className="mt-3 text-lg leading-8 text-[var(--ps-muted)]">{entry.summary}</p>
      ) : null}
      {entry.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.coverUrl} alt="" className="person-card mt-6 w-full object-cover" />
      ) : null}
      <div className="person-card person-prose mt-6 p-5 sm:p-7">
        {paragraphs.length ? paragraphs.map((para) => <p key={para.slice(0, 24)}>{para}</p>) : <p>暂无正文。</p>}
      </div>
      {entry.images.length ? (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {entry.images.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="person-card w-full object-cover" />
          ))}
        </div>
      ) : null}
      {entry.link ? (
        <a
          href={entry.link}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary mt-6 inline-flex min-h-11 px-4"
        >
          打开相关链接
        </a>
      ) : null}
    </article>
  );
}

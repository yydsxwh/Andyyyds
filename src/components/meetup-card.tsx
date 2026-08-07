import Link from "next/link";
import {
  formatMeetupWhen,
  meetupCategoryLabel,
  meetupStatusLabel,
} from "@/lib/meetup";

export type MeetupCardData = {
  id: string;
  title: string;
  category: string;
  startsAt: string | Date;
  place: string;
  maxPeople: number;
  coverUrl?: string;
  status: string;
  joinCount: number;
  host: { name: string };
};

export function MeetupCard({ meetup }: { meetup: MeetupCardData }) {
  const startsAt =
    typeof meetup.startsAt === "string"
      ? new Date(meetup.startsAt)
      : meetup.startsAt;
  const spotsLeft = Math.max(meetup.maxPeople - meetup.joinCount, 0);

  return (
    <Link
      href={`/meetup/${meetup.id}`}
      className="surface group block overflow-hidden rounded-[28px] transition hover:-translate-y-0.5"
    >
      {meetup.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meetup.coverUrl}
          alt=""
          className="aspect-[16/9] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[16/9] items-end bg-gradient-to-br from-[var(--brand)]/15 via-[var(--fire)]/10 to-transparent px-5 pb-4">
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-[var(--brand)]">
            {meetupCategoryLabel(meetup.category)}
          </span>
        </div>
      )}
      <div className="space-y-2 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {meetup.coverUrl ? (
            <span className="rounded-full bg-[var(--brand)]/10 px-2.5 py-0.5 text-xs text-[var(--brand)]">
              {meetupCategoryLabel(meetup.category)}
            </span>
          ) : null}
          <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-xs text-[var(--muted)]">
            {meetupStatusLabel(meetup.status)}
          </span>
        </div>
        <h3 className="text-lg font-semibold leading-snug group-hover:text-[var(--brand)]">
          {meetup.title}
        </h3>
        <p className="text-sm text-[var(--muted)]">{formatMeetupWhen(startsAt)}</p>
        <p className="truncate text-sm text-[var(--ink)]">{meetup.place}</p>
        <div className="flex items-center justify-between gap-3 pt-1 text-sm text-[var(--muted)]">
          <span>发起人 {meetup.host.name}</span>
          <span>
            {meetup.joinCount}/{meetup.maxPeople}
            {spotsLeft > 0 && meetup.status === "OPEN" ? ` · 余 ${spotsLeft}` : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}

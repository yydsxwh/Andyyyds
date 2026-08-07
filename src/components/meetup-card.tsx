import Link from "next/link";
import {
  formatMeetupWhen,
  meetupCategoryLabel,
  meetupStatusLabel,
} from "@/lib/meetup";
import { formatPrice } from "@/lib/utils";

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
  /** 报名费（分）；0 或未传视为免费 */
  priceCents?: number;
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
        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="text-sm font-semibold text-emerald-600">
            {(meetup.priceCents || 0) > 0
              ? formatPrice(meetup.priceCents || 0)
              : "免费"}
          </span>
          <span className="text-sm text-[var(--muted)]">
            {meetup.joinCount}/{meetup.maxPeople}人
            {spotsLeft > 0 && meetup.status === "OPEN" ? ` · 余${spotsLeft}` : ""}
          </span>
        </div>
        <p className="pt-1 text-xs text-[var(--muted)]">
          发起人 {meetup.host.name}
        </p>
      </div>
    </Link>
  );
}

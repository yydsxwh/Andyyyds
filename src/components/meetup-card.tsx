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
  /** IANA；缺省按北京时间展示 */
  timezone?: string | null;
  place: string;
  maxPeople: number;
  coverUrl?: string;
  status: string;
  joinCount: number;
  host: { name: string };
  /** 发起人 userId；用于列表侧判断「自己的局」是否可编辑 */
  hostId?: string;
  /** 报名费（分）；0 或未传视为免费 */
  priceCents?: number;
};

type Props = {
  meetup: MeetupCardData;
  /**
   * 是否显示「编辑」：站长可改任意局，发起人仅改自己的。
   * 由列表页按 session + canManageMeetups / hostId 算好再传入，避免卡片内再拉权限。
   */
  canEdit?: boolean;
};

export function MeetupCard({ meetup, canEdit = false }: Props) {
  const startsAt =
    typeof meetup.startsAt === "string"
      ? new Date(meetup.startsAt)
      : meetup.startsAt;
  const spotsLeft = Math.max(meetup.maxPeople - meetup.joinCount, 0);
  const editHref = `/meetup/${meetup.id}/edit`;

  return (
    // 卡片主体与「编辑」拆开：避免整卡 <a> 内再套编辑链接（非法嵌套且微信内难点）
    <article className="surface group overflow-hidden rounded-[28px] transition hover:-translate-y-0.5">
      <Link href={`/meetup/${meetup.id}`} className="block">
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
        <div className="space-y-2 p-5 pb-0">
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
          <p className="text-sm text-[var(--muted)]">
            {formatMeetupWhen(startsAt, meetup.timezone || undefined)}
          </p>
          <p className="truncate text-sm text-[var(--ink)]">{meetup.place}</p>
          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="text-sm font-semibold text-emerald-600">
              {(meetup.priceCents || 0) > 0
                ? formatPrice(meetup.priceCents || 0)
                : "免费"}
            </span>
            <span className="text-sm text-[var(--muted)]">
              {meetup.joinCount}/{meetup.maxPeople}人
              {spotsLeft > 0 && meetup.status === "OPEN"
                ? ` · 余${spotsLeft}`
                : ""}
            </span>
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between gap-3 px-5 pb-5 pt-2">
        <Link
          href={`/meetup/${meetup.id}`}
          className="min-w-0 flex-1 truncate text-xs text-[var(--muted)] touch-manipulation"
        >
          发起人 {meetup.host.name}
        </Link>
        {canEdit ? (
          <Link
            href={editHref}
            className="btn btn-secondary inline-flex min-h-11 shrink-0 touch-manipulation items-center px-3 py-2 text-xs"
          >
            编辑
          </Link>
        ) : null}
      </div>
    </article>
  );
}

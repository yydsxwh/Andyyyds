"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  formatMeetupWhen,
  meetupCategoryLabel,
  meetupStatusLabel,
} from "@/lib/meetup";
import { confirmAndDeleteMeetup } from "@/lib/meetup-delete-client";
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
   * 是否显示「编辑/删除」：站长可管任意局，发起人仅管自己的。
   * 由列表页按 session + canManageMeetups / hostId 算好再传入，避免卡片内再拉权限。
   */
  canEdit?: boolean;
};

export function MeetupCard({ meetup, canEdit = false }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const startsAt =
    typeof meetup.startsAt === "string"
      ? new Date(meetup.startsAt)
      : meetup.startsAt;
  const spotsLeft = Math.max(meetup.maxPeople - meetup.joinCount, 0);
  const editHref = `/meetup/${meetup.id}/edit`;

  async function onDelete() {
    setBusy(true);
    try {
      const result = await confirmAndDeleteMeetup({
        meetupId: meetup.id,
        title: meetup.title,
        via: "public",
      });
      if (result.ok) {
        router.refresh();
        return;
      }
      if (!result.cancelled && result.error) {
        window.alert(result.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    // 卡片主体与管理按钮拆开：避免整卡 <a> 内再套链接（非法嵌套且微信内难点）
    <article className="surface-soft tilt-card group overflow-hidden">
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
            <span className="chip chip-idle !min-h-0 px-3 py-1 text-xs font-medium !text-[var(--brand)]">
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

      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-5 pt-2">
        <Link
          href={`/meetup/${meetup.id}`}
          className="min-w-0 flex-1 truncate text-xs text-[var(--muted)] touch-manipulation"
        >
          发起人 {meetup.host.name}
        </Link>
        {canEdit ? (
          // 同组操作：共用 btn-compact，仅 secondary / danger 颜色语义区分，避免一描边一实心失衡
          <div className="flex shrink-0 items-center gap-2">
            <Link href={editHref} className="btn btn-secondary btn-compact">
              编辑
            </Link>
            <button
              type="button"
              className="btn btn-danger btn-compact"
              disabled={busy}
              onClick={() => void onDelete()}
            >
              {busy ? "删除中…" : "删除"}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

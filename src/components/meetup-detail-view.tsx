"use client";

/**
 * 约搭详情（一起玩类结构）：封面、标签、分档名额、安心卡片、怎么玩、图集、底栏上车。
 * 支付/优惠券/分销复用站内订单流；群聊无 IM 时改为联系外链。
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InviteSharePanel } from "@/components/invite-share-panel";
import { OrderFormFields } from "@/components/order-form-fields";
import { COUPON_QUERY_KEY, COUPON_STORAGE_KEY } from "@/lib/coupon-share";
import { normalizeCouponCode } from "@/lib/coupons";
import { REFERRAL_STORAGE_KEY } from "@/lib/invite";
import {
  canJoinMeetup,
  formatMeetupTimeRange,
  HOST_STATUS_ACTIONS,
  isMeetupPaid,
  meetupCategoryLabel,
  meetupStatusLabel,
  MEETUP_PRODUCT_TYPE,
} from "@/lib/meetup";
import { meetupSlotSpecLabel } from "@/lib/meetup-meta";
import {
  activeOrderFormFields,
  validateOrderFormAnswers,
  type OrderFormAnswers,
  type OrderFormConfig,
} from "@/lib/order-form";
import { formatPrice } from "@/lib/utils";

export type MeetupDetailJoin = {
  id: string;
  userId: string;
  slotId: string | null;
  user: { id: string; name: string; avatarUrl: string };
};

export type MeetupDetailSlot = {
  id: string;
  name: string;
  maxPeople: number;
  joinCount: number;
};

export type MeetupDetailData = {
  id: string;
  title: string;
  description: string;
  contentHtml: string;
  priceCents: number;
  category: string;
  startsAt: string;
  endsAt: string | null;
  /** IANA；展示用活动时区墙钟 */
  timezone?: string | null;
  place: string;
  maxPeople: number;
  coverUrl: string;
  tags: string[];
  feeIncludes: string;
  refundPolicy: string;
  autoRefund: boolean;
  gallery: string[];
  contactUrl: string;
  status: string;
  hostId: string;
  productCourseId: string | null;
  slots: MeetupDetailSlot[];
  host: { id: string; name: string; avatarUrl: string };
  joins: MeetupDetailJoin[];
};

type AvailableCoupon = {
  id: string;
  code: string;
  title: string;
  benefit: string;
  discountCents: number;
  minAmount: number;
};

type Props = {
  meetup: MeetupDetailData;
  currentUserId: string | null;
  inviteCode: string;
  orderForm: OrderFormConfig;
  /** 站长可在前台详情改状态/跳转后台编辑（微信内也可用） */
  canManageAsAdmin?: boolean;
};

function initials(name: string) {
  return (name || "?").slice(0, 1);
}

function Avatar({
  name,
  avatarUrl,
  size = 36,
}: {
  name: string;
  avatarUrl?: string;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="rounded-full object-cover ring-2 ring-white"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-[var(--brand)]/15 text-xs font-medium text-[var(--brand-strong)] ring-2 ring-white"
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  );
}

export function MeetupDetailView({
  meetup,
  currentUserId,
  inviteCode,
  orderForm,
  canManageAsAdmin = false,
}: Props) {
  const router = useRouter();
  const paid = isMeetupPaid(meetup.priceCents);
  const isHost = Boolean(currentUserId && currentUserId === meetup.hostId);
  const canManageStatus = isHost || canManageAsAdmin;
  const alreadyJoined = Boolean(
    currentUserId && meetup.joins.some((j) => j.userId === currentUserId),
  );
  const fields = activeOrderFormFields(orderForm);

  const displaySlots = useMemo(() => {
    if (meetup.slots.length > 0) return meetup.slots;
    return [
      {
        id: "",
        name: "报名",
        maxPeople: meetup.maxPeople,
        joinCount: meetup.joins.length,
      },
    ];
  }, [meetup]);

  const [selectedSlotId, setSelectedSlotId] = useState(
    () => displaySlots.find((s) => s.joinCount < s.maxPeople)?.id ?? displaySlots[0]?.id ?? "",
  );
  const [playExpanded, setPlayExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [available, setAvailable] = useState<AvailableCoupon[]>([]);
  const [formAnswers, setFormAnswers] = useState<OrderFormAnswers>({});

  useEffect(() => {
    if (!paid || !meetup.productCourseId || !currentUserId) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = normalizeCouponCode(
        params.get(COUPON_QUERY_KEY) || params.get("couponCode") || "",
      );
      const fromStorage = normalizeCouponCode(
        window.localStorage.getItem(COUPON_STORAGE_KEY) || "",
      );
      const code = fromQuery || fromStorage;
      if (code) setCouponCode(code);
    } catch {
      /* ignore */
    }
  }, [paid, meetup.productCourseId, currentUserId]);

  useEffect(() => {
    if (!paid || !meetup.productCourseId || !currentUserId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/coupons/available?courseId=${encodeURIComponent(meetup.productCourseId!)}`,
      );
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      const list = (data.coupons || []) as AvailableCoupon[];
      setAvailable(list);
      setCouponCode((current) => {
        const normalized = normalizeCouponCode(current);
        if (!normalized) return current;
        const hit = list.find(
          (c) => normalizeCouponCode(c.code) === normalized,
        );
        if (hit) setSelectedCouponId(hit.id);
        return normalized;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [paid, meetup.productCourseId, currentUserId]);

  const previewDiscount = selectedCouponId
    ? available.find((c) => c.id === selectedCouponId)?.discountCents || 0
    : available.find(
        (c) => normalizeCouponCode(c.code) === normalizeCouponCode(couponCode),
      )?.discountCents || 0;
  const previewPay = Math.max(meetup.priceCents - previewDiscount, 0);

  const startsAt = new Date(meetup.startsAt);
  const endsAt = meetup.endsAt ? new Date(meetup.endsAt) : null;
  const timeLabel = formatMeetupTimeRange(
    startsAt,
    endsAt,
    meetup.timezone || undefined,
  );
  const mapLink = `https://uri.amap.com/search?keyword=${encodeURIComponent(meetup.place)}`;

  const tagLine = [
    meetupCategoryLabel(meetup.category),
    ...meetup.tags,
  ]
    .filter(Boolean)
    .join(" | ");

  const ctaLabel = (() => {
    if (alreadyJoined) return "已上车";
    if (!canJoinMeetup(meetup.status)) return meetupStatusLabel(meetup.status);
    if (!paid) return "上车（免费）";
    if (previewPay <= 0 && previewDiscount > 0) return "上车（0 元报名）";
    return `上车（支付 ${formatPrice(meetup.priceCents)}）`;
  })();

  function joinsForSlot(slotId: string) {
    if (!slotId) return meetup.joins;
    return meetup.joins.filter((j) => j.slotId === slotId);
  }

  async function setHostStatus(next: string) {
    const label =
      HOST_STATUS_ACTIONS.find((a) => a.key === next)?.label || next;
    if (!confirm(`确定「${label}」？`)) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/meetup/${meetup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "操作失败");
        return;
      }
      router.refresh();
    } catch {
      setMessage("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function freeJoin() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/meetup/${meetup.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: selectedSlotId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "报名失败");
        return;
      }
      router.refresh();
    } catch {
      setMessage("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function leave() {
    if (!confirm("确定取消报名？")) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/meetup/${meetup.id}/join`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "取消失败");
        return;
      }
      router.refresh();
    } catch {
      setMessage("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function paidBuy() {
    if (!meetup.productCourseId) {
      setMessage("活动商品未就绪，请稍后刷新");
      return;
    }
    if (fields.length > 0) {
      const check = validateOrderFormAnswers(orderForm, formAnswers);
      if (!check.ok) {
        setMessage(check.error);
        return;
      }
    }
    setLoading(true);
    setMessage("");
    let referralCode: string | undefined;
    try {
      referralCode =
        window.localStorage.getItem(REFERRAL_STORAGE_KEY) || undefined;
    } catch {
      /* ignore */
    }
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: meetup.productCourseId,
          couponId: selectedCouponId || undefined,
          couponCode: !selectedCouponId && couponCode ? couponCode : undefined,
          formAnswers: fields.length > 0 ? formAnswers : undefined,
          referralCode,
          // 用规格快照携带分档，支付履约后写入 MeetupJoin.slotId
          specLabel: selectedSlotId
            ? meetupSlotSpecLabel(selectedSlotId)
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "下单失败");
        if (res.status === 401) {
          router.push(
            `/login?next=${encodeURIComponent(`/meetup/${meetup.id}`)}`,
          );
        }
        return;
      }
      if (data.enrolled) {
        setPayOpen(false);
        router.refresh();
        return;
      }
      router.push(`/checkout/${data.orderId}`);
    } catch {
      setMessage("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  function onPrimaryCta() {
    if (!currentUserId) {
      router.push(`/login?next=${encodeURIComponent(`/meetup/${meetup.id}`)}`);
      return;
    }
    if (alreadyJoined || isHost) return;
    if (!canJoinMeetup(meetup.status)) return;
    if (paid) {
      setPayOpen(true);
      return;
    }
    void freeJoin();
  }

  const playBody = meetup.contentHtml?.trim()
    ? { html: meetup.contentHtml }
    : meetup.description
      ? { text: meetup.description }
      : null;

  return (
    <div className="meetup-detail pb-28">
      {/* 顶栏：返回 + 发起人 */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--line)] bg-white/95 px-3 py-2.5 backdrop-blur">
        <Link
          href="/meetup"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-lg"
          aria-label="返回"
        >
          ←
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Avatar
            name={meetup.host.name}
            avatarUrl={meetup.host.avatarUrl}
            size={32}
          />
          <span className="truncate text-sm font-medium">{meetup.host.name}</span>
          <span className="shrink-0 text-xs text-[var(--muted)]">发起人</span>
        </div>
      </div>

      {/* 大封面 */}
      {meetup.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meetup.coverUrl}
          alt=""
          className="aspect-[4/3] w-full object-cover sm:aspect-[16/9]"
        />
      ) : (
        <div className="flex aspect-[4/3] items-end bg-gradient-to-br from-emerald-200 via-sky-100 to-white px-5 pb-6 sm:aspect-[16/9]">
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-emerald-700">
            {meetupCategoryLabel(meetup.category)}
          </span>
        </div>
      )}

      <div className="space-y-5 px-4 pt-5 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold leading-snug sm:text-2xl">
            {meetup.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {meetup.autoRefund ? (
              <span className="inline-flex items-center rounded-md bg-sky-500 px-2 py-0.5 text-xs font-medium text-white">
                自动退
              </span>
            ) : null}
            {tagLine ? (
              <span className="text-xs leading-5 text-[var(--muted)]">
                {tagLine}
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-2.5 text-sm">
          <div className="flex gap-3">
            <span className="w-10 shrink-0 text-[var(--muted)]">时间</span>
            <span className="font-medium">{timeLabel}</span>
          </div>
          <div className="flex gap-3">
            <span className="w-10 shrink-0 text-[var(--muted)]">地点</span>
            <a
              href={mapLink}
              target="_blank"
              rel="noreferrer"
              className="min-h-11 font-medium text-[var(--brand-strong)] underline-offset-2 hover:underline"
            >
              {meetup.place}
              <span className="ml-1 text-xs font-normal text-[var(--muted)]">
                打开地图
              </span>
            </a>
          </div>
          <div className="flex gap-3">
            <span className="w-10 shrink-0 text-[var(--muted)]">状态</span>
            <span>{meetupStatusLabel(meetup.status)}</span>
          </div>
        </div>

        {/* 分档名额 */}
        <section className="space-y-2">
          {displaySlots.map((slot) => {
            const people = joinsForSlot(slot.id);
            const selected = selectedSlotId === slot.id;
            const full = slot.joinCount >= slot.maxPeople;
            return (
              <button
                key={slot.id || "legacy"}
                type="button"
                disabled={full && !alreadyJoined}
                onClick={() => setSelectedSlotId(slot.id)}
                className={`flex w-full min-h-14 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                  selected
                    ? "border-emerald-500 bg-emerald-50/80"
                    : "border-[var(--line)] bg-white"
                } ${full ? "opacity-70" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold">{slot.name}</span>
                    <span className="text-sm text-[var(--muted)]">
                      {slot.joinCount}/{slot.maxPeople}人
                    </span>
                  </div>
                  <div className="mt-2 flex -space-x-2">
                    {people.slice(0, 8).map((j) => (
                      <Avatar
                        key={j.id}
                        name={j.user.name}
                        avatarUrl={j.user.avatarUrl}
                        size={28}
                      />
                    ))}
                    {people.length === 0 ? (
                      <span className="text-xs text-[var(--muted)]">
                        还没人上车，来当第一位
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="text-[var(--muted)]">›</span>
              </button>
            );
          })}
        </section>

        {/* 参与更安心 */}
        {(meetup.feeIncludes || meetup.refundPolicy || meetup.autoRefund) && (
          <section>
            <h2 className="text-base font-semibold">参与更安心</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="relative overflow-hidden rounded-2xl bg-orange-50 p-3.5">
                <div className="text-sm font-semibold text-orange-900">
                  费用包含
                </div>
                <p className="mt-2 text-xs leading-5 text-orange-900/80">
                  {meetup.feeIncludes ||
                    (paid
                      ? `报名费 ${formatPrice(meetup.priceCents)}（以发起人说明为准）`
                      : "本场免费参与")}
                </p>
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-sky-50 p-3.5">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-sky-900">
                  退款政策
                  {meetup.autoRefund ? (
                    <span className="rounded bg-sky-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      自动退
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs leading-5 text-sky-900/80">
                  {meetup.refundPolicy ||
                    "退改规则以发起人说明与站内订单规则为准"}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* 本场怎么玩 */}
        {playBody ? (
          <section>
            <h2 className="text-base font-semibold">本场怎么玩</h2>
            {meetup.tags.length > 0 ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                {meetup.tags.join(" | ")}
              </p>
            ) : null}
            <div
              className={`relative mt-3 text-sm leading-7 text-[var(--ink)] ${
                playExpanded ? "" : "max-h-40 overflow-hidden"
              }`}
            >
              {"html" in playBody && playBody.html ? (
                <div
                  className="meetup-rich space-y-2 [&_figcaption]:text-center [&_figcaption]:text-xs [&_figcaption]:text-[var(--muted)] [&_figure]:my-2 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:rounded-xl [&_img]:mx-auto [&_img]:max-h-[60vh] [&_img]:max-w-full [&_img]:rounded-xl [&_video]:w-full [&_video]:rounded-xl"
                  dangerouslySetInnerHTML={{ __html: playBody.html }}
                />
              ) : (
                <p className="whitespace-pre-wrap">
                  {"text" in playBody ? playBody.text : ""}
                </p>
              )}
              {!playExpanded ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--bg)] to-transparent" />
              ) : null}
            </div>
            <button
              type="button"
              className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm text-[var(--brand-strong)]"
              onClick={() => setPlayExpanded((v) => !v)}
            >
              {playExpanded ? "收起" : "展开"}
              <span aria-hidden>{playExpanded ? "▴" : "▾"}</span>
            </button>
          </section>
        ) : null}

        {/* 大家这样玩 */}
        {meetup.gallery.length > 0 ? (
          <section>
            <h2 className="text-base font-semibold">大家这样玩</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {meetup.gallery.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="aspect-square w-full rounded-2xl object-cover"
                />
              ))}
            </div>
          </section>
        ) : null}

        {canManageStatus ? (
          <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm text-[var(--muted)]">
              {isHost ? "发起人管理" : "站长管理"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {HOST_STATUS_ACTIONS.filter((a) => a.key !== meetup.status).map(
                (action) => (
                  <button
                    key={action.key}
                    type="button"
                    className={`btn min-h-11 ${
                      action.key === "CANCELLED" ? "btn-fire" : "btn-secondary"
                    }`}
                    disabled={loading}
                    onClick={() => void setHostStatus(action.key)}
                  >
                    {action.label}
                  </button>
                ),
              )}
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {isHost ? (
                <p className="text-xs text-[var(--muted)]">
                  你已自动占一席，无需支付报名费
                </p>
              ) : null}
              <Link
                href={
                  canManageAsAdmin && !isHost
                    ? `/studio/meetup/${meetup.id}/edit`
                    : `/meetup/${meetup.id}/edit`
                }
                className="inline-flex min-h-11 items-center text-sm text-[var(--brand)]"
              >
                {canManageAsAdmin && !isHost
                  ? "进后台编辑详情 →"
                  : "编辑活动详情 →"}
              </Link>
            </div>
          </section>
        ) : null}

        {!isHost && alreadyJoined ? (
          <button
            type="button"
            className="btn btn-secondary min-h-11 w-full"
            disabled={loading || meetup.status === "CANCELLED"}
            onClick={() => void leave()}
          >
            取消报名
          </button>
        ) : null}

        {message ? (
          <p className="text-sm text-[var(--fire)]">{message}</p>
        ) : null}
      </div>

      {/* 底栏固定 */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-white/95 px-3 py-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          {meetup.contactUrl ? (
            <a
              href={meetup.contactUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 w-12 flex-col items-center justify-center text-[10px] text-[var(--muted)]"
            >
              <span className="text-base">💬</span>
              联系
            </a>
          ) : null}
          <button
            type="button"
            className="flex min-h-11 w-12 flex-col items-center justify-center text-[10px] text-[var(--muted)]"
            onClick={() => setShareOpen(true)}
          >
            <span className="text-base">↗</span>
            分享
          </button>
          <button
            type="button"
            disabled={
              loading ||
              alreadyJoined ||
              isHost ||
              !canJoinMeetup(meetup.status)
            }
            onClick={onPrimaryCta}
            className="min-h-12 flex-1 rounded-full bg-zinc-900 px-4 text-sm font-semibold text-emerald-400 disabled:opacity-50"
          >
            {loading ? "处理中…" : ctaLabel}
          </button>
        </div>
      </div>

      {/* 分享面板 */}
      {shareOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="关闭"
            onClick={() => setShareOpen(false)}
          />
          <div className="relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 sm:max-w-md sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">分享赚提成</h3>
              <button
                type="button"
                className="min-h-11 px-2 text-sm text-[var(--muted)]"
                onClick={() => setShareOpen(false)}
              >
                关闭
              </button>
            </div>
            {inviteCode ? (
              <InviteSharePanel
                inviteCode={inviteCode}
                courseSlug={meetup.id}
                courseTitle={meetup.title}
                productType={MEETUP_PRODUCT_TYPE}
              />
            ) : (
              <p className="text-sm text-[var(--muted)]">
                登录后可生成带邀请码的分享链接与海报，好友报名购买后计入分销业绩。
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* 支付/优惠券面板 */}
      {payOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="关闭"
            onClick={() => setPayOpen(false)}
          />
          <div className="relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 sm:max-w-md sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">确认上车</h3>
              <button
                type="button"
                className="min-h-11 px-2 text-sm text-[var(--muted)]"
                onClick={() => setPayOpen(false)}
              >
                关闭
              </button>
            </div>
            <p className="text-sm text-[var(--muted)]">
              分档：
              {displaySlots.find((s) => s.id === selectedSlotId)?.name || "报名"}
            </p>
            <div className="mt-2 text-2xl font-semibold text-emerald-600">
              {previewDiscount > 0
                ? formatPrice(previewPay)
                : formatPrice(meetup.priceCents)}
            </div>
            {previewDiscount > 0 ? (
              <p className="mt-1 text-sm text-[var(--fire)]">
                已优惠 -{formatPrice(previewDiscount)}（原价{" "}
                {formatPrice(meetup.priceCents)}）
              </p>
            ) : null}

            {fields.length > 0 ? (
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <OrderFormFields
                  config={orderForm}
                  values={formAnswers}
                  onChange={setFormAnswers}
                  disabled={loading}
                />
              </div>
            ) : null}

            {available.length > 0 ? (
              <div className="mt-4 space-y-2">
                <div className="text-sm text-[var(--muted)]">可用优惠券</div>
                {available.map((c) => {
                  const active = selectedCouponId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        if (active) {
                          setSelectedCouponId("");
                          setCouponCode("");
                        } else {
                          setSelectedCouponId(c.id);
                          setCouponCode(c.code);
                        }
                      }}
                      className={`min-h-11 w-full rounded-2xl border px-3 py-3 text-left text-sm ${
                        active
                          ? "border-[var(--fire)] bg-[var(--fire)]/5"
                          : "border-[var(--line)]"
                      }`}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{c.title}</span>
                        <span className="text-[var(--fire)]">{c.benefit}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <input
              className="field mt-3 min-h-11"
              placeholder="或输入优惠券码"
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value);
                setSelectedCouponId("");
              }}
            />

            {message ? (
              <p className="mt-3 text-sm text-[var(--fire)]">{message}</p>
            ) : null}

            <button
              type="button"
              className="mt-4 min-h-12 w-full rounded-full bg-zinc-900 text-sm font-semibold text-emerald-400"
              disabled={loading}
              onClick={() => void paidBuy()}
            >
              {loading
                ? "处理中…"
                : previewPay <= 0
                  ? "0 元报名"
                  : `支付 ${formatPrice(previewPay)} 上车`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

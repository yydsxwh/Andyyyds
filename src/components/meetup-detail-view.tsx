"use client";

/**
 * 约搭详情：对齐「暴走村」类活动详情的业务模块（底栏咨询+报名、物流信息、最近报名、内容 Tab、确认订单）。
 * 支付/优惠券/分销/地图外链仍复用站内订单流；风格贴近现有约搭页。
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
import { confirmAndDeleteMeetup } from "@/lib/meetup-delete-client";
import { meetupSlotSpecLabel } from "@/lib/meetup-meta";
import {
  buildMeetupConsultPhones,
  isWechatServiceLink,
  maskMeetupDisplayName,
  sumMeetupPartySize,
  type MeetupServicePhone,
  type SiteContactFallback,
} from "@/lib/meetup-service-contact";
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
  partySize?: number;
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
  meetingPoint?: string;
  destination?: string;
  highlights?: string;
  adminPhone?: string;
  servicePhones?: MeetupServicePhone[];
  wechatService?: string;
  itineraryHtml?: string;
  feeNoteHtml?: string;
  notesHtml?: string;
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

type ContentTabKey = "intro" | "itinerary" | "fee" | "notes";

const CONTENT_TABS: { key: ContentTabKey; label: string }[] = [
  { key: "intro", label: "活动介绍" },
  { key: "itinerary", label: "行程安排" },
  { key: "fee", label: "费用说明" },
  { key: "notes", label: "注意事项" },
];

/** 报名人数步进上限：与订单/join API 一致；勿与分档 maxPeople 编辑混用 */
const JOIN_PARTY_MAX = 10;

type Props = {
  meetup: MeetupDetailData;
  currentUserId: string | null;
  inviteCode: string;
  orderForm: OrderFormConfig;
  /** 站点「联系我们」回退，供咨询弹层 */
  siteContact?: SiteContactFallback | null;
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

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function plainToHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((p) => `<p>${p.trim().replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function RichBlock({ html }: { html: string }) {
  return (
    <div
      className="meetup-rich space-y-2 text-sm leading-7 text-[var(--ink)] [&_figcaption]:text-center [&_figcaption]:text-xs [&_figcaption]:text-[var(--muted)] [&_figure]:my-2 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:rounded-xl [&_img]:mx-auto [&_img]:max-h-[60vh] [&_img]:max-w-full [&_img]:rounded-xl [&_p]:mb-2 [&_video]:w-full [&_video]:rounded-xl"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function MeetupDetailView({
  meetup,
  currentUserId,
  inviteCode,
  orderForm,
  siteContact = null,
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

  const joinedPeople = useMemo(
    () => sumMeetupPartySize(meetup.joins),
    [meetup.joins],
  );
  const spotsLeft = Math.max(meetup.maxPeople - joinedPeople, 0);

  const displaySlots = useMemo(() => {
    if (meetup.slots.length > 0) return meetup.slots;
    return [
      {
        id: "",
        name: "报名",
        maxPeople: meetup.maxPeople,
        joinCount: joinedPeople,
      },
    ];
  }, [meetup, joinedPeople]);

  const [selectedSlotId, setSelectedSlotId] = useState(
    () =>
      displaySlots.find((s) => s.joinCount < s.maxPeople)?.id ??
      displaySlots[0]?.id ??
      "",
  );
  const selectedSlot =
    displaySlots.find((s) => s.id === selectedSlotId) || displaySlots[0];
  const slotSpotsLeft = selectedSlot
    ? Math.max(selectedSlot.maxPeople - selectedSlot.joinCount, 0)
    : spotsLeft;

  const [partySize, setPartySize] = useState(1);
  const [contentTab, setContentTab] = useState<ContentTabKey>("intro");
  const [recentOpen, setRecentOpen] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [available, setAvailable] = useState<AvailableCoupon[]>([]);
  const [formAnswers, setFormAnswers] = useState<OrderFormAnswers>({});
  const [wechatCopyHint, setWechatCopyHint] = useState("");

  const maxParty = Math.max(
    1,
    Math.min(JOIN_PARTY_MAX, slotSpotsLeft || JOIN_PARTY_MAX),
  );

  useEffect(() => {
    setPartySize((n) => Math.min(Math.max(1, n), maxParty));
  }, [maxParty, selectedSlotId]);

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

  const lineCents = meetup.priceCents * partySize;
  const previewDiscount = selectedCouponId
    ? available.find((c) => c.id === selectedCouponId)?.discountCents || 0
    : available.find(
        (c) => normalizeCouponCode(c.code) === normalizeCouponCode(couponCode),
      )?.discountCents || 0;
  const previewPay = Math.max(lineCents - previewDiscount, 0);

  const startsAt = new Date(meetup.startsAt);
  const endsAt = meetup.endsAt ? new Date(meetup.endsAt) : null;
  const timeLabel = formatMeetupTimeRange(
    startsAt,
    endsAt,
    meetup.timezone || undefined,
  );
  const placeQuery = encodeURIComponent(meetup.place);
  const amapLink = `https://uri.amap.com/search?keyword=${placeQuery}`;
  const tencentMapLink = `https://apis.map.qq.com/uri/v1/search?keyword=${placeQuery}&referer=yyds`;
  const appleMapLink = `https://maps.apple.com/?q=${placeQuery}`;
  const googleMapLink = `https://www.google.com/maps/search/?api=1&query=${placeQuery}`;

  const meetingPoint = (meetup.meetingPoint || "").trim() || meetup.place;
  const destination = (meetup.destination || "").trim();
  const highlights = (meetup.highlights || "").trim();
  const adminPhone = (meetup.adminPhone || "").trim();

  const consultPhones = useMemo(
    () =>
      buildMeetupConsultPhones({
        servicePhones: meetup.servicePhones || [],
        adminPhone,
        adminLabel: `${meetup.host.name}（管理员）`,
        siteContact,
      }),
    [meetup.servicePhones, adminPhone, meetup.host.name, siteContact],
  );

  const wechatService =
    (meetup.wechatService || "").trim() ||
    (siteContact?.wechat || "").trim();

  const recentJoins = useMemo(() => {
    return [...meetup.joins].reverse().slice(0, 12);
  }, [meetup.joins]);

  const ctaLabel = (() => {
    if (alreadyJoined) return "已上车";
    if (!canJoinMeetup(meetup.status)) return meetupStatusLabel(meetup.status);
    if (!paid) return "立即报名";
    if (previewPay <= 0 && previewDiscount > 0) return "立即报名（0 元）";
    return "立即报名";
  })();

  const introHtml = meetup.contentHtml?.trim()
    ? meetup.contentHtml
    : meetup.description
      ? plainToHtml(meetup.description)
      : "";

  const feeHtml = meetup.feeNoteHtml?.trim()
    ? meetup.feeNoteHtml
    : [
        meetup.feeIncludes
          ? `<p><strong>费用包含</strong><br/>${meetup.feeIncludes.replace(/</g, "&lt;")}</p>`
          : "",
        meetup.refundPolicy
          ? `<p><strong>退款政策</strong><br/>${meetup.refundPolicy.replace(/</g, "&lt;")}</p>`
          : "",
        paid
          ? `<p>报名费 ${formatPrice(meetup.priceCents)}/人（以发起人说明为准）</p>`
          : "<p>本场免费参与</p>",
      ]
        .filter(Boolean)
        .join("\n");

  const tabHtml: Record<ContentTabKey, string> = {
    intro: introHtml,
    itinerary: meetup.itineraryHtml?.trim() || "",
    fee: feeHtml,
    notes: meetup.notesHtml?.trim() || "",
  };

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

  async function removeMeetup() {
    setLoading(true);
    setMessage("");
    try {
      const result = await confirmAndDeleteMeetup({
        meetupId: meetup.id,
        title: meetup.title,
        via: "public",
      });
      if (result.ok) {
        // 删后详情已不存在，回广场避免 404
        router.push("/meetup");
        router.refresh();
        return;
      }
      if (result.cancelled) {
        if (result.message) setMessage(result.message);
        return;
      }
      setMessage(result.error || "删除失败");
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
          partySize,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "报名失败");
        return;
      }
      setPayOpen(false);
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
          quantity: partySize,
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
    // 确认订单弹层：选档 + 人数；免费也走同一确认体验
    setPayOpen(true);
  }

  async function onWechatService() {
    if (!wechatService) return;
    if (isWechatServiceLink(wechatService)) {
      window.open(wechatService, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      await navigator.clipboard.writeText(wechatService);
      setWechatCopyHint("微信号已复制");
      setTimeout(() => setWechatCopyHint(""), 2000);
    } catch {
      setWechatCopyHint(`请手动添加：${wechatService}`);
    }
  }

  const tagLine = [meetupCategoryLabel(meetup.category), ...meetup.tags]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="meetup-detail bg-[var(--bg)] pb-28">
      {/* 顶栏：返回 + 发起人 */}
      <div className="glass-bar sticky top-0 z-30 flex items-center gap-3 border-b px-3 py-2.5">
        <Link
          href="/meetup"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-lg touch-manipulation"
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
        <button
          type="button"
          className="inline-flex min-h-11 flex-col items-center justify-center px-2 text-[10px] text-[var(--muted)] touch-manipulation"
          onClick={() => setShareOpen(true)}
        >
          <span className="text-base leading-none">↗</span>
          分享
        </button>
      </div>

      {/* 大封面 */}
      {meetup.coverUrl ? (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-[var(--bg-deep)]/40 sm:aspect-[16/9]">
          {/* 详情大封面：contain 保证整图可见，比例随框自适应 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={meetup.coverUrl}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : (
        <div className="flex aspect-[4/3] items-end bg-gradient-to-br from-emerald-200 via-sky-100 to-white px-5 pb-6 sm:aspect-[16/9]">
          <span className="chip chip-idle !min-h-0 px-3 py-1 text-xs font-medium !text-emerald-700">
            {meetupCategoryLabel(meetup.category)}
          </span>
        </div>
      )}

      <div className="space-y-3 px-3 pt-3 sm:px-5">
        {/* 价格 / 余位 / 标题 */}
        <section className="surface px-4 py-4">
          <div className="flex items-end justify-between gap-3">
            <div className="text-2xl font-semibold text-[var(--brand-strong)]">
              {paid ? (
                <>
                  {formatPrice(meetup.priceCents)}
                  <span className="text-sm font-normal text-[var(--muted)]">
                    /人
                  </span>
                </>
              ) : (
                "免费"
              )}
            </div>
            <div className="text-right text-xs text-[var(--muted)]">
              余位 {spotsLeft} / 已报 {joinedPeople}
            </div>
          </div>
          <h1 className="mt-3 text-lg font-semibold leading-snug sm:text-xl">
            {meetup.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
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
          <div className="mt-3 text-sm text-[var(--ink)]">
            <span className="text-[var(--muted)]">时间 </span>
            {timeLabel}
          </div>
        </section>

        {/* 批次 / 分档 */}
        <section className="surface px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              批次（{displaySlots.length}）
            </h2>
            <span className="text-xs text-[var(--muted)]">
              {meetupStatusLabel(meetup.status)}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {displaySlots.map((slot) => {
              const selected = selectedSlotId === slot.id;
              const full = slot.joinCount >= slot.maxPeople;
              return (
                <button
                  key={slot.id || "legacy"}
                  type="button"
                  disabled={full && !alreadyJoined}
                  onClick={() => setSelectedSlotId(slot.id)}
                  className={`relative min-h-16 min-w-[7.5rem] shrink-0 rounded-xl border px-3 py-2 text-left touch-manipulation ${
                    selected
                      ? "border-[var(--brand)] bg-[var(--brand)]/5"
                      : "border-[var(--glass-edge)] bg-white/35"
                  } ${full ? "opacity-60" : ""}`}
                >
                  <div className="text-sm font-semibold">{slot.name}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {slot.joinCount}/{slot.maxPeople}人
                  </div>
                  {full ? (
                    <span className="mt-1 inline-block text-[10px] text-[var(--fire)]">
                      已满
                    </span>
                  ) : (
                    <span className="mt-1 inline-block text-[10px] text-emerald-600">
                      报名中
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* 集合地 / 目的地 / 管理员 / 亮点 */}
        <section className="surface space-y-3 px-4 py-4 text-sm">
          <div className="flex gap-3">
            <span className="w-16 shrink-0 text-[var(--muted)]">集合地</span>
            <div className="min-w-0 flex-1">
              <a
                href={amapLink}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--ink)] underline-offset-2 hover:underline touch-manipulation"
              >
                {meetingPoint}
              </a>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <a
                  href={amapLink}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-9 inline-flex items-center text-[var(--brand-strong)] touch-manipulation"
                >
                  高德
                </a>
                <a
                  href={tencentMapLink}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-9 inline-flex items-center text-[var(--brand-strong)] touch-manipulation"
                >
                  腾讯
                </a>
                <a
                  href={appleMapLink}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-9 inline-flex items-center text-[var(--brand-strong)] touch-manipulation"
                >
                  苹果
                </a>
                <a
                  href={googleMapLink}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-9 inline-flex items-center text-[var(--brand-strong)] touch-manipulation"
                >
                  Google
                </a>
              </div>
            </div>
          </div>
          {destination ? (
            <div className="flex gap-3">
              <span className="w-16 shrink-0 text-[var(--muted)]">目的地</span>
              <span className="font-medium">{destination}</span>
            </div>
          ) : null}
          <div className="flex gap-3">
            <span className="w-16 shrink-0 text-[var(--muted)]">管理员</span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="font-medium">{meetup.host.name}</span>
              {adminPhone ? (
                <a
                  href={telHref(adminPhone)}
                  className="inline-flex min-h-10 items-center text-[var(--brand-strong)] touch-manipulation"
                >
                  拨打电话 ›
                </a>
              ) : (
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center text-[var(--brand-strong)] touch-manipulation"
                  onClick={() => setConsultOpen(true)}
                >
                  咨询客服 ›
                </button>
              )}
            </div>
          </div>
          {highlights ? (
            <div className="flex gap-3">
              <span className="w-16 shrink-0 text-[var(--muted)]">活动亮点</span>
              <span className="leading-relaxed">{highlights}</span>
            </div>
          ) : null}
        </section>

        {/* 最近报名 */}
        <section className="surface px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">最近报名</h2>
            <button
              type="button"
              className="min-h-10 text-xs text-[var(--muted)] touch-manipulation"
              onClick={() => setRecentOpen(true)}
            >
              更多 ›
            </button>
          </div>
          {recentJoins.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">还没人上车，来当第一位</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {recentJoins.slice(0, 8).map((j) => {
                const size = Math.max(1, Math.floor(j.partySize || 1));
                return (
                  <div
                    key={j.id}
                    className="flex w-14 shrink-0 flex-col items-center gap-1"
                  >
                    <div className="relative">
                      <Avatar
                        name={j.user.name}
                        avatarUrl={j.user.avatarUrl}
                        size={44}
                      />
                      {size > 1 ? (
                        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-medium text-white">
                          {size}
                        </span>
                      ) : null}
                    </div>
                    <span className="w-full truncate text-center text-[10px] text-[var(--muted)]">
                      {maskMeetupDisplayName(j.user.name)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 内容 Tab */}
        <section className="surface overflow-hidden">
          <div className="flex gap-1 overflow-x-auto border-b border-[var(--line)] px-2">
            {CONTENT_TABS.map((tab) => {
              const active = contentTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setContentTab(tab.key)}
                  className={`relative min-h-12 shrink-0 px-3 text-sm touch-manipulation ${
                    active
                      ? "font-semibold text-[var(--brand-strong)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {tab.label}
                  {active ? (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--brand)]" />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="px-4 py-4">
            {tabHtml[contentTab] ? (
              <RichBlock html={tabHtml[contentTab]} />
            ) : (
              <p className="text-sm text-[var(--muted)]">
                暂无内容
                {canManageStatus ? "，可在编辑页填写对应分块" : ""}
              </p>
            )}
          </div>
        </section>

        {/* 图集 */}
        {meetup.gallery.length > 0 ? (
          <section className="surface px-4 py-4">
            <h2 className="text-sm font-semibold">大家这样玩</h2>
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
          <section className="surface p-4">
            <p className="text-sm text-[var(--muted)]">
              {isHost ? "发起人管理" : "站长管理"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {HOST_STATUS_ACTIONS.filter((a) => a.key !== meetup.status).map(
                (action) => (
                  <button
                    key={action.key}
                    type="button"
                    className={`btn touch-manipulation ${
                      action.key === "CANCELLED" ? "btn-danger" : "btn-secondary"
                    }`}
                    disabled={loading}
                    onClick={() => void setHostStatus(action.key)}
                  >
                    {action.label}
                  </button>
                ),
              )}
              <button
                type="button"
                className="btn btn-danger touch-manipulation"
                disabled={loading}
                onClick={() => void removeMeetup()}
              >
                删除活动
              </button>
            </div>
            <Link
              href={
                canManageAsAdmin && !isHost
                  ? `/studio/meetup/${meetup.id}/edit`
                  : `/meetup/${meetup.id}/edit`
              }
              className="mt-2 inline-flex min-h-11 items-center text-sm text-[var(--brand)] touch-manipulation"
            >
              {canManageAsAdmin && !isHost
                ? "进后台编辑详情 →"
                : "编辑活动详情 →"}
            </Link>
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

        {message && !payOpen && !consultOpen ? (
          <p className="text-sm text-[var(--fire)]">{message}</p>
        ) : null}
      </div>

      {/* 底栏：咨询 + 立即报名 */}
      <div className="glass-bar fixed inset-x-0 bottom-0 z-40 border-t px-3 py-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <button
            type="button"
            className="flex min-h-12 w-14 flex-col items-center justify-center rounded-xl border border-[var(--glass-edge)] bg-white/35 text-[10px] text-[var(--muted)] backdrop-blur-md touch-manipulation"
            onClick={() => setConsultOpen(true)}
          >
            <span className="text-base leading-none" aria-hidden>
              💬
            </span>
            咨询
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
            className="min-h-12 flex-1 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50 touch-manipulation"
          >
            {loading ? "处理中…" : ctaLabel}
          </button>
        </div>
      </div>

      {/* 咨询客服弹层 */}
      {consultOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="关闭"
            onClick={() => setConsultOpen(false)}
          />
          <div className="glass-panel relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-3xl p-5 sm:max-w-md sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">电话咨询</h3>
              <button
                type="button"
                className="min-h-11 px-2 text-sm text-[var(--muted)] touch-manipulation"
                onClick={() => setConsultOpen(false)}
              >
                关闭
              </button>
            </div>
            {consultPhones.length === 0 && !wechatService && !meetup.contactUrl ? (
              <p className="text-sm text-[var(--muted)]">
                暂未配置客服电话。请在活动编辑里填写，或到站点「联系我们」配置。
              </p>
            ) : null}
            <div className="divide-y divide-[var(--line)]">
              {consultPhones.map((row) => (
                <a
                  key={`${row.label}-${row.phone}`}
                  href={telHref(row.phone)}
                  className="flex min-h-14 items-center justify-between gap-3 py-3 touch-manipulation"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{row.label}</div>
                    <div className="mt-0.5 text-[var(--brand-strong)]">
                      {row.phone}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--muted)]">
                    点击拨打 ›
                  </span>
                </a>
              ))}
            </div>
            {wechatService ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => void onWechatService()}
                  className="min-h-12 w-full rounded-xl bg-[#07C160] text-sm font-semibold text-white touch-manipulation"
                >
                  微信客服
                </button>
                <p className="mt-2 text-center text-xs text-[var(--muted)]">
                  {isWechatServiceLink(wechatService)
                    ? "点击与微信客服沟通"
                    : "点击复制微信号"}
                </p>
                {wechatCopyHint ? (
                  <p className="mt-1 text-center text-xs text-[var(--brand-strong)]">
                    {wechatCopyHint}
                  </p>
                ) : null}
              </div>
            ) : null}
            {meetup.contactUrl ? (
              <a
                href={meetup.contactUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center text-sm text-[var(--brand)] touch-manipulation"
              >
                打开联系/群聊链接 →
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 最近报名更多 */}
      {recentOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="关闭"
            onClick={() => setRecentOpen(false)}
          />
          <div className="glass-panel relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-3xl p-5 sm:max-w-md sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">全部报名</h3>
              <button
                type="button"
                className="min-h-11 px-2 text-sm text-[var(--muted)]"
                onClick={() => setRecentOpen(false)}
              >
                关闭
              </button>
            </div>
            <ul className="space-y-3">
              {[...meetup.joins].reverse().map((j) => (
                <li key={j.id} className="flex items-center gap-3">
                  <Avatar
                    name={j.user.name}
                    avatarUrl={j.user.avatarUrl}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {maskMeetupDisplayName(j.user.name)}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {(j.partySize || 1) > 1
                        ? `${j.partySize} 人`
                        : "1 人"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* 分享面板 */}
      {shareOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="关闭"
            onClick={() => setShareOpen(false)}
          />
          <div className="glass-panel relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-3xl p-5 sm:max-w-md sm:rounded-3xl">
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

      {/* 确认订单 / 报名弹层 */}
      {payOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="关闭"
            onClick={() => setPayOpen(false)}
          />
          <div className="glass-panel relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-3xl p-5 sm:max-w-md sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">确认订单</h3>
              <button
                type="button"
                className="min-h-11 px-2 text-sm text-[var(--muted)] touch-manipulation"
                onClick={() => setPayOpen(false)}
              >
                关闭
              </button>
            </div>

            <div className="flex gap-3">
              {meetup.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={meetup.coverUrl}
                  alt=""
                  className="h-16 w-16 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-xs text-[var(--brand-strong)]">
                  约搭
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {selectedSlot?.name || "报名"}
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  余位: {slotSpotsLeft}
                </div>
                <div className="mt-1 text-sm">
                  <span className="text-[var(--brand-strong)]">
                    {paid ? formatPrice(meetup.priceCents) : "免费"}
                  </span>
                  {paid ? (
                    <span className="text-[var(--muted)]">
                      {" "}
                      /人 × {partySize}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-sm font-medium">批次</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {displaySlots.map((slot) => {
                  const selected = selectedSlotId === slot.id;
                  const full = slot.joinCount >= slot.maxPeople;
                  return (
                    <button
                      key={`pay-${slot.id || "legacy"}`}
                      type="button"
                      disabled={full}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`min-h-14 min-w-[6.5rem] shrink-0 rounded-xl border px-3 py-2 text-left text-sm touch-manipulation ${
                        selected
                          ? "border-[var(--brand)] bg-[var(--brand)]/5"
                          : "border-[var(--line)]"
                      }`}
                    >
                      <div className="font-semibold">{slot.name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {full ? "已满" : `余 ${slot.maxPeople - slot.joinCount}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <div className="text-sm font-medium">选择人数</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] text-lg touch-manipulation disabled:opacity-40"
                  disabled={partySize <= 1}
                  onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                  aria-label="减少人数"
                >
                  −
                </button>
                <span className="min-w-8 text-center text-base font-semibold">
                  {partySize}
                </span>
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] text-lg touch-manipulation disabled:opacity-40"
                  disabled={partySize >= maxParty}
                  onClick={() =>
                    setPartySize((n) => Math.min(maxParty, n + 1))
                  }
                  aria-label="增加人数"
                >
                  +
                </button>
              </div>
            </div>

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

            {paid && available.length > 0 ? (
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
                      className={`min-h-11 w-full rounded-2xl border px-3 py-3 text-left text-sm touch-manipulation ${
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
            {paid ? (
              <input
                className="field mt-3 min-h-11"
                placeholder="或输入优惠券码"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value);
                  setSelectedCouponId("");
                }}
              />
            ) : null}

            {message ? (
              <p className="mt-3 text-sm text-[var(--fire)]">{message}</p>
            ) : null}

            <button
              type="button"
              className="mt-4 flex min-h-14 w-full flex-col items-center justify-center rounded-full bg-[var(--brand)] text-sm font-semibold text-white disabled:opacity-50 touch-manipulation"
              disabled={loading || slotSpotsLeft < 1}
              onClick={() => {
                if (paid) void paidBuy();
                else void freeJoin();
              }}
            >
              {loading ? (
                "处理中…"
              ) : paid ? (
                <>
                  <span>立即付款</span>
                  <span className="text-xs font-normal opacity-90">
                    {formatPrice(previewPay)}
                  </span>
                </>
              ) : (
                "确认报名"
              )}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

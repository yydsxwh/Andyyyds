"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/locale-provider";
import { OrderFormFields } from "@/components/order-form-fields";
import { COUPON_QUERY_KEY, COUPON_STORAGE_KEY } from "@/lib/coupon-share";
import { normalizeCouponCode } from "@/lib/coupons";
import {
  activeOrderFormFields,
  validateOrderFormAnswers,
  type OrderFormAnswers,
  type OrderFormConfig,
} from "@/lib/order-form";
import { REFERRAL_STORAGE_KEY } from "@/lib/invite";
import { formatPrice } from "@/lib/utils";

type AvailableCoupon = {
  id: string;
  code: string;
  title: string;
  type: string;
  benefit: string;
  discountCents: number;
  minAmount: number;
  expiresAt: string | null;
};

type Props = {
  courseId: string;
  price: number;
  isFree: boolean;
  enrolled: boolean;
  slug: string;
  orderForm: OrderFormConfig;
  /** 购买面板文案：课程 / 资料 / 专栏 */
  productLabel?: string;
  /** 站长 / 授课者：可不购买直接进学习页预览 */
  canStaffPreview?: boolean;
  /** 购买/已拥有后的跳转；专栏套餐可指回详情页选子课 */
  learnHref?: string;
  /** 已拥有态文案（约搭用「你已报名」） */
  ownedHint?: string;
  /** 已拥有态主按钮文案 */
  ownedCtaLabel?: string;
  /** 购买按钮文案（约搭用「报名并支付」） */
  buyCtaLabel?: string;
  /** 支付说明旁白 */
  payHint?: string;
  /** 营销面隐藏售价（结账页仍显示应付） */
  hidePriceDisplay?: boolean;
};

export function PurchasePanel({
  courseId,
  price,
  isFree,
  enrolled,
  slug,
  orderForm,
  productLabel = "课程",
  canStaffPreview = false,
  learnHref,
  ownedHint,
  ownedCtaLabel,
  buyCtaLabel,
  payHint,
  hidePriceDisplay = false,
}: Props) {
  const goLearn = learnHref || `/learn/${slug}`;
  const router = useRouter();
  const { t } = useLocale();
  const [couponCode, setCouponCode] = useState("");
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [available, setAvailable] = useState<AvailableCoupon[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [formAnswers, setFormAnswers] = useState<OrderFormAnswers>({});
  const fields = activeOrderFormFields(orderForm);
  const isMeetup = productLabel === "约搭";

  // 分享链 ?coupon= 或本地记住的券码：预填输入框；点选列表仍以可用券为准
  useEffect(() => {
    if (isFree || price <= 0) return;
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
  }, [isFree, price]);

  // 登录后拉取可用券，供点选；最终以下单接口校验为准
  useEffect(() => {
    if (isFree || price <= 0) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/coupons/available?courseId=${encodeURIComponent(courseId)}`,
      );
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      const list = (data.coupons || []) as AvailableCoupon[];
      setAvailable(list);
      // 预填码若在可用列表中，自动点选以显示减免预览
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
  }, [courseId, isFree, price]);

  const previewDiscount = (() => {
    if (selectedCouponId) {
      return (
        available.find((c) => c.id === selectedCouponId)?.discountCents || 0
      );
    }
    // 手输券码时也尝试匹配可用列表，便于预览「抵扣后 0 元」
    const typed = normalizeCouponCode(couponCode);
    if (!typed) return 0;
    return (
      available.find((c) => normalizeCouponCode(c.code) === typed)
        ?.discountCents || 0
    );
  })();
  const previewPay = Math.max(price - previewDiscount, 0);
  const willZeroPay = !isFree && price > 0 && previewDiscount > 0 && previewPay === 0;

  function pickCoupon(coupon: AvailableCoupon) {
    setSelectedCouponId(coupon.id);
    setCouponCode(coupon.code);
  }

  function clearCoupon() {
    setSelectedCouponId("");
    setCouponCode("");
  }

  async function buy() {
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
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
        // 点选优先传 couponId；手动输入传 couponCode
        couponId: selectedCouponId || undefined,
        couponCode: !selectedCouponId && couponCode ? couponCode : undefined,
        formAnswers: fields.length > 0 ? formAnswers : undefined,
        referralCode,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error || "下单失败");
      if (res.status === 401) router.push("/login");
      return;
    }

    if (data.enrolled) {
      router.push(goLearn);
      router.refresh();
      return;
    }

    router.push(`/checkout/${data.orderId}`);
  }

  if (enrolled) {
    return (
      <div className="surface rounded-[28px] p-6">
        <p className="text-sm text-[var(--muted)]">
          {ownedHint || `你已拥有本${productLabel}`}
        </p>
        <button
          className="btn btn-primary mt-4 w-full"
          onClick={() => router.push(goLearn)}
          type="button"
        >
          {ownedCtaLabel ||
            (productLabel === "资料"
              ? "进入查看"
              : productLabel === "专栏"
                ? "查看套餐课程"
                : isMeetup
                  ? "查看活动"
                  : "进入学习")}
        </button>
      </div>
    );
  }

  if (canStaffPreview) {
    const isMaterial = productLabel === "资料";
    const isColumn = productLabel === "专栏";
    return (
      <div className="surface rounded-[28px] p-6">
        <p className="text-sm text-[var(--muted)]">
          {isMaterial
            ? "站长 / 授课预览：可直接预览或下载全部资料文件。"
            : isColumn
              ? "站长 / 授课预览：可查看套餐内各单课并进入学习。"
              : "站长 / 授课预览：可直接查看全部网课内容并播放视频。"}
        </p>
        <button
          className="btn btn-primary mt-4 w-full"
          onClick={() => router.push(goLearn)}
          type="button"
        >
          {isMaterial ? "预览资料" : isColumn ? "查看套餐" : "预览网课"}
        </button>
        {hidePriceDisplay ? (
          <p className="mt-3 text-xs text-[var(--muted)]">
            学员仍须购买后{isMaterial ? "查看 / 下载" : "学习"}。
          </p>
        ) : (
          <p className="mt-3 text-xs text-[var(--muted)]">
            前台售价 {isFree || price <= 0 ? "免费" : formatPrice(price)}
            ；学员仍须购买后
            {isMaterial ? "查看 / 下载" : "学习"}。
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="surface rounded-[28px] p-6">
      {hidePriceDisplay ? (
        <div className="text-xl font-semibold text-[var(--ink)]">
          {isFree || price <= 0 ? "免费领取" : `获取${productLabel}`}
        </div>
      ) : (
        <div className="text-3xl font-semibold text-[var(--brand)]">
          {isFree || price <= 0
            ? "免费领取"
            : previewDiscount > 0
              ? formatPrice(previewPay)
              : `¥${(price / 100).toFixed(price % 100 === 0 ? 0 : 2)}`}
        </div>
      )}
      {previewDiscount > 0 && !hidePriceDisplay ? (
        <p className="mt-1 text-sm text-[var(--fire)]">
          已选优惠 -{formatPrice(previewDiscount)}（原价 {formatPrice(price)}）
          {willZeroPay
            ? " · 抵扣后 0 元，确认后直接开通，无需支付"
            : ""}
        </p>
      ) : (
        <p className="mt-2 text-sm text-[var(--muted)]">
          {payHint ||
            (isMeetup
              ? "支持微信 JSAPI / 扫码支付；支付成功后自动报名。可用优惠券抵扣，额度 ≥ 报名费时可 0 元报名。"
              : "支持微信支付购买；支付成功后立即开通学习。优惠券额度 ≥ 售价时可 0 元开通。")}
        </p>
      )}
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
      {!isFree && price > 0 ? (
        <div className="mt-4 space-y-3">
          {available.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm text-[var(--muted)]">可用优惠券</div>
              <div className="flex flex-col gap-2">
                {available.map((c) => {
                  const active = selectedCouponId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        active ? clearCoupon() : pickCoupon(c)
                      }
                      className={`min-h-11 rounded-2xl border px-3 py-3 text-left text-sm transition ${
                        active
                          ? "border-[var(--fire)] bg-[var(--fire)]/5"
                          : "border-[var(--line)] bg-white/60 hover:border-[var(--brand)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{c.title}</span>
                        <span className="text-[var(--fire)]">{c.benefit}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--muted)]">
                        {c.code}
                        {c.minAmount > 0
                          ? ` · 满 ${formatPrice(c.minAmount)}`
                          : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <input
            className="field"
            placeholder="或输入优惠券码，如 YYDS20"
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value);
              // 手动改码时取消点选，避免 id/code 不一致
              setSelectedCouponId("");
            }}
          />
        </div>
      ) : null}
      <button
        className="btn btn-accent mt-4 w-full"
        disabled={loading}
        onClick={buy}
        type="button"
      >
        {loading
          ? t("common.loading")
          : buyCtaLabel
            ? willZeroPay
              ? isMeetup
                ? "0 元报名"
                : "0 元开通"
              : buyCtaLabel
            : isFree || price <= 0 || willZeroPay
              ? isMeetup
                ? t("cta.freeJoin")
                : "0 元开通"
              : t("cta.buy")}
      </button>
      {message ? <p className="mt-3 text-sm text-red-700">{message}</p> : null}
    </div>
  );
}

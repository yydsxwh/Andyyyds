"use client";

import { useEffect, useState } from "react";
import { MathcodeWechatPay } from "@andyyyds/mathcode/components/mathcode-wechat-pay";
import {
  createMathcodeCheckout,
  type MathcodePayChannels,
} from "@andyyyds/mathcode/lib/mathcode-access-client";
import {
  MATHCODE_GUEST_CENTS_PER_PAGE,
  MATHCODE_MEMBERSHIP_CENTS,
  MATHCODE_MEMBERSHIP_PAGES,
} from "@andyyyds/mathcode/lib/mathcode-quota";
import { formatPrice } from "@andyyyds/shared/utils";

export type MathcodePayIntent =
  | { kind: "membership" }
  | { kind: "pages"; pageCount: number }
  | { kind: "choose"; pageCount: number };

type Props = {
  intent: MathcodePayIntent;
  channels: MathcodePayChannels;
  onPaid: () => void;
  onClose: () => void;
};

export function MathcodePayDialog({ intent, channels, onPaid, onClose }: Props) {
  const [phase, setPhase] = useState<"pick" | "pay">(
    intent.kind === "choose" ? "pick" : "pay",
  );
  const [picked, setPicked] = useState<Exclude<MathcodePayIntent, { kind: "choose" }>>(
    intent.kind === "choose" ? { kind: "pages", pageCount: intent.pageCount } : intent,
  );
  const [order, setOrder] = useState<{ orderId: string; amount: number } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const pageCount = intent.kind === "membership" ? 0 : intent.pageCount;
  const pageAmount = pageCount * MATHCODE_GUEST_CENTS_PER_PAGE;

  useEffect(() => {
    if (phase !== "pay") return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void createMathcodeCheckout(
      picked.kind,
      picked.kind === "pages" ? picked.pageCount : undefined,
    )
      .then((next) => {
        if (!cancelled) setOrder(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "下单失败");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [phase, picked]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mathcode-pay-title"
    >
      <div className="surface w-full max-w-md rounded-[28px] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="mathcode-pay-title" className="text-lg font-semibold text-[var(--ink)]">
              {picked.kind === "membership" ? "开通 MathCode 会员" : "按页支付后转换"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {picked.kind === "membership"
                ? `¥30 / 30 天，含 ${MATHCODE_MEMBERSHIP_PAGES} 页。额度用完须再开通，获得新的 150 页。`
                : `未开会员按 ${formatPrice(MATHCODE_GUEST_CENTS_PER_PAGE)} / 页，先微信支付再识别。`}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary min-h-11 px-3"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        {intent.kind === "choose" && phase === "pick" ? (
          <div className="mt-5 grid gap-3">
            <button
              type="button"
              className="btn btn-primary min-h-12 w-full"
              onClick={() => {
                setPicked({ kind: "pages", pageCount: intent.pageCount });
                setPhase("pay");
              }}
            >
              本次按页支付 {formatPrice(pageAmount)}（{pageCount} 页）
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-12 w-full"
              onClick={() => {
                setPicked({ kind: "membership" });
                setPhase("pay");
              }}
            >
              开通会员 {formatPrice(MATHCODE_MEMBERSHIP_CENTS)}（{MATHCODE_MEMBERSHIP_PAGES} 页）
            </button>
          </div>
        ) : null}

        {phase === "pay" ? (
          <div className="mt-5">
            {loading ? (
              <p className="text-sm text-[var(--muted)]">正在创建订单…</p>
            ) : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            {order ? (
              <MathcodeWechatPay
                orderId={order.orderId}
                amount={order.amount}
                channels={channels}
                onPaid={onPaid}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

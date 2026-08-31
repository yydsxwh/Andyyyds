"use client";

/**
 * 优惠券分享菜单：复制链接 / 微信 / QQ。
 * 微信内无完整 JS-SDK 分享配置时：引导右上角菜单转发，并提供一键复制。
 */

import { useEffect, useRef, useState } from "react";
import {
  couponShareSummary,
  couponShareTitle,
  qqShareUrl,
  resolveCouponShareUrl,
} from "@andyyyds/shared/coupon-share";
import { formatCouponBenefit } from "@andyyyds/shared/coupons";
import { isWeChatBrowser } from "@andyyyds/shared/wechat-env";

export type CouponShareTarget = {
  code: string;
  title: string;
  type: string;
  discountCents: number;
  percentOff: number;
  productScope?: string | null;
  products?: Array<{
    slug: string;
    productType: string;
  }>;
};

type Props = {
  coupon: CouponShareTarget;
  /** 紧凑按钮样式，用于列表行 */
  compact?: boolean;
};

export function CouponShareMenu({ coupon, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [inWeChat, setInWeChat] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const shareUrl = resolveCouponShareUrl({
    code: coupon.code,
    productScope: coupon.productScope,
    products: coupon.products,
  });
  const title = couponShareTitle(coupon.title, coupon.code);
  const summary = couponShareSummary(formatCouponBenefit(coupon));

  useEffect(() => {
    setInWeChat(isWeChatBrowser());
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice(
        inWeChat
          ? "链接已复制，可粘贴发给微信好友"
          : "分享链接已复制",
      );
    } catch {
      setNotice("复制失败，请长按链接手动复制");
    }
  }

  async function shareWeChat() {
    // 微信内优先复制 + 提示用右上角转发；有系统分享则尝试调起
    if (inWeChat) {
      await copyLink();
      setNotice("链接已复制：点右上角「…」转发给好友，或粘贴到聊天");
      return;
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: summary, url: shareUrl });
        setNotice("已调起系统分享");
        return;
      } catch {
        /* 用户取消则回退复制 */
      }
    }
    await copyLink();
    setNotice("已复制链接，请粘贴到微信发送给好友");
  }

  function shareQQ() {
    const url = qqShareUrl({ url: shareUrl, title, summary });
    window.open(url, "_blank", "noopener,noreferrer");
    setNotice("已打开 QQ 分享");
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        className={
          compact
            ? "rounded-full border border-[var(--line)] px-3 py-1.5 text-xs hover:border-[var(--brand)]"
            : "btn btn-secondary min-h-11 flex-1 text-sm sm:flex-none"
        }
        onClick={() => {
          setNotice("");
          setOpen((v) => !v);
        }}
      >
        分享
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-[min(calc(100vw-2rem),16rem)] max-w-[calc(100vw-1rem)] rounded-2xl border border-[var(--line)] bg-white p-2 shadow-lg">
          <p className="break-all px-2 py-1 text-[11px] text-[var(--muted)]">
            {shareUrl}
          </p>
          <button
            type="button"
            className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm hover:bg-[var(--brand-soft)]"
            onClick={() => void copyLink()}
          >
            复制链接
          </button>
          <button
            type="button"
            className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm hover:bg-[var(--brand-soft)]"
            onClick={() => void shareWeChat()}
          >
            分享到微信
          </button>
          <button
            type="button"
            className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm hover:bg-[var(--brand-soft)]"
            onClick={shareQQ}
          >
            分享到 QQ
          </button>
          {notice ? (
            <p className="px-2 py-2 text-xs text-[var(--brand)]">{notice}</p>
          ) : null}
          {inWeChat ? (
            <p className="px-2 pb-2 text-[11px] text-[var(--muted)]">
              微信内请点右上角「…」转发，或先复制链接粘贴发送。
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

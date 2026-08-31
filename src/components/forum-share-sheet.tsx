"use client";

/**
 * 帖子分享底栏：复制链接、系统分享、微信/朋友圈、QQ/空间、微博、抖音、小红书。
 * 微信内不能从网页直接调起选好友面板，只能引导右上角 ··· 并复制/出示二维码。
 */

import { useEffect, useId, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  copyShareText,
  forumQqShareUrl,
  forumQzoneShareUrl,
  forumShareCaption,
  forumWeiboShareUrl,
  openSharePage,
  resolveClientShareUrl,
} from "@/lib/forum-share";
import { isWeChatBrowser } from "@/lib/wechat-env";

type Props = {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  title: string;
  summary: string;
  campusName: string;
  imageUrl?: string;
  onShared?: () => void;
};

type Channel =
  | "copy"
  | "system"
  | "wechat"
  | "moments"
  | "qq"
  | "qzone"
  | "weibo"
  | "douyin"
  | "xhs";

type WechatGuide = "wechat" | "moments" | null;

export function ForumShareSheet({
  open,
  onClose,
  shareUrl,
  title,
  summary,
  campusName,
  imageUrl,
  onShared,
}: Props) {
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [inWeChat, setInWeChat] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [notice, setNotice] = useState("");
  const [qr, setQr] = useState("");
  const [guide, setGuide] = useState<WechatGuide>(null);
  const url = resolveClientShareUrl(shareUrl);
  const caption = forumShareCaption({
    title,
    summary,
    campusName,
    url,
  });

  useEffect(() => {
    setInWeChat(isWeChatBrowser());
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  useEffect(() => {
    if (!open) {
      setNotice("");
      setGuide(null);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    let cancelled = false;
    void QRCode.toDataURL(url, {
      width: 280,
      margin: 1,
      color: { dark: "#111827", light: "#ffffff" },
    })
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => {
        if (!cancelled) setQr("");
      });
    return () => {
      cancelled = true;
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, url]);

  async function copy(text: string, okMsg: string) {
    const ok = await copyShareText(text);
    if (ok) {
      setNotice(okMsg);
      onShared?.();
      return true;
    }
    setNotice("复制失败，请长按下方链接手动复制，或用二维码分享");
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLInputElement>("[data-forum-share-url]");
      el?.focus();
      el?.select();
    });
    return false;
  }

  function openExternal(href: string, okMsg: string) {
    openSharePage(href);
    setNotice(okMsg);
    onShared?.();
  }

  async function onChannel(channel: Channel) {
    setGuide(null);
    if (channel === "copy") {
      await copy(url, "链接已复制，可粘贴发给好友");
      return;
    }
    if (channel === "system") {
      if (!canNativeShare) {
        await copy(url, "当前浏览器不支持系统分享，已复制链接");
        return;
      }
      try {
        await navigator.share({
          title,
          text: summary ? `${summary}\n${url}` : url,
          url,
        });
        setNotice("已调起系统分享");
        onShared?.();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        await copy(url, "系统分享未完成，已复制链接");
      }
      return;
    }
    if (channel === "wechat" || channel === "moments") {
      const toMoments = channel === "moments";
      const target = toMoments ? "朋友圈" : "微信好友";
      // 站外手机浏览器：系统分享里通常就有微信，比「只能复制」更接近点一下发出去
      if (!inWeChat && canNativeShare && !toMoments) {
        try {
          await navigator.share({
            title,
            text: summary ? `${summary}\n${url}` : url,
            url,
          });
          setNotice("已调起系统分享，请选择微信");
          onShared?.();
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }
      await copy(
        caption,
        inWeChat
          ? `文案已复制：点右上角 ··· ${toMoments ? "分享到朋友圈" : "发送给朋友"}，或粘贴到聊天`
          : `文案已复制，打开微信发给${target}，或让对方扫下方二维码`,
      );
      if (inWeChat) setGuide(channel);
      return;
    }
    if (channel === "qq") {
      openExternal(
        forumQqShareUrl({
          url,
          title,
          summary: summary || title,
          image: imageUrl,
        }),
        "已打开 QQ 分享",
      );
      return;
    }
    if (channel === "qzone") {
      openExternal(
        forumQzoneShareUrl({
          url,
          title,
          summary: summary || title,
          image: imageUrl,
        }),
        "已打开 QQ 空间分享",
      );
      return;
    }
    if (channel === "weibo") {
      openExternal(
        forumWeiboShareUrl({
          url,
          title: summary ? `${title} ${summary}` : title,
          image: imageUrl,
        }),
        "已打开微博分享",
      );
      return;
    }
    if (channel === "douyin") {
      await copy(caption, "文案已复制：打开抖音发作品或私信时粘贴即可");
      return;
    }
    await copy(caption, "文案已复制：打开小红书发笔记时粘贴即可");
  }

  if (!open) return null;

  const items: Array<{
    channel: Channel;
    label: string;
    bg: string;
    fg?: string;
    hide?: boolean;
  }> = [
    { channel: "copy", label: "复制链接", bg: "bg-slate-600" },
    {
      channel: "system",
      label: "系统分享",
      bg: "bg-sky-600",
      hide: inWeChat || !canNativeShare,
    },
    { channel: "wechat", label: "微信", bg: "bg-[#07c160]" },
    { channel: "moments", label: "朋友圈", bg: "bg-[#2aae67]" },
    { channel: "qq", label: "QQ", bg: "bg-[#12b7f5]" },
    { channel: "qzone", label: "QQ空间", bg: "bg-[#ffcd00]", fg: "text-slate-900" },
    { channel: "weibo", label: "微博", bg: "bg-[#e6162d]" },
    { channel: "douyin", label: "抖音", bg: "bg-zinc-900" },
    { channel: "xhs", label: "小红书", bg: "bg-[#ff2442]" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
      <button
        type="button"
        className="min-h-11 flex-1"
        aria-label="关闭分享"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mx-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[var(--card)] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-xl sm:mb-6 sm:rounded-3xl"
      >
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[var(--line)]" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold">
            分享帖子
          </h2>
          <button
            type="button"
            className="min-h-11 px-2 text-sm text-[var(--muted)]"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 sm:grid-cols-5">
          {items
            .filter((item) => !item.hide)
            .map((item) => (
              <button
                key={item.channel}
                type="button"
                className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-2"
                onClick={() => void onChannel(item.channel)}
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold text-white ${item.bg} ${item.fg || ""}`}
                >
                  {channelMark(item.channel)}
                </span>
                <span className="text-[11px] leading-tight text-[var(--fg)]">
                  {item.label}
                </span>
              </button>
            ))}
        </div>

        {notice ? (
          <p className="mt-3 text-sm leading-6 text-[var(--brand)]">{notice}</p>
        ) : (
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
            {inWeChat
              ? "微信里请点右上角 ··· 发给朋友或朋友圈；也可先复制链接再粘贴。"
              : "手机可用系统分享直接选微信、QQ、抖音；网页分享会打开对应页面。"}
          </p>
        )}

        <label className="mt-3 block text-xs text-[var(--muted)]">
          帖子链接
          <input
            readOnly
            data-forum-share-url="1"
            value={url}
            className="mt-1 min-h-11 w-full rounded-2xl border border-[var(--line)] bg-transparent px-3 text-xs"
            onFocus={(event) => event.currentTarget.select()}
            onClick={(event) => event.currentTarget.select()}
          />
        </label>

        {qr ? (
          <div className="mt-4 flex flex-col items-center gap-2 pb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt="帖子二维码"
              className="h-36 w-36 rounded-2xl bg-white p-2"
            />
            <p className="text-center text-[11px] leading-5 text-[var(--muted)]">
              用微信扫码打开后再点右上角转发；也可保存二维码发到朋友圈或小红书。
            </p>
          </div>
        ) : null}
      </div>

      {guide ? (
        <button
          type="button"
          className="absolute inset-0 z-[60] bg-black/45"
          aria-label="我知道了"
          onClick={() => setGuide(null)}
        >
          <span className="absolute right-3 top-[max(0.5rem,env(safe-area-inset-top))] max-w-[16rem] rounded-2xl bg-black/85 px-4 py-3 text-left text-sm leading-6 text-white">
            点右上角 ···
            <br />
            {guide === "moments" ? "选「分享到朋友圈」" : "选「发送给朋友」"}
            <span className="mt-2 block text-xs text-white/70">点任意处关闭提示</span>
          </span>
        </button>
      ) : null}
    </div>
  );
}

function channelMark(channel: Channel): string {
  switch (channel) {
    case "copy":
      return "链";
    case "system":
      return "系";
    case "wechat":
      return "微";
    case "moments":
      return "圈";
    case "qq":
      return "Q";
    case "qzone":
      return "空";
    case "weibo":
      return "博";
    case "douyin":
      return "抖";
    case "xhs":
      return "书";
    default:
      return "";
  }
}

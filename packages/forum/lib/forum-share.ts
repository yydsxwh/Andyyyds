/**
 * 论坛帖子外部分享：拼链接、文案、第三方网页分享地址。
 *
 * 微信/抖音/小红书没有开放「网页一点即发到 App」的接口；
 * 微信内只能引导右上角 ···，或复制/扫码后再转发。
 * QQ / QQ 空间 / 微博有公开网页分享页，可直接打开选好友。
 */

import { qqShareUrl } from "@andyyyds/shared/coupon-share";

export function resolveClientShareUrl(serverUrl: string): string {
  if (typeof window === "undefined") return serverUrl;
  try {
    const parsed = new URL(serverUrl, window.location.origin);
    return `${window.location.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return window.location.href.replace(/#.*$/, "");
  }
}

export function forumShareCaption(opts: {
  title: string;
  summary: string;
  campusName: string;
  url: string;
}): string {
  const lines = [
    opts.title.trim(),
    opts.summary.trim(),
    opts.campusName.trim() ? `来自${opts.campusName}大学论坛` : "",
    opts.url.trim(),
  ].filter(Boolean);
  return lines.join("\n");
}

export function forumQqShareUrl(opts: {
  url: string;
  title: string;
  summary: string;
  image?: string;
}): string {
  const href = qqShareUrl({
    url: opts.url,
    title: opts.title,
    summary: opts.summary,
  });
  if (!opts.image) return href;
  const u = new URL(href);
  u.searchParams.set("pics", opts.image);
  return u.toString();
}

export function forumQzoneShareUrl(opts: {
  url: string;
  title: string;
  summary: string;
  image?: string;
}): string {
  const u = new URL(
    "https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey",
  );
  u.searchParams.set("url", opts.url);
  u.searchParams.set("title", opts.title);
  u.searchParams.set("desc", opts.summary);
  u.searchParams.set("summary", opts.summary);
  if (opts.image) u.searchParams.set("pics", opts.image);
  return u.toString();
}

export function forumWeiboShareUrl(opts: {
  url: string;
  title: string;
  image?: string;
}): string {
  const u = new URL("https://service.weibo.com/share/share.php");
  u.searchParams.set("url", opts.url);
  u.searchParams.set("title", opts.title);
  if (opts.image) u.searchParams.set("pic", opts.image);
  return u.toString();
}

/**
 * 微信内 clipboard API 常被禁，且 await 后再写会丢掉点击手势。
 * 先同步 execCommand，失败再走异步 clipboard。
 */
export function copyTextSync(text: string): boolean {
  if (typeof document === "undefined") return false;
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.setAttribute("aria-hidden", "true");
  el.style.position = "fixed";
  el.style.top = "0";
  el.style.left = "0";
  el.style.width = "2em";
  el.style.height = "2em";
  el.style.padding = "0";
  el.style.border = "none";
  el.style.outline = "none";
  el.style.boxShadow = "none";
  el.style.background = "transparent";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.focus();
  el.select();
  el.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(el);
  return ok;
}

export async function copyShareText(text: string): Promise<boolean> {
  const wechat =
    typeof navigator !== "undefined" && /MicroMessenger/i.test(navigator.userAgent);

  // 非微信优先 Clipboard API；微信里它常被禁，先走同步 execCommand。
  if (!wechat) {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* 无权限时继续兜底 */
    }
  }
  if (copyTextSync(text)) return true;
  if (copyFromVisibleShareInput(text)) return true;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 微信 / 无权限 */
  }
  return false;
}

/** 从底栏可见输入框复制，部分 WebView 对隐藏 textarea 的 execCommand 会失败 */
export function copyFromVisibleShareInput(text: string): boolean {
  if (typeof document === "undefined") return false;
  const input = document.querySelector<HTMLInputElement>("[data-forum-share-url]");
  if (!input) return false;
  const prev = input.value;
  input.value = text;
  input.removeAttribute("readonly");
  input.focus();
  input.select();
  input.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  input.setAttribute("readonly", "");
  if (prev !== text) input.value = prev;
  return ok;
}

export function openSharePage(href: string): boolean {
  if (typeof document === "undefined") return false;
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

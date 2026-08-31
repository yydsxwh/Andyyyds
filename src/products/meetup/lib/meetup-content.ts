/**
 * 约搭富媒体详情：块编辑 ↔ HTML，以及入库前轻量消毒。
 * 为何不用重型编辑器：手机微信内发起约搭要快，图文视频块足够对齐「活动介绍」。
 */

export type MeetupContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; url: string; caption?: string }
  | { type: "video"; url: string };

const MAX_CONTENT_HTML_CHARS = 100_000;
const MAX_BLOCKS = 40;

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isSafeMediaUrl(url: string): boolean {
  const u = url.trim();
  if (!u || u.length > 500) return false;
  if (u.startsWith("/")) return true;
  return /^https?:\/\//i.test(u);
}

/** 是否为可内嵌的第三方视频页（微信内常见） */
function isEmbedVideoPage(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.includes("bilibili.com") ||
      host.includes("youtube.com") ||
      host.includes("youtu.be") ||
      host.includes("v.qq.com")
    );
  } catch {
    return false;
  }
}

export function meetupBlocksToHtml(blocks: MeetupContentBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks.slice(0, MAX_BLOCKS)) {
    if (block.type === "text") {
      const text = block.text.trim();
      if (!text) continue;
      const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      for (const p of paras) {
        parts.push(`<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`);
      }
      continue;
    }
    if (block.type === "image") {
      if (!isSafeMediaUrl(block.url)) continue;
      const src = escapeHtml(block.url.trim());
      const cap = block.caption?.trim()
        ? `<figcaption>${escapeHtml(block.caption.trim())}</figcaption>`
        : "";
      parts.push(`<figure><img src="${src}" alt="" loading="lazy"/>${cap}</figure>`);
      continue;
    }
    if (block.type === "video") {
      if (!isSafeMediaUrl(block.url)) continue;
      const src = block.url.trim();
      if (isEmbedVideoPage(src)) {
        parts.push(
          `<div class="meetup-video-embed"><iframe src="${escapeHtml(src)}" title="视频" allowfullscreen loading="lazy"></iframe></div>`,
        );
      } else {
        parts.push(
          `<video controls playsinline preload="metadata" src="${escapeHtml(src)}"></video>`,
        );
      }
    }
  }
  return parts.join("\n");
}

/**
 * 入库前消毒：去掉脚本与事件处理器，保留图文视频结构。
 * 发起人自填内容，仍需防 XSS 写进详情页。
 */
export function sanitizeMeetupContentHtml(html: string): string {
  let s = String(html || "").slice(0, MAX_CONTENT_HTML_CHARS);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/javascript:/gi, "");
  s = s.replace(/data:/gi, "");
  return s.trim();
}

export function parseMeetupContentBlocks(
  raw: unknown,
): MeetupContentBlock[] | null {
  if (!Array.isArray(raw)) return null;
  const blocks: MeetupContentBlock[] = [];
  for (const item of raw.slice(0, MAX_BLOCKS)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const type = String(row.type || "");
    if (type === "text") {
      blocks.push({ type: "text", text: String(row.text || "").slice(0, 8000) });
    } else if (type === "image") {
      blocks.push({
        type: "image",
        url: String(row.url || "").trim().slice(0, 500),
        caption: String(row.caption || "").trim().slice(0, 200) || undefined,
      });
    } else if (type === "video") {
      blocks.push({
        type: "video",
        url: String(row.url || "").trim().slice(0, 500),
      });
    }
  }
  return blocks;
}

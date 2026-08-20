/**
 * 汽水音乐（抖音音乐）分享链接解析：提取 track_id，并尽量取曲名/封面。
 * 无官方迷你外链；前台用 music.douyin.com/qishui/share/track iframe。
 */

export type QishuiResolveResult = {
  trackId: string;
  title: string;
  artist: string;
  coverUrl: string;
  pageUrl: string;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** 从任意文本/链接提取汽水分享短链或带 track_id 的页 */
export function extractQishuiUrlOrId(input: string): {
  url?: string;
  trackId?: string;
} {
  const s = input.trim();
  if (!s) return {};
  if (/^\d{10,}$/.test(s)) return { trackId: s };

  const short =
    /https?:\/\/qishui\.douyin\.com\/s\/[A-Za-z0-9_-]+\/?/i.exec(s) ||
    /https?:\/\/(?:www\.)?douyin\.com\/music\/[^\s]+/i.exec(s) ||
    /https?:\/\/music\.douyin\.com\/[^\s]+/i.exec(s);
  if (short?.[0]) return { url: short[0].replace(/[)，。\s]+$/, "") };

  const id =
    /[?&]track_id=(\d{10,})/i.exec(s) ||
    /track\/(\d{10,})/i.exec(s) ||
    /\/(\d{16,})\b/.exec(s);
  if (id?.[1]) return { trackId: id[1] };

  return {};
}

export function qishuiSharePageUrl(trackId: string): string {
  const id = trackId.replace(/\D/g, "");
  return `https://music.douyin.com/qishui/share/track?track_id=${id}`;
}

async function followRedirects(startUrl: string, maxHops = 8): Promise<string> {
  let url = startUrl;
  for (let i = 0; i < maxHops; i++) {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
    });
    const loc = res.headers.get("location");
    if (loc && (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308)) {
      url = new URL(loc, url).toString();
      continue;
    }
    // 已拿到最终页：若是 HTML 也返回最终 URL（body 另取）
    return url;
  }
  return url;
}

function parseTrackIdFromUrl(url: string): string | null {
  const m =
    /[?&]track_id=(\d{10,})/i.exec(url) ||
    /track_id%3D(\d{10,})/i.exec(url) ||
    /\/track\/(\d{10,})/i.exec(url);
  return m?.[1] || null;
}

function parseMetaFromHtml(html: string): {
  title: string;
  artist: string;
  coverUrl: string;
  trackId: string;
} {
  let title = "";
  let artist = "";
  let coverUrl = "";
  let trackId = "";

  const ld =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i.exec(
      html,
    );
  if (ld?.[1]) {
    try {
      const raw = ld[1].trim();
      const decoded = raw.includes("%7B") ? decodeURIComponent(raw) : raw;
      const data = JSON.parse(decoded) as {
        title?: string;
        name?: string;
        images?: string[];
        image?: string | { url?: string };
      };
      title = String(data.title || data.name || "").trim();
      if (Array.isArray(data.images) && data.images[0]) {
        coverUrl = String(data.images[0]);
      } else if (typeof data.image === "string") {
        coverUrl = data.image;
      } else if (data.image && typeof data.image === "object") {
        coverUrl = String(data.image.url || "");
      }
    } catch {
      /* ignore */
    }
  }

  const ogTitle = /property=["']og:title["']\s+content=["']([^"']+)["']/i.exec(
    html,
  ) || /content=["']([^"']+)["']\s+property=["']og:title["']/i.exec(html);
  if (!title && ogTitle?.[1]) title = ogTitle[1].trim();

  const ogImage =
    /property=["']og:image["']\s+content=["']([^"']+)["']/i.exec(html) ||
    /content=["']([^"']+)["']\s+property=["']og:image["']/i.exec(html);
  if (!coverUrl && ogImage?.[1]) coverUrl = ogImage[1].trim();

  // 《歌名》@汽水音乐 或 歌名 - 歌手
  const cleaned = title
    .replace(/@汽水音乐.*$/u, "")
    .replace(/^《|》$/gu, "")
    .trim();
  const dash = /^(.+?)\s*[-–—]\s*(.+)$/.exec(cleaned);
  if (dash) {
    title = dash[1]!.trim();
    artist = dash[2]!.trim();
  } else if (cleaned) {
    title = cleaned.replace(/^《(.+)》$/u, "$1").trim();
  }

  const idInHtml =
    /"track_id"\s*:\s*"?(\d{10,})"?/i.exec(html) ||
    /track_id=(\d{10,})/i.exec(html);
  if (idInHtml?.[1]) trackId = idInHtml[1];

  return { title, artist, coverUrl, trackId };
}

/**
 * 解析汽水分享链接或 track_id；供工作室「加入歌单」使用。
 */
export async function resolveQishuiShare(
  input: string,
): Promise<QishuiResolveResult> {
  const extracted = extractQishuiUrlOrId(input);
  let trackId = extracted.trackId || "";
  let pageUrl = "";

  if (extracted.url) {
    const finalUrl = await followRedirects(extracted.url);
    pageUrl = finalUrl;
    trackId = parseTrackIdFromUrl(finalUrl) || trackId;
  }

  if (!trackId && /^\d{10,}$/.test(input.trim())) {
    trackId = input.trim();
  }

  if (!trackId) {
    throw new Error(
      "无法识别汽水音乐链接。请粘贴 App 分享短链（qishui.douyin.com/s/…）或含 track_id 的链接",
    );
  }

  pageUrl = pageUrl || qishuiSharePageUrl(trackId);

  let title = "";
  let artist = "";
  let coverUrl = "";

  try {
    const res = await fetch(qishuiSharePageUrl(trackId), {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (res.ok) {
      const html = await res.text();
      const meta = parseMetaFromHtml(html);
      title = meta.title;
      artist = meta.artist;
      coverUrl = meta.coverUrl;
      if (meta.trackId) trackId = meta.trackId;
    }
  } catch {
    /* 页面抓取失败仍可用 track_id 入歌单 */
  }

  return {
    trackId,
    title: title || `汽水音乐 ${trackId}`,
    artist,
    coverUrl,
    pageUrl: qishuiSharePageUrl(trackId),
  };
}

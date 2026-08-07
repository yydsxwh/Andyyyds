/**
 * 微信图文图片转存：mmbiz CDN 有防盗链，浏览器带本站 Referer 会显示
 * 「此图片来自微信公众平台 未经允许不可引用」。同步时服务端下载并落到本站存储。
 */

import crypto from "crypto";
import { access, mkdir, writeFile } from "fs/promises";
import path from "path";

const OWNER_ID = "system-wechat-mp";

/**
 * 图文封面/正文图固定落本地 public/uploads，避免：
 * 1) 微信 CDN 防盗链；2) 私有 OSS 签名链无法直接嵌进 HTML。
 */

/** 同一同步任务内去重，避免一篇图文多处同一图重复下载 */
const sessionCache = new Map<string, string>();

export function isWechatMediaUrl(url: string): boolean {
  const raw = (url || "").trim();
  if (!raw || raw.startsWith("/") || raw.startsWith("data:")) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return (
      host.includes("qpic.cn") ||
      host.includes("qlogo.cn") ||
      host.includes("weixin.qq.com") ||
      host.includes("wx.qq.com")
    );
  } catch {
    return false;
  }
}

function cacheKey(url: string) {
  return url.trim().split("#")[0] || url.trim();
}

function guessExt(mime: string, sourceUrl: string): string {
  const fromMime: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
  };
  if (mime && fromMime[mime.toLowerCase().split(";")[0]!.trim()]) {
    return fromMime[mime.toLowerCase().split(";")[0]!.trim()]!;
  }
  try {
    const p = new URL(sourceUrl).pathname.toLowerCase();
    const m = p.match(/\.(jpe?g|png|gif|webp)(?:$|\ )/i);
    if (m) return `.${m[1]!.replace("jpeg", "jpg")}`;
  } catch {
    // ignore
  }
  return ".jpg";
}

async function localCacheHit(hash: string): Promise<string | null> {
  const exts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
  for (const ext of exts) {
    const rel = `/uploads/${OWNER_ID}/wx-${hash}${ext}`;
    try {
      await access(path.join(process.cwd(), "public", rel));
      return rel;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * 把微信 CDN 图转存为本站可引用地址；失败时返回原 URL（至少不阻断同步）。
 */
export async function mirrorWechatMediaUrl(sourceUrl: string): Promise<string> {
  const url = (sourceUrl || "").trim();
  if (!url) return "";
  if (url.startsWith("/uploads/")) return url;
  if (!isWechatMediaUrl(url)) return url;

  const key = cacheKey(url);
  const cached = sessionCache.get(key);
  if (cached) return cached;

  const hash = crypto
    .createHash("sha1")
    .update(key.split("?")[0] || key)
    .digest("hex")
    .slice(0, 20);

  const hit = await localCacheHit(hash);
  if (hit) {
    sessionCache.set(key, hit);
    return hit;
  }

  try {
    const res = await fetch(url, {
      headers: {
        // 服务端拉取需带公众号域 Referer，否则 CDN 也可能拒绝
        Referer: "https://mp.weixin.qq.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok) {
      sessionCache.set(key, url);
      return url;
    }
    const mime = (res.headers.get("content-type") || "image/jpeg")
      .split(";")[0]!
      .trim();
    if (!mime.startsWith("image/") && !mime.includes("octet-stream")) {
      sessionCache.set(key, url);
      return url;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 32 || buf.length > 8 * 1024 * 1024) {
      sessionCache.set(key, url);
      return url;
    }
    const ext = guessExt(mime, url);
    const dir = path.join(process.cwd(), "public", "uploads", OWNER_ID);
    await mkdir(dir, { recursive: true });
    const fileName = `wx-${hash}${ext}`;
    await writeFile(path.join(dir, fileName), buf);
    const fileUrl = `/uploads/${OWNER_ID}/${fileName}`;
    sessionCache.set(key, fileUrl);
    return fileUrl;
  } catch {
    sessionCache.set(key, url);
    return url;
  }
}

/** 正文：data-src 提升为 src，并把微信图转存 */
export async function rewriteMpContentImages(html: string): Promise<string> {
  let out = String(html || "");
  if (!out.trim()) return out;

  // 微信常把真图放在 data-src，src 是占位图
  out = out.replace(
    /<img([^>]*?)\sdata-src=(["'])(.*?)\2([^>]*)>/gi,
    (_m, pre: string, _q: string, src: string, post: string) => {
      const cleaned = `${pre} ${post}`.replace(/\ssrc=(["']).*?\1/i, "");
      return `<img${cleaned} src="${src}">`;
    },
  );

  const urls = new Set<string>();
  const srcRe = /\bsrc=(["'])(https?:\/\/[^"']+)\1/gi;
  let match: RegExpExecArray | null;
  while ((match = srcRe.exec(out)) !== null) {
    const u = match[2] || "";
    if (isWechatMediaUrl(u)) urls.add(u);
  }

  const list = [...urls].slice(0, 40);
  for (const remote of list) {
    const local = await mirrorWechatMediaUrl(remote);
    if (local && local !== remote) {
      out = out.split(remote).join(local);
    }
  }
  return out;
}

export function clearWechatMediaSessionCache() {
  sessionCache.clear();
}

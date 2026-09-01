/**
 * 外平台公开页抓取：浏览器 UA、短链跳转、og 标签、RSSHub JSON。
 * 抖音/小红书没有像公众号那样的官方「已发表列表」接口，主页同步只能尽量解析公开页或 RSS。
 */

import { personSocialUserAgent } from "@andyyyds/person/lib/person-social";

const FETCH_MS = 18000;

export async function fetchPersonSocialText(
  url: string,
  opts?: { mobile?: boolean; referer?: string },
): Promise<{ url: string; text: string; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": personSocialUserAgent(opts?.mobile ? "mobile" : "desktop"),
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        ...(opts?.referer ? { Referer: opts.referer } : {}),
      },
    });
    const text = await res.text();
    return { url: res.url || url, text, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPersonSocialJson<T>(
  url: string,
  opts?: { referer?: string; mobile?: boolean },
): Promise<T> {
  const page = await fetchPersonSocialText(url, opts);
  if (page.status >= 400) {
    throw new Error(`请求失败 ${page.status}`);
  }
  try {
    return JSON.parse(page.text) as T;
  } catch {
    throw new Error("接口返回不是 JSON");
  }
}

export type OgMeta = {
  url: string;
  title: string;
  description: string;
  image: string;
};

function metaContent(html: string, keys: string[]): string {
  for (const key of keys) {
    const prop = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
        "i",
      ),
    ];
    for (const re of patterns) {
      const match = html.match(re);
      if (match?.[1]?.trim()) return decodeHtml(match[1].trim());
    }
  }
  return "";
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\u002F/g, "/");
}

export function parseOgMeta(html: string, pageUrl: string): OgMeta {
  const title =
    metaContent(html, ["og:title", "twitter:title"]) ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
    "";
  return {
    url: pageUrl,
    title: decodeHtml(title).slice(0, 200),
    description: metaContent(html, [
      "og:description",
      "description",
      "twitter:description",
    ]).slice(0, 500),
    image: metaContent(html, ["og:image", "twitter:image"]).slice(0, 800),
  };
}

export async function fetchOgMeta(url: string, mobile = true): Promise<OgMeta> {
  const page = await fetchPersonSocialText(url, { mobile });
  return parseOgMeta(page.text, page.url);
}

function rsshubJsonItems(payload: unknown): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== "object") return [];
  const row = payload as Record<string, unknown>;
  const list = row.item || row.items;
  if (!Array.isArray(list)) return [];
  return list.filter((x) => x && typeof x === "object") as Array<
    Record<string, unknown>
  >;
}

export type RssHubItem = {
  title: string;
  url: string;
  summary: string;
  image: string;
  publishedAt: Date | null;
};

function rssDate(value: unknown): Date | null {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function rssImage(item: Record<string, unknown>): string {
  const direct = String(
    item.image || item.itunes_item_image || item.bannerImage || "",
  ).trim();
  if (direct.startsWith("http")) return direct.slice(0, 800);
  const enclosure = item.enclosure as { url?: string } | undefined;
  if (enclosure?.url?.startsWith("http")) return enclosure.url.slice(0, 800);
  const html = String(item.content_html || item.content || item.description || "");
  const img = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return img?.[1]?.startsWith("http") ? img[1].slice(0, 800) : "";
}

export async function fetchRssHubItems(
  baseUrl: string,
  routePath: string,
): Promise<RssHubItem[]> {
  const origin = (baseUrl || "https://rsshub.app").replace(/\/+$/, "");
  const path = routePath.startsWith("/") ? routePath : `/${routePath}`;
  const url = `${origin}${path}.json`;
  const payload = await fetchPersonSocialJson<unknown>(url);
  return rsshubJsonItems(payload)
    .map((item) => {
      const link = String(item.url || item.link || "").trim();
      return {
        title: String(item.title || "").trim().slice(0, 200),
        url: link.slice(0, 800),
        summary: String(item.summary || item.content_text || "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 500),
        image: rssImage(item),
        publishedAt: rssDate(item.date_published || item.pubDate || item.published),
      };
    })
    .filter((item) => item.url && item.title);
}

export function extractScriptJson(html: string, scriptId: string): unknown {
  const re = new RegExp(
    `<script[^>]*id=["']${scriptId}["'][^>]*>([\\s\\S]*?)<\\/script>`,
    "i",
  );
  const match = html.match(re);
  if (!match?.[1]) return null;
  const raw = match[1].trim();
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

export function walkUnknownStrings(
  node: unknown,
  visit: (key: string, value: unknown, parent: Record<string, unknown>) => void,
  depth = 0,
) {
  if (!node || depth > 12) return;
  if (Array.isArray(node)) {
    for (const item of node) walkUnknownStrings(item, visit, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const row = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(row)) {
    visit(key, value, row);
    if (value && typeof value === "object") {
      walkUnknownStrings(value, visit, depth + 1);
    }
  }
}

/**
 * 导入本机抓取的 mp_ingest.json
 * 用法: tsx scripts/_import_mp_json.mjs /tmp/mp_ingest.json [publishedAtISO]
 */
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import { normalizeWechatArticleUrl, sanitizeMpArticleHtml } from "../src/lib/wechat-mp-content.ts";
import {
  clearWechatMediaSessionCache,
  mirrorWechatMediaUrl,
  rewriteMpContentImages,
} from "../src/lib/wechat-mp-media.ts";

const path = process.argv[2];
const publishedAtArg = process.argv[3] || "";
if (!path) {
  console.error("Usage: tsx scripts/_import_mp_json.mjs <json> [publishedAt]");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(path, "utf8"));
const p = new PrismaClient();
clearWechatMediaSessionCache();

const title = String(raw.title || "").trim() || "未命名推文";
const digest = String(raw.digest || "").trim();
let contentHtml = String(raw.contentHtml || "");
let thumbUrl = String(raw.thumbUrl || "").trim();
const wechatUrl = String(raw.canonicalUrl || raw.inputUrl || "").trim();
const wechatUrlKey = normalizeWechatArticleUrl(wechatUrl);

if (thumbUrl && !thumbUrl.startsWith("/")) {
  thumbUrl = (await mirrorWechatMediaUrl(thumbUrl)).slice(0, 1000);
}
if (contentHtml) {
  contentHtml = (
    await rewriteMpContentImages(sanitizeMpArticleHtml(contentHtml))
  ).slice(0, 500_000);
}

const textOnly = contentHtml
  .replace(/<img\b[^>]*>/gi, "")
  .replace(/<[^>]+>/g, "")
  .trim();
const contentKind =
  /<img\b/i.test(contentHtml) && textOnly.length < 40 ? "newspic" : "news";

const existing = wechatUrlKey
  ? await p.wechatMpArticle.findFirst({
      where: { wechatUrlKey },
      select: { articleId: true, itemIndex: true },
    })
  : null;

const mid = String(raw.mid || "").trim();
const articleId =
  existing?.articleId ||
  (mid ? `datacube_${mid}_1` : "") ||
  "url_" +
    createHash("sha1")
      .update(wechatUrlKey || wechatUrl)
      .digest("hex")
      .slice(0, 24);
const itemIndex = existing?.itemIndex ?? 0;

let publishedAt = publishedAtArg ? new Date(publishedAtArg) : null;
if (!publishedAt || Number.isNaN(publishedAt.getTime())) {
  // 缺省：根据已知缺篇标题猜日期
  if (title.includes("不要被大学坑")) publishedAt = new Date("2025-11-14T04:00:00+08:00");
  else if (title.includes("教材真的很垃圾")) publishedAt = new Date("2025-11-14T04:00:00+08:00");
  else if (title.includes("概率论")) publishedAt = new Date("2023-10-17T04:00:00+08:00");
  else if (title.includes("锦鲤") || title.includes("抽奖"))
    publishedAt = new Date("2023-03-30T04:00:00+08:00");
  else if (title.includes("精神内耗")) publishedAt = new Date("2022-09-27T04:00:00+08:00");
  else publishedAt = new Date();
}

await p.wechatMpArticle.upsert({
  where: { articleId_itemIndex: { articleId, itemIndex } },
  create: {
    articleId,
    itemIndex,
    title: title.slice(0, 200),
    digest: digest.slice(0, 500),
    contentHtml,
    thumbUrl: thumbUrl.slice(0, 1000),
    wechatUrl: wechatUrl.slice(0, 1000),
    wechatUrlKey,
    publishedAt,
    syncedAt: new Date(),
    isDeleted: false,
    contentKind,
  },
  update: {
    title: title.slice(0, 200),
    digest: digest.slice(0, 500),
    ...(contentHtml.trim() ? { contentHtml } : {}),
    ...(thumbUrl ? { thumbUrl: thumbUrl.slice(0, 1000) } : {}),
    wechatUrl: wechatUrl.slice(0, 1000),
    wechatUrlKey,
    publishedAt,
    syncedAt: new Date(),
    isDeleted: false,
    contentKind,
  },
});

const row = await p.wechatMpArticle.findFirst({
  where: { articleId, itemIndex },
  select: { id: true, title: true, contentKind: true, publishedAt: true },
});
const alive = await p.wechatMpArticle.count({ where: { isDeleted: false } });
console.log(
  JSON.stringify(
    {
      ok: true,
      alive,
      id: row?.id,
      title: row?.title,
      kind: row?.contentKind,
      publishedAt: row?.publishedAt,
      body: contentHtml.length,
      thumb: Boolean(thumbUrl),
      sitePath: row?.id ? `/about/company/articles/${row.id}` : "",
    },
    null,
    2,
  ),
);
await p.$disconnect();

/**
 * 站长：公众号图文/合集同步与列表
 * GET  — 本地文章与合集概览
 * POST — action=sync_articles | add_album | refresh_album | delete_album
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";
import {
  deleteAlbumByLocalId,
  listAlbumsWithCounts,
  refreshAlbumByLocalId,
  rematchAllAlbumItems,
  syncAlbumFromSourceUrl,
} from "@/lib/wechat-mp-album";
import {
  listLocalArticles,
  syncPublishedArticles,
} from "@/lib/wechat-mp-content";

export const dynamic = "force-dynamic";

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("sync_articles") }),
  z.object({
    action: z.literal("add_album"),
    sourceUrl: z.string().min(8).max(1000),
  }),
  z.object({
    action: z.literal("refresh_album"),
    albumLocalId: z.string().min(1).max(40),
  }),
  z.object({
    action: z.literal("delete_album"),
    albumLocalId: z.string().min(1).max(40),
  }),
]);

export async function GET() {
  try {
    await requireAdmin();
    const [articles, albums, articleTotal] = await Promise.all([
      listLocalArticles(30),
      listAlbumsWithCounts(),
      prisma.wechatMpArticle.count({ where: { isDeleted: false } }),
    ]);
    return NextResponse.json({
      articleTotal,
      articles: articles.map((a) => ({
        id: a.id,
        title: a.title,
        digest: a.digest,
        thumbUrl: a.thumbUrl,
        wechatUrl: a.wechatUrl,
        publishedAt: a.publishedAt,
        syncedAt: a.syncedAt,
      })),
      albums,
    });
  } catch (error) {
    const { status, error: message } = studioErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = postSchema.parse(await request.json());

    if (body.action === "sync_articles") {
      const result = await syncPublishedArticles();
      const rematch = await rematchAllAlbumItems();
      return NextResponse.json({
        ok: true,
        message: `已同步 ${result.upserted} 篇图文（微信共 ${result.totalFromWechat} 条发布记录）；合集条目匹配 ${rematch.matchedCount}/${rematch.itemCount}`,
        ...result,
        rematch,
      });
    }

    if (body.action === "add_album") {
      const result = await syncAlbumFromSourceUrl(body.sourceUrl);
      return NextResponse.json({
        ok: true,
        message: `合集「${result.title}」已同步：${result.itemCount} 篇，已匹配本站正文 ${result.matchedCount} 篇`,
        ...result,
      });
    }

    if (body.action === "refresh_album") {
      const result = await refreshAlbumByLocalId(body.albumLocalId);
      return NextResponse.json({
        ok: true,
        message: `合集「${result.title}」已刷新：${result.itemCount} 篇，匹配 ${result.matchedCount} 篇`,
        ...result,
      });
    }

    await deleteAlbumByLocalId(body.albumLocalId);
    return NextResponse.json({ ok: true, message: "已移除合集展示" });
  } catch (error) {
    // 同步/合集业务错误直接回给站长（含微信 48001 等说明）
    if (
      error instanceof Error &&
      error.message &&
      !["UNAUTHORIZED", "ADMIN_ONLY", "FORBIDDEN", "UNKNOWN"].includes(
        error.message,
      ) &&
      !(error instanceof z.ZodError)
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const { status, error: message } = studioErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

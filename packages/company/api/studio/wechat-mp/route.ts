/**
 * 站长：公众号图文/合集同步与列表
 * GET  — 本地文章与合集概览（含置顶/排序字段）
 * POST — action=sync_articles | add_album | refresh_album | delete_album
 *        | rename_album | update_article | delete_article | reorder_articles
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@andyyyds/shared/db";
import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";
import {
  deleteAlbumByLocalId,
  listAlbumsWithCounts,
  refreshAlbumByLocalId,
  rematchAllAlbumItems,
  renameAlbumByLocalId,
  syncAlbumFromSourceUrl,
} from "@andyyyds/company/lib/wechat-mp-album";
import {
  listLocalArticles,
  patchArticleFlags,
  reorderArticles,
  softDeleteLocalArticle,
  syncPublishedArticles,
} from "@andyyyds/company/lib/wechat-mp-content";

export const dynamic = "force-dynamic";
/** 全量同步含多年群发按天扫描 + 公开页抓取，可能较久 */
export const maxDuration = 900;

/** 进程内互斥：避免站长连点打爆微信接口 / 打挂 Node */
declare global {
  // eslint-disable-next-line no-var
  var __yydsMpSyncRunning: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yydsMpSyncLastMessage: string | undefined;
}

function startBackgroundArticleSync() {
  if (globalThis.__yydsMpSyncRunning) {
    return {
      started: false as const,
      message:
        globalThis.__yydsMpSyncLastMessage ||
        "同步仍在进行中，请稍候刷新本页查看篇数，勿重复连点。",
    };
  }
  globalThis.__yydsMpSyncRunning = true;
  globalThis.__yydsMpSyncLastMessage = "后台同步进行中…";
  // 不 await：先给浏览器 200，避免 Nginx/网关先断成 502
  void (async () => {
    try {
      const result = await syncPublishedArticles();
      const rematch = await rematchAllAlbumItems();
      globalThis.__yydsMpSyncLastMessage = `已同步完成：发表 ${result.freepublishUpserted}/${result.totalFromWechat}、图文素材 ${result.materialUpserted}、发表详情 ${result.notifiedUpserted}（${result.notifiedSeen}）、群发历史 ${result.massHistoryUpserted}（${result.massHistorySeen}）；清理误入库单图 ${result.purgedImageMaterials}、同标题空壳 ${result.purgedEmptyTitleStubs}；正文补全 ${result.bodyBackfillFilled}/${result.bodyBackfillAttempted}（失败 ${result.bodyBackfillFailed}）；合集匹配 ${rematch.matchedCount}/${rematch.itemCount}。`;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "同步失败，请查看服务器日志";
      globalThis.__yydsMpSyncLastMessage = `同步失败：${msg}`;
      console.error("[wechat-mp] background sync failed", error);
    } finally {
      globalThis.__yydsMpSyncRunning = false;
    }
  })();
  return {
    started: true as const,
    message:
      "已开始后台同步（可能需数分钟）。完成后刷新本页查看「本地已存」篇数；请勿重复连点。",
  };
}

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
  z.object({
    action: z.literal("rename_album"),
    albumLocalId: z.string().min(1).max(40),
    title: z.string().trim().min(1).max(200),
  }),
  z.object({
    action: z.literal("update_article"),
    id: z.string().min(1).max(40),
    isPinned: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    contentKind: z.enum(["news", "newspic"]).optional(),
  }).refine(
    (v) =>
      v.isPinned !== undefined ||
      v.isFeatured !== undefined ||
      v.contentKind !== undefined,
    { message: "请至少指定 isPinned、isFeatured 或 contentKind" },
  ),
  z.object({
    action: z.literal("delete_article"),
    id: z.string().min(1).max(40),
  }),
  z.object({
    action: z.literal("reorder_articles"),
    orderedIds: z.array(z.string().min(1).max(40)).min(1).max(500),
  }),
]);

export async function GET() {
  try {
    await requireAdmin();
    const [articles, albums, articleTotal] = await Promise.all([
      // 后台排序需要完整列表，上限与 reorder 一致
      listLocalArticles(500),
      listAlbumsWithCounts(),
      prisma.wechatMpArticle.count({ where: { isDeleted: false } }),
    ]);
    return NextResponse.json({
      articleTotal,
      syncRunning: Boolean(globalThis.__yydsMpSyncRunning),
      syncLastMessage: globalThis.__yydsMpSyncLastMessage || "",
      articles: articles.map((a) => ({
        id: a.id,
        title: a.title,
        digest: a.digest,
        thumbUrl: a.thumbUrl,
        wechatUrl: a.wechatUrl,
        publishedAt: a.publishedAt,
        syncedAt: a.syncedAt,
        isPinned: a.isPinned,
        isFeatured: a.isFeatured,
        sortOrder: a.sortOrder,
        contentKind: a.contentKind || "news",
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
      const { started, message } = startBackgroundArticleSync();
      return NextResponse.json({
        ok: true,
        started,
        running: Boolean(globalThis.__yydsMpSyncRunning),
        message,
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

    if (body.action === "delete_album") {
      await deleteAlbumByLocalId(body.albumLocalId);
      return NextResponse.json({ ok: true, message: "已移除合集展示" });
    }

    if (body.action === "rename_album") {
      const row = await renameAlbumByLocalId(body.albumLocalId, body.title);
      return NextResponse.json({
        ok: true,
        message: `合集已命名为「${row.title}」`,
        album: row,
      });
    }

    if (body.action === "update_article") {
      const row = await patchArticleFlags(body.id, {
        isPinned: body.isPinned,
        isFeatured: body.isFeatured,
        contentKind: body.contentKind,
      });
      const parts: string[] = [];
      if (body.isPinned !== undefined) {
        parts.push(body.isPinned ? "已置顶" : "已取消置顶");
      }
      if (body.isFeatured !== undefined) {
        parts.push(body.isFeatured ? "已标精华" : "已取消精华");
      }
      if (body.contentKind !== undefined) {
        parts.push(
          body.contentKind === "newspic" ? "已标为贴图" : "已标为文章",
        );
      }
      return NextResponse.json({
        ok: true,
        message: parts.join("；") || "已更新",
        article: row,
      });
    }

    if (body.action === "delete_article") {
      const row = await softDeleteLocalArticle(body.id);
      return NextResponse.json({
        ok: true,
        message: `已删除「${row.title || "无标题"}」`,
        article: row,
      });
    }

    const result = await reorderArticles(body.orderedIds);
    return NextResponse.json({
      ok: true,
      message: `已保存 ${result.updated} 篇图文的展示次序（置顶仍优先）`,
      ...result,
    });
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

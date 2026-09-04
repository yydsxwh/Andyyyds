/**
 * 站长：个人 IP 外平台投稿同步与列表
 * GET  — 主页配置 + 本地投稿
 * POST — save_accounts | sync | ingest_urls | add/refresh/rename/delete_album | update | delete | reorder
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@andyyyds/shared/db";
import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";
import { PERSON_SOCIAL_PLATFORM_LABEL } from "@andyyyds/person/lib/person-social";
import {
  addPersonSocialAlbumFromUrl,
  deletePersonSocialAlbum,
  listPersonSocialAlbums,
  refreshPersonSocialAlbum,
  renamePersonSocialAlbum,
} from "@andyyyds/person/lib/person-social-album";
import {
  getPersonSocialAccounts,
  savePersonSocialAccounts,
} from "@andyyyds/person/lib/person-social-settings";
import {
  ingestPersonSocialUrls,
  listPersonSocialPosts,
  patchPersonSocialPost,
  reorderPersonSocialPosts,
  softDeletePersonSocialPost,
  syncPersonSocialPosts,
} from "@andyyyds/person/lib/person-social-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

declare global {
  // eslint-disable-next-line no-var
  var __yydsPersonSocialSyncRunning: boolean | undefined;
  // eslint-disable-next-line no-var
  var __yydsPersonSocialSyncLastMessage: string | undefined;
}

function startBackgroundSync() {
  if (globalThis.__yydsPersonSocialSyncRunning) {
    return {
      started: false as const,
      message:
        globalThis.__yydsPersonSocialSyncLastMessage ||
        "同步仍在进行中，请稍候刷新，勿重复连点。",
    };
  }
  globalThis.__yydsPersonSocialSyncRunning = true;
  globalThis.__yydsPersonSocialSyncLastMessage = "后台同步进行中…";
  void (async () => {
    try {
      const result = await syncPersonSocialPosts();
      globalThis.__yydsPersonSocialSyncLastMessage = result.message;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "同步失败，请查看服务器日志";
      globalThis.__yydsPersonSocialSyncLastMessage = `同步失败：${msg}`;
      console.error("[person-social] background sync failed", error);
    } finally {
      globalThis.__yydsPersonSocialSyncRunning = false;
    }
  })();
  return {
    started: true as const,
    message: "已开始后台同步。抖音/小红书若拦公开页，完成后请用作品链接补导入。",
  };
}

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save_accounts"),
    bilibili: z.string().max(400).optional(),
    douyin: z.string().max(400).optional(),
    xiaohongshu: z.string().max(400).optional(),
    wechatChannels: z.string().max(400).optional(),
    rsshubBaseUrl: z.string().max(400).optional(),
  }),
  z.object({ action: z.literal("sync") }),
  z.object({
    action: z.literal("add_album"),
    sourceUrl: z.string().min(8).max(1000),
  }),
  z.object({
    action: z.literal("refresh_album"),
    id: z.string().min(1).max(40),
  }),
  z.object({
    action: z.literal("rename_album"),
    id: z.string().min(1).max(40),
    title: z.string().min(1).max(80),
  }),
  z.object({
    action: z.literal("delete_album"),
    id: z.string().min(1).max(40),
  }),
  z.object({
    action: z.literal("ingest_urls"),
    urls: z.string().min(8).max(8000),
  }),
  z.object({
    action: z.literal("update"),
    id: z.string().min(1).max(40),
    isPinned: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
  }).refine((v) => v.isPinned !== undefined || v.isFeatured !== undefined, {
    message: "请至少指定置顶或精华",
  }),
  z.object({
    action: z.literal("delete"),
    id: z.string().min(1).max(40),
  }),
  z.object({
    action: z.literal("reorder"),
    orderedIds: z.array(z.string().min(1).max(40)).min(1).max(500),
  }),
]);

export async function GET() {
  try {
    await requireAdmin();
    const [accounts, posts, postTotal, albums] = await Promise.all([
      getPersonSocialAccounts(),
      listPersonSocialPosts(500),
      prisma.personSocialPost.count({ where: { isDeleted: false } }),
      listPersonSocialAlbums(),
    ]);
    return NextResponse.json({
      accounts,
      postTotal,
      albums: albums.map((row) => ({
        id: row.id,
        platform: row.platform,
        platformLabel:
          PERSON_SOCIAL_PLATFORM_LABEL[
            row.platform as keyof typeof PERSON_SOCIAL_PLATFORM_LABEL
          ] || row.platform,
        title: row.title,
        coverUrl: row.coverUrl,
        sourceUrl: row.sourceUrl,
        itemCount: row._count.items,
        syncedAt: row.syncedAt,
      })),
      syncRunning: Boolean(globalThis.__yydsPersonSocialSyncRunning),
      syncLastMessage: globalThis.__yydsPersonSocialSyncLastMessage || "",
      posts: posts.map((row) => ({
        id: row.id,
        platform: row.platform,
        platformLabel:
          PERSON_SOCIAL_PLATFORM_LABEL[
            row.platform as keyof typeof PERSON_SOCIAL_PLATFORM_LABEL
          ] || row.platform,
        externalId: row.externalId,
        title: row.title,
        digest: row.digest,
        coverUrl: row.coverUrl,
        sourceUrl: row.sourceUrl,
        contentKind: row.contentKind,
        publishedAt: row.publishedAt,
        syncedAt: row.syncedAt,
        isPinned: row.isPinned,
        isFeatured: row.isFeatured,
        sortOrder: row.sortOrder,
      })),
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = postSchema.parse(await request.json());

    if (body.action === "save_accounts") {
      const current = await getPersonSocialAccounts();
      const saved = await savePersonSocialAccounts({
        bilibili: body.bilibili ?? current.bilibili,
        douyin: body.douyin ?? current.douyin,
        xiaohongshu: body.xiaohongshu ?? current.xiaohongshu,
        wechatChannels: body.wechatChannels ?? current.wechatChannels,
        rsshubBaseUrl: body.rsshubBaseUrl ?? current.rsshubBaseUrl,
      });
      return NextResponse.json({ ok: true, accounts: saved, message: "主页已保存" });
    }

    if (body.action === "add_album") {
      const album = await addPersonSocialAlbumFromUrl(body.sourceUrl);
      return NextResponse.json({
        ok: true,
        album,
        message: `合集「${album.title || "未命名"}」已同步 ${album._count.items} 条`,
      });
    }

    if (body.action === "refresh_album") {
      const album = await refreshPersonSocialAlbum(body.id);
      return NextResponse.json({
        ok: true,
        album,
        message: `合集已刷新，当前 ${album._count.items} 条`,
      });
    }

    if (body.action === "rename_album") {
      await renamePersonSocialAlbum(body.id, body.title);
      return NextResponse.json({ ok: true, message: "合集名称已保存" });
    }

    if (body.action === "delete_album") {
      await deletePersonSocialAlbum(body.id);
      return NextResponse.json({ ok: true, message: "合集已移除" });
    }

    if (body.action === "sync") {
      const kick = startBackgroundSync();
      return NextResponse.json({
        ok: true,
        message: kick.message,
        syncRunning: true,
      });
    }

    if (body.action === "ingest_urls") {
      const result = await ingestPersonSocialUrls(body.urls);
      const extra = result.errors.length
        ? `；未导入 ${result.errors.length} 条：${result.errors.slice(0, 3).join("；")}`
        : "";
      return NextResponse.json({
        ok: true,
        ...result,
        message: `已导入 ${result.upserted}/${result.attempted} 条${extra}`,
      });
    }

    if (body.action === "update") {
      await patchPersonSocialPost(body.id, {
        isPinned: body.isPinned,
        isFeatured: body.isFeatured,
      });
      return NextResponse.json({ ok: true, message: "已更新" });
    }

    if (body.action === "delete") {
      await softDeletePersonSocialPost(body.id);
      return NextResponse.json({ ok: true, message: "已删除，同步不会自动恢复" });
    }

    await reorderPersonSocialPosts(body.orderedIds);
    return NextResponse.json({ ok: true, message: "次序已保存" });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

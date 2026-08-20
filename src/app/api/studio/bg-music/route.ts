import { NextResponse } from "next/server";
import { z } from "zod";
import {
  DEFAULT_BG_MUSIC,
  parseBgMusic,
  stringifyBgMusic,
  type BgMusicConfig,
  type BgMusicTrack,
} from "@/lib/bg-music";
import { prisma } from "@/lib/db";
import {
  getSiteSettings,
  invalidateSiteSettingsCache,
} from "@/lib/site-settings";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";

export const runtime = "nodejs";

const trackSchema = z.object({
  id: z.string().max(64).optional(),
  title: z.string().min(1).max(120),
  artist: z.string().max(80).optional().default(""),
  kind: z.enum(["audio", "netease", "qqmusic", "qishui"]),
  src: z.string().min(1).max(2000),
  coverUrl: z.string().max(2000).optional(),
  credit: z.string().max(200).optional(),
  source: z.enum(["upload", "url", "stock", "netease", "qqmusic", "qishui"]),
  enabled: z.boolean().optional().default(true),
});

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  loopPlaylist: z.boolean().optional(),
  defaultOpen: z.boolean().optional(),
  autoplay: z.boolean().optional(),
  tracks: z.array(trackSchema).max(80).optional(),
  jamendoClientId: z.string().max(128).optional(),
});

function newTrackId() {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET() {
  try {
    await requireAdmin();
    const row = await getSiteSettings();
    const config = parseBgMusic(row.bgMusicJson);
    return NextResponse.json({
      config,
      jamendoClientId: row.jamendoClientId || "",
      jamendoConfigured: Boolean(row.jamendoClientId?.trim()),
      guides: (await import("@/lib/bg-music")).FREE_STOCK_GUIDES,
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = patchSchema.parse(await req.json());
    const current = await getSiteSettings();
    const prev = parseBgMusic(current.bgMusicJson);

    const next: BgMusicConfig = {
      enabled: body.enabled !== undefined ? body.enabled : prev.enabled,
      loopPlaylist:
        body.loopPlaylist !== undefined
          ? body.loopPlaylist
          : prev.loopPlaylist,
      defaultOpen:
        body.defaultOpen !== undefined ? body.defaultOpen : prev.defaultOpen,
      autoplay: body.autoplay !== undefined ? body.autoplay : prev.autoplay,
      tracks:
        body.tracks !== undefined
          ? body.tracks.map((t) => {
              const track: BgMusicTrack = {
                id: t.id?.trim() || newTrackId(),
                title: t.title.trim(),
                artist: (t.artist || "").trim(),
                kind: t.kind,
                src: t.src.trim(),
                coverUrl: t.coverUrl?.trim() || undefined,
                credit: t.credit?.trim() || undefined,
                source: t.source,
                enabled: t.enabled !== false,
              };
              return track;
            })
          : prev.tracks,
    };

    const data: Record<string, string> = {
      bgMusicJson: stringifyBgMusic(next),
    };
    if (body.jamendoClientId !== undefined) {
      data.jamendoClientId = body.jamendoClientId.trim();
    }

    await prisma.siteSettings.update({
      where: { id: "default" },
      data,
    });
    invalidateSiteSettingsCache();

    const row = await getSiteSettings();
    return NextResponse.json({
      ok: true,
      config: parseBgMusic(row.bgMusicJson) || DEFAULT_BG_MUSIC,
      jamendoClientId: row.jamendoClientId || "",
      jamendoConfigured: Boolean(row.jamendoClientId?.trim()),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "参数无效" },
        { status: 400 },
      );
    }
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

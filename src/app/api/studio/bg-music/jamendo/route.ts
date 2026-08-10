/**
 * Jamendo 免版税曲目检索（需站长配置 Client ID）。
 * 不代理盗链 QQ/网易/Apple；仅官方公开 API。
 */

import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site-settings";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";

export const runtime = "nodejs";

type JamendoTrack = {
  id: string;
  name: string;
  artist_name: string;
  audio: string;
  image?: string;
  shareurl?: string;
  license_ccurl?: string;
};

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().slice(0, 80);
    if (!q) {
      return NextResponse.json({ error: "请输入搜索词" }, { status: 400 });
    }

    const settings = await getSiteSettings();
    const clientId = settings.jamendoClientId?.trim();
    if (!clientId) {
      return NextResponse.json(
        {
          error:
            "尚未配置 Jamendo Client ID。请到本页填写（免费申请：https://devportal.jamendo.com）",
        },
        { status: 400 },
      );
    }

    const url = new URL("https://api.jamendo.com/v3.0/tracks/");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "20");
    url.searchParams.set("search", q);
    url.searchParams.set("audioformat", "mp32");
    url.searchParams.set("include", "musicinfo");

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Jamendo 接口异常（HTTP ${res.status}）` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as {
      results?: JamendoTrack[];
      headers?: { status?: string; error_message?: string };
    };
    if (data.headers?.status && data.headers.status !== "success") {
      return NextResponse.json(
        {
          error:
            data.headers.error_message ||
            "Jamendo 返回失败，请检查 Client ID",
        },
        { status: 400 },
      );
    }

    const tracks = (data.results || [])
      .filter((t) => t.audio && t.name)
      .map((t) => ({
        id: String(t.id),
        title: t.name,
        artist: t.artist_name || "",
        audioUrl: t.audio,
        coverUrl: t.image || "",
        credit: t.artist_name
          ? `${t.artist_name} · Jamendo`
          : "Jamendo",
        pageUrl: t.shareurl || "",
      }));

    return NextResponse.json({ tracks });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

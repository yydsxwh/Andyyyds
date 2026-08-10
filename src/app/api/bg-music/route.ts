import { NextResponse } from "next/server";
import { getPublicBgMusicPayload } from "@/lib/site-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 前台悬浮播放器拉取歌单（无需登录） */
export async function GET() {
  try {
    const payload = await getPublicBgMusicPayload();
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

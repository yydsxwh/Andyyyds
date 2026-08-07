/**
 * GET /api/geo/tile/{z}/{x}/{y}
 * 同源代理地图瓦片：国内浏览器/微信直连 tile.openstreetmap.org 常被墙或超时（灰底），
 * 经香港机房拉取后再下发，保证约搭选点能出图；坐标仍为 WGS84，与 GPS/距离排序一致。
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA =
  "yyds-course-platform/1.0 (https://www.yydsxwh.com; meetup-map-tiles)";

/** 上游优先 Carto（风格清晰、香港机可达）；失败再试 OSM 官方 */
const UPSTREAMS = [
  (z: number, x: number, y: number) =>
    `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
  (z: number, x: number, y: number) =>
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
] as const;

function parseTilePart(raw: string, kind: "z" | "x" | "y"): number | null {
  // 允许 y.png / y@2x.png 一类扩展名，便于 Leaflet 默认路径
  const n = Number(String(raw).replace(/\.png$/i, "").replace(/@2x$/i, ""));
  if (!Number.isInteger(n) || n < 0) return null;
  if (kind === "z" && n > 19) return null;
  return n;
}

function tileInRange(z: number, x: number, y: number): boolean {
  const max = 2 ** z;
  return x < max && y < max;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z: zRaw, x: xRaw, y: yRaw } = await ctx.params;
  const z = parseTilePart(zRaw, "z");
  const x = parseTilePart(xRaw, "x");
  const y = parseTilePart(yRaw, "y");
  if (z == null || x == null || y == null || !tileInRange(z, x, y)) {
    return NextResponse.json({ error: "无效瓦片坐标" }, { status: 400 });
  }

  for (const buildUrl of UPSTREAMS) {
    try {
      const upstream = buildUrl(z, x, y);
      const res = await fetch(upstream, {
        headers: {
          "User-Agent": UA,
          Accept: "image/png,image/*;q=0.8,*/*;q=0.5",
          // Carto/OSM 部分节点会看 Referer；用站点域避免被拒
          Referer: "https://www.yydsxwh.com/",
        },
        signal: AbortSignal.timeout(8_000),
        // 不进 Next Data Cache，靠响应 Cache-Control 让浏览器/边缘缓存
        cache: "no-store",
      });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 50) continue;
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": res.headers.get("content-type") || "image/png",
          // 瓦片不变，长缓存减轻机房出网与 Node 压力
          "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
        },
      });
    } catch {
      // 尝试下一个上游
    }
  }

  return NextResponse.json({ error: "瓦片不可用" }, { status: 502 });
}

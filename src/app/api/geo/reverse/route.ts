/**
 * GET /api/geo/reverse?lat=&lng=
 * 优先高德（可反查到店名）；失败再 Nominatim。坐标按 WGS84 传入。
 */

import { NextResponse } from "next/server";
import { reverseAmapPlace } from "@/lib/amap-place";

export const dynamic = "force-dynamic";

function parseCoord(raw: string | null, kind: "lat" | "lng"): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (kind === "lat" && (n < -90 || n > 90)) return null;
  if (kind === "lng" && (n < -180 || n > 180)) return null;
  return n;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = parseCoord(url.searchParams.get("lat"), "lat");
  const lng = parseCoord(url.searchParams.get("lng"), "lng");
  if (lat == null || lng == null) {
    return NextResponse.json({ error: "无效坐标" }, { status: 400 });
  }

  try {
    const amapLabel = await reverseAmapPlace(lat, lng);
    if (amapLabel) {
      return NextResponse.json({ displayName: amapLabel, provider: "amap" });
    }
  } catch {
    // 继续 Nominatim
  }

  try {
    const nominatim = new URL("https://nominatim.openstreetmap.org/reverse");
    nominatim.searchParams.set("lat", String(lat));
    nominatim.searchParams.set("lon", String(lng));
    nominatim.searchParams.set("format", "jsonv2");
    nominatim.searchParams.set("accept-language", "zh-CN,zh");
    nominatim.searchParams.set("zoom", "18");
    nominatim.searchParams.set("addressdetails", "1");

    const res = await fetch(nominatim.toString(), {
      headers: {
        "User-Agent":
          "yyds-course-platform/1.0 (https://www.yydsxwh.com; meetup-place-picker)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "反查地址失败", displayName: null },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      display_name?: string;
      name?: string;
      address?: Record<string, string>;
    };

    const displayName = pickPlaceLabel(data);
    return NextResponse.json({
      displayName,
      raw: data.display_name || null,
      provider: "osm",
    });
  } catch {
    return NextResponse.json(
      { error: "反查地址超时或不可用", displayName: null },
      { status: 502 },
    );
  }
}

function pickPlaceLabel(data: {
  display_name?: string;
  name?: string;
  address?: Record<string, string>;
}): string | null {
  const addr = data.address || {};
  const parts = [
    addr.country === "中国" || addr.country === "中華人民共和國"
      ? null
      : addr.country,
    addr.state || addr.province,
    addr.city || addr.town || addr.municipality || addr.county,
    addr.suburb || addr.district || addr.city_district,
    addr.road || addr.pedestrian || addr.neighbourhood,
    addr.house_number,
    data.name && data.name !== addr.road ? data.name : null,
  ].filter((p): p is string => Boolean(p && String(p).trim()));

  let label = parts.length > 0 ? parts.join("") : data.display_name || null;
  if (!label) return null;
  label = label.replace(/\s+/g, " ").trim();
  if (label.length > 120) label = `${label.slice(0, 117)}...`;
  return label;
}

/**
 * GET /api/geo/search?q=&lat=&lng=
 * 地点搜索（名称 + 地址 + 坐标）。浏览器侧 Nominatim/Photon 在国内常超时，
 * 故由服务端代理；可选 lat/lng 做附近偏置，更接近打车类「搜附近再选点」。
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA =
  "yyds-course-platform/1.0 (https://www.yydsxwh.com; meetup-place-search)";

export type PlaceSearchHit = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

function parseCoord(raw: string | null, kind: "lat" | "lng"): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (kind === "lat" && (n < -90 || n > 90)) return null;
  if (kind === "lng" && (n < -180 || n > 180)) return null;
  return n;
}

function shortenAddress(text: string): string {
  let s = text.replace(/\s+/g, " ").trim();
  if (s.length > 120) s = `${s.slice(0, 117)}...`;
  return s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  if (!q) {
    return NextResponse.json({ results: [] as PlaceSearchHit[] });
  }
  if (q.length > 80) {
    return NextResponse.json({ error: "关键词过长" }, { status: 400 });
  }
  if (q.length < 2) {
    return NextResponse.json({ results: [] as PlaceSearchHit[] });
  }

  const biasLat = parseCoord(url.searchParams.get("lat"), "lat");
  const biasLng = parseCoord(url.searchParams.get("lng"), "lng");

  const nominatim = await searchNominatim(q, biasLat, biasLng);
  if (nominatim.length > 0) {
    return NextResponse.json({ results: nominatim });
  }

  // Nominatim 偶发限流时用 Photon 兜底（同样由服务端出网）
  const photon = await searchPhoton(q, biasLat, biasLng);
  return NextResponse.json({ results: photon });
}

async function searchNominatim(
  q: string,
  biasLat: number | null,
  biasLng: number | null,
): Promise<PlaceSearchHit[]> {
  try {
    const api = new URL("https://nominatim.openstreetmap.org/search");
    api.searchParams.set("q", q);
    api.searchParams.set("format", "jsonv2");
    api.searchParams.set("addressdetails", "1");
    api.searchParams.set("limit", "8");
    api.searchParams.set("accept-language", "zh-CN,zh,en");
    // 有当前视野中心时给 viewbox 偏置，但不强制 bounded，避免搜不到外地
    if (biasLat != null && biasLng != null) {
      const d = 0.35;
      api.searchParams.set(
        "viewbox",
        `${biasLng - d},${biasLat + d},${biasLng + d},${biasLat - d}`,
      );
      api.searchParams.set("bounded", "0");
    }

    const res = await fetch(api.toString(), {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return [];

    const rows = (await res.json()) as Array<{
      place_id?: number | string;
      lat?: string;
      lon?: string;
      name?: string;
      display_name?: string;
      address?: Record<string, string>;
    }>;

    const hits: PlaceSearchHit[] = [];
    for (const row of rows) {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const name =
        row.name?.trim() ||
        row.address?.amenity ||
        row.address?.tourism ||
        row.address?.building ||
        row.display_name?.split(",")[0]?.trim() ||
        "地点";
      const address = shortenAddress(row.display_name || name);
      hits.push({
        id: `nom-${row.place_id ?? `${lat},${lng}`}`,
        name,
        address,
        lat,
        lng,
      });
    }
    return hits;
  } catch {
    return [];
  }
}

async function searchPhoton(
  q: string,
  biasLat: number | null,
  biasLng: number | null,
): Promise<PlaceSearchHit[]> {
  try {
    const api = new URL("https://photon.komoot.io/api/");
    api.searchParams.set("q", q);
    api.searchParams.set("limit", "8");
    api.searchParams.set("lang", "zh");
    if (biasLat != null && biasLng != null) {
      api.searchParams.set("lat", String(biasLat));
      api.searchParams.set("lon", String(biasLng));
    }

    const res = await fetch(api.toString(), {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: {
          osm_id?: number;
          name?: string;
          street?: string;
          housenumber?: string;
          district?: string;
          city?: string;
          state?: string;
          country?: string;
          postcode?: string;
        };
      }>;
    };

    const hits: PlaceSearchHit[] = [];
    for (const f of data.features || []) {
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const [lng, lat] = coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const p = f.properties || {};
      const name = p.name?.trim() || "地点";
      const addressParts = [
        p.country,
        p.state,
        p.city,
        p.district,
        [p.street, p.housenumber].filter(Boolean).join(""),
      ].filter((x): x is string => Boolean(x && String(x).trim()));
      const address = shortenAddress(
        addressParts.length > 0 ? addressParts.join("") : name,
      );
      hits.push({
        id: `pho-${p.osm_id ?? `${lat},${lng}`}`,
        name,
        address,
        lat,
        lng,
      });
    }
    return hits;
  } catch {
    return [];
  }
}

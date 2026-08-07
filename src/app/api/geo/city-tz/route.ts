/**
 * GET /api/geo/city-tz?q=
 * 搜索城市并带出 IANA 时区：先命中本地常用表，不足再 Nominatim + geo-tz。
 * 供约搭编辑「国外局选城市时区」使用。
 */

import { NextResponse } from "next/server";
import { find } from "geo-tz";
import {
  normalizeMeetupTimeZone,
  searchMeetupTzCities,
  type MeetupTzCity,
} from "@/lib/meetup-timezone";

export const dynamic = "force-dynamic";

type CityTzHit = {
  id: string;
  labelZh: string;
  labelEn: string;
  timeZone: string;
  countryZh: string;
  source: "local" | "remote";
};

function toHit(c: MeetupTzCity, source: "local" | "remote"): CityTzHit {
  return {
    id: c.id,
    labelZh: c.labelZh,
    labelEn: c.labelEn,
    timeZone: c.timeZone,
    countryZh: c.countryZh,
    source,
  };
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (!q) {
    return NextResponse.json({
      results: searchMeetupTzCities("").map((c) => toHit(c, "local")),
    });
  }
  if (q.length > 80) {
    return NextResponse.json({ error: "关键词过长" }, { status: 400 });
  }

  // 本地库已大幅扩充（首都/省会/经济中心），优先返回本地命中
  const local = searchMeetupTzCities(q, 20).map((c) => toHit(c, "local"));
  if (local.length >= 5) {
    return NextResponse.json({ results: local });
  }

  // 本地不够时补远程：国外冷门城市也能搜到并带出时区
  const remote = await searchRemoteCities(q, 6);
  const seen = new Set(local.map((r) => `${r.timeZone}|${r.labelEn}`));
  const merged = [...local];
  for (const r of remote) {
    const key = `${r.timeZone}|${r.labelEn}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(r);
  }
  return NextResponse.json({ results: merged.slice(0, 12) });
}

async function searchRemoteCities(
  q: string,
  limit: number,
): Promise<CityTzHit[]> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("accept-language", "zh-CN,zh,en");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "yyds-course-platform/1.0 (https://www.yydsxwh.com; meetup-city-tz)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return [];

    const rows = (await res.json()) as Array<{
      lat?: string;
      lon?: string;
      name?: string;
      display_name?: string;
      address?: Record<string, string>;
      type?: string;
      class?: string;
    }>;

    const hits: CityTzHit[] = [];
    for (const row of rows) {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      let timeZone = normalizeMeetupTimeZone(find(lat, lng)[0]);
      const addr = row.address || {};
      const labelEn =
        row.name ||
        addr.city ||
        addr.town ||
        addr.village ||
        addr.state ||
        "Unknown";
      const labelZh = labelEn;
      const countryZh = addr.country || "";
      hits.push({
        id: `remote-${lat.toFixed(3)}-${lng.toFixed(3)}-${timeZone}`,
        labelZh,
        labelEn,
        timeZone,
        countryZh,
        source: "remote",
      });
    }
    return hits;
  } catch {
    return [];
  }
}

/**
 * GET /api/geo/timezone?lat=&lng=
 * 由活动坐标反查 IANA 时区（geo-tz，离线边界数据，无商业 key）。
 * 地图选点后可建议切换活动时区，避免国外局仍按北京墙钟存错。
 */

import { NextResponse } from "next/server";
import { find } from "geo-tz";
import {
  DEFAULT_MEETUP_TIMEZONE,
  meetupTimeZoneLabel,
  normalizeMeetupTimeZone,
} from "@/lib/meetup-timezone";

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
    const zones = find(lat, lng);
    const timeZone = normalizeMeetupTimeZone(zones[0] || DEFAULT_MEETUP_TIMEZONE);
    return NextResponse.json({
      timeZone,
      label: meetupTimeZoneLabel(timeZone),
      candidates: zones.slice(0, 3),
    });
  } catch {
    return NextResponse.json({
      timeZone: DEFAULT_MEETUP_TIMEZONE,
      label: meetupTimeZoneLabel(DEFAULT_MEETUP_TIMEZONE),
      candidates: [DEFAULT_MEETUP_TIMEZONE],
      fallback: true,
    });
  }
}

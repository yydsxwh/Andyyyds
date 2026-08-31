/**
 * 高德 Web 服务：国内餐厅/店铺 POI 远比 OSM 全。
 * 仅服务端调用；Key 来自站点设置或环境变量 AMAP_WEB_KEY。
 */

import { gcj02ToWgs84, wgs84ToGcj02 } from "@/lib/geo-china";
import { getSiteSettings } from "@/lib/site-settings";

type PlaceSearchHit = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

const AMAP_UA =
  "yyds-course-platform/1.0 (https://www.yydsxwh.com; amap-place)";

export async function getAmapWebKey(): Promise<string> {
  const fromEnv = process.env.AMAP_WEB_KEY?.trim() || "";
  if (fromEnv) return fromEnv;
  try {
    const settings = await getSiteSettings();
    return String(
      (settings as { amapWebKey?: string }).amapWebKey || "",
    ).trim();
  } catch {
    return "";
  }
}

function shortenAddress(text: string): string {
  let s = text.replace(/\s+/g, " ").trim();
  if (s.length > 120) s = `${s.slice(0, 117)}...`;
  return s;
}

function parseLocation(raw: string | undefined): { lat: number; lng: number } | null {
  if (!raw) return null;
  const [lngRaw, latRaw] = raw.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return gcj02ToWgs84(lat, lng);
}

type AmapPoi = {
  id?: string;
  name?: string;
  address?: string;
  location?: string;
  pname?: string;
  cityname?: string;
  adname?: string;
};

function poiToHit(poi: AmapPoi, prefix: string): PlaceSearchHit | null {
  const wgs = parseLocation(poi.location);
  if (!wgs) return null;
  const name = String(poi.name || "").trim();
  if (!name) return null;
  const address = shortenAddress(
    [poi.pname, poi.cityname, poi.adname, poi.address]
      .filter((x) => x && String(x).trim())
      .join(""),
  );
  return {
    id: `${prefix}-${poi.id || `${wgs.lat},${wgs.lng}`}`,
    name,
    address: address || name,
    lat: wgs.lat,
    lng: wgs.lng,
  };
}

async function amapGet(path: string, params: Record<string, string>) {
  const key = await getAmapWebKey();
  if (!key) return null;
  const url = new URL(`https://restapi.amap.com${path}`);
  url.searchParams.set("key", key);
  url.searchParams.set("output", "json");
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": AMAP_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

function amapOk(data: Record<string, unknown> | null): boolean {
  return Boolean(data && String(data.status) === "1");
}

export async function searchAmapPlaces(input: {
  q: string;
  city?: string;
  biasLat?: number | null;
  biasLng?: number | null;
}): Promise<PlaceSearchHit[]> {
  const keywords = input.q.trim();
  if (!keywords) return [];

  const hits: PlaceSearchHit[] = [];
  const seen = new Set<string>();

  const push = (hit: PlaceSearchHit | null) => {
    if (!hit) return;
    const key = `${hit.name}|${hit.lat.toFixed(5)}|${hit.lng.toFixed(5)}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push(hit);
  };

  // 有真实 GPS/已选点时，先搜附近 50km，店名更容易命中本城分店
  if (input.biasLat != null && input.biasLng != null) {
    const gcj = wgs84ToGcj02(input.biasLat, input.biasLng);
    const around = await amapGet("/v3/place/around", {
      keywords,
      location: `${gcj.lng},${gcj.lat}`,
      radius: "50000",
      offset: "12",
      page: "1",
      extensions: "all",
    });
    if (amapOk(around) && Array.isArray(around?.pois)) {
      for (const poi of around.pois as AmapPoi[]) {
        push(poiToHit(poi, "amap-near"));
      }
    }
  }

  const text = await amapGet("/v3/place/text", {
    keywords,
    city: input.city || "",
    citylimit: "false",
    offset: "12",
    page: "1",
    extensions: "all",
  });
  if (amapOk(text) && Array.isArray(text?.pois)) {
    for (const poi of text.pois as AmapPoi[]) {
      push(poiToHit(poi, "amap"));
    }
  }

  // 带城市仍为空时，放开城市限制再搜一次（避免 citylimit 过严）
  if (hits.length === 0 && input.city) {
    const nationwide = await amapGet("/v3/place/text", {
      keywords: `${input.city}${keywords}`,
      offset: "12",
      page: "1",
      extensions: "all",
    });
    if (amapOk(nationwide) && Array.isArray(nationwide?.pois)) {
      for (const poi of nationwide.pois as AmapPoi[]) {
        push(poiToHit(poi, "amap-all"));
      }
    }
  }

  return hits.slice(0, 12);
}

export async function reverseAmapPlace(
  lat: number,
  lng: number,
): Promise<string | null> {
  const gcj = wgs84ToGcj02(lat, lng);
  const data = await amapGet("/v3/geocode/regeo", {
    location: `${gcj.lng},${gcj.lat}`,
    radius: "150",
    extensions: "all",
    roadlevel: "0",
  });
  if (!data || !amapOk(data)) return null;
  const regeo = data.regeocode as
    | {
        formatted_address?: string;
        addressComponent?: Record<string, unknown>;
        pois?: AmapPoi[];
      }
    | undefined;
  if (!regeo) return null;

  const nearest = Array.isArray(regeo.pois) ? regeo.pois[0] : null;
  const poiName = String(nearest?.name || "").trim();
  const formatted = String(regeo.formatted_address || "").trim();
  const comp = regeo.addressComponent || {};
  const district = String(comp.district || "").trim();
  const street = String(
    (comp.streetNumber as { street?: string } | undefined)?.street ||
      comp.township ||
      "",
  ).trim();

  // 优先店名，再拼短地址，避免只拿到「某路」丢了永隆茶餐厅
  let label = "";
  if (poiName && formatted) {
    label = formatted.includes(poiName)
      ? formatted
      : `${poiName}（${formatted}）`;
  } else if (poiName) {
    label = [district, street, poiName].filter(Boolean).join("");
  } else {
    label = formatted;
  }
  label = label.replace(/\s+/g, " ").trim();
  if (!label) return null;
  if (label.length > 120) label = `${label.slice(0, 117)}...`;
  return label;
}

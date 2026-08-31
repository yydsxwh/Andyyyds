/**
 * 国内地图坐标：浏览器 GPS / OSM 瓦片是 WGS84；高德/腾讯是 GCJ-02。
 * 混用会偏几百米，搜到的店标到 OSM 上会「隔条马路」。
 */

const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

export type LatLng = { lat: number; lng: number };

export function outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(lngDelta: number, latDelta: number): number {
  let ret =
    -100.0 +
    2.0 * lngDelta +
    3.0 * latDelta +
    0.2 * latDelta * latDelta +
    0.1 * lngDelta * latDelta +
    0.2 * Math.sqrt(Math.abs(lngDelta));
  ret +=
    ((20.0 * Math.sin(6.0 * lngDelta * PI) +
      20.0 * Math.sin(2.0 * lngDelta * PI)) *
      2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(latDelta * PI) +
      40.0 * Math.sin((latDelta / 3.0) * PI)) *
      2.0) /
    3.0;
  ret +=
    ((160.0 * Math.sin((latDelta / 12.0) * PI) +
      320 * Math.sin((latDelta * PI) / 30.0)) *
      2.0) /
    3.0;
  return ret;
}

function transformLng(lngDelta: number, latDelta: number): number {
  let ret =
    300.0 +
    lngDelta +
    2.0 * latDelta +
    0.1 * lngDelta * lngDelta +
    0.1 * lngDelta * latDelta +
    0.1 * Math.sqrt(Math.abs(lngDelta));
  ret +=
    ((20.0 * Math.sin(6.0 * lngDelta * PI) +
      20.0 * Math.sin(2.0 * lngDelta * PI)) *
      2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(lngDelta * PI) +
      40.0 * Math.sin((lngDelta / 3.0) * PI)) *
      2.0) /
    3.0;
  ret +=
    ((150.0 * Math.sin((lngDelta / 12.0) * PI) +
      300.0 * Math.sin((lngDelta / 30.0) * PI)) *
      2.0) /
    3.0;
  return ret;
}

function delta(lat: number, lng: number): LatLng {
  const latDelta = lat - 35.0;
  const lngDelta = lng - 105.0;
  let dLat = transformLat(lngDelta, latDelta);
  let dLng = transformLng(lngDelta, latDelta);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return { lat: dLat, lng: dLng };
}

export function wgs84ToGcj02(lat: number, lng: number): LatLng {
  if (outOfChina(lat, lng)) return { lat, lng };
  const d = delta(lat, lng);
  return { lat: lat + d.lat, lng: lng + d.lng };
}

export function gcj02ToWgs84(lat: number, lng: number): LatLng {
  if (outOfChina(lat, lng)) return { lat, lng };
  const d = delta(lat, lng);
  return { lat: lat - d.lat, lng: lng - d.lng };
}

/** 高校名 → 搜索城市，避免「永隆茶餐厅」被偏到外省同名点 */
export function forumCampusCityHint(input: {
  name: string;
  slug: string;
}): string {
  const t = `${input.name} ${input.slug}`.toLowerCase();
  if (/中山大学|sysu|华南理工|scut|暨南|jnu|华南师范|广州大学|广外|广大/.test(t)) {
    return "广州";
  }
  if (/北京大学|pku|清华|tsinghua|人大|北航|北师/.test(t)) return "北京";
  if (/复旦|交大|同济|华师大|上海大学|sjtu/.test(t)) return "上海";
  if (/深圳大学|南科大|哈工大深圳|sust/.test(t)) return "深圳";
  if (/浙江大学|zju|杭师大/.test(t)) return "杭州";
  if (/中大深圳|sysu.*sz/.test(t)) return "深圳";
  return "";
}

const CITY_CENTERS: Record<string, LatLng> = {
  广州: { lat: 23.1291, lng: 113.2644 },
  北京: { lat: 39.9042, lng: 116.4074 },
  上海: { lat: 31.2304, lng: 121.4737 },
  深圳: { lat: 22.5431, lng: 114.0579 },
  杭州: { lat: 30.2741, lng: 120.1551 },
};

export function cityMapCenter(city: string): LatLng | null {
  const key = city.replace(/市$/, "").trim();
  return CITY_CENTERS[key] || null;
}

export const GEO_GPS_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20_000,
  maximumAge: 0,
} as const;

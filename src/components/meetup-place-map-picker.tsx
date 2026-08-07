"use client";

/**
 * 约搭活动地点地图选点。
 * 瓦片走同源 /api/geo/tile（国内直连 OSM 常灰屏）；搜索走 /api/geo/search。
 * 写入的是「活动举办地」坐标，供广场「距离最近」与浏览用户 GPS 比距；
 * 「定位到我」= 把活动地点设为发布者当前 GPS（人在场馆时快捷），不是发帖元数据。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";

export type MeetupMapPickResult = {
  latitude: number;
  longitude: number;
  /** 反查/搜索成功时的地点文案；失败为 null，由调用方保留原手填 */
  placeLabel: string | null;
};

type PlaceHit = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

type Props = {
  open: boolean;
  initialLat?: number | null;
  initialLng?: number | null;
  onClose: () => void;
  onConfirm: (result: MeetupMapPickResult) => void;
};

/** 无已有坐标时的默认视野（大致中国中部），避免空白海图 */
const DEFAULT_CENTER: [number, number] = [35.0, 105.0];
const DEFAULT_ZOOM = 4;
const PICKED_ZOOM = 16;
const SEARCH_DEBOUNCE_MS = 380;
/** 同源代理：国内微信/Chrome 不直连被墙的 OSM CDN */
const TILE_URL = "/api/geo/tile/{z}/{x}/{y}";

function roundCoord(n: number): number {
  return Number(n.toFixed(6));
}

function makePinIcon(L: typeof import("leaflet")) {
  return L.divIcon({
    className: "meetup-map-pin-wrap",
    html: `<span class="meetup-map-pin" aria-hidden="true"></span>`,
    iconSize: [28, 36],
    iconAnchor: [14, 34],
  });
}

async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/geo/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    );
    const data = (await res.json()) as { displayName?: string | null };
    if (!res.ok) return null;
    return data.displayName?.trim() || null;
  } catch {
    return null;
  }
}

export function MeetupPlaceMapPicker({
  open,
  initialLat,
  initialLng,
  onClose,
  onConfirm,
}: Props) {
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeqRef = useRef(0);

  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  /** 搜索选中时已有可靠 POI 名，确认时优先用，避免再反查丢店名 */
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [geoBusy, setGeoBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<PlaceHit[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const setPicked = useCallback((lat: number, lng: number) => {
    setPickedLat(roundCoord(lat));
    setPickedLng(roundCoord(lng));
  }, []);

  const placeOrMoveMarker = useCallback(
    async (lat: number, lng: number) => {
      const L = await import("leaflet");
      const map = mapRef.current;
      if (!map) return;
      const pinIcon = makePinIcon(L);
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], {
          draggable: true,
          icon: pinIcon,
        }).addTo(map);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current?.getLatLng();
          if (!pos) return;
          // 拖拽微调后坐标变了，原搜索文案不再可靠，确认时走反查
          setPickedLabel(null);
          setPicked(pos.lat, pos.lng);
        });
      }
    },
    [setPicked],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setHint("");
    setConfirmBusy(false);
    setGeoBusy(false);
    setSearchQuery("");
    setSearchHits([]);
    setSearchOpen(false);
    setSearchBusy(false);
    setPickedLabel(null);
    if (
      initialLat != null &&
      initialLng != null &&
      Number.isFinite(initialLat) &&
      Number.isFinite(initialLng)
    ) {
      setPickedLat(roundCoord(initialLat));
      setPickedLng(roundCoord(initialLng));
    } else {
      setPickedLat(null);
      setPickedLng(null);
    }
  }, [open, initialLat, initialLng]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let map: LeafletMap | null = null;

    async function setup() {
      const L = await import("leaflet");
      if (cancelled || !mapHostRef.current) return;

      const pinIcon = makePinIcon(L);
      const hasInitial =
        initialLat != null &&
        initialLng != null &&
        Number.isFinite(initialLat) &&
        Number.isFinite(initialLng);

      map = L.map(mapHostRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView(
        hasInitial
          ? ([initialLat!, initialLng!] as [number, number])
          : DEFAULT_CENTER,
        hasInitial ? PICKED_ZOOM : DEFAULT_ZOOM,
      );

      L.tileLayer(TILE_URL, {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);

      if (hasInitial) {
        markerRef.current = L.marker([initialLat!, initialLng!], {
          draggable: true,
          icon: pinIcon,
        }).addTo(map);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current?.getLatLng();
          if (!pos) return;
          setPickedLabel(null);
          setPicked(pos.lat, pos.lng);
        });
      }

      map.on("click", (e) => {
        const { lat, lng } = e.latlng;
        setPickedLabel(null);
        setPicked(lat, lng);
        setSearchOpen(false);
        void placeOrMoveMarker(lat, lng);
      });

      mapRef.current = map;
      setMapReady(true);
      // 弹层刚挂载时容器宽高可能为 0，需刷新瓦片布局
      requestAnimationFrame(() => {
        map?.invalidateSize();
      });
    }

    void setup();

    return () => {
      cancelled = true;
      setMapReady(false);
      markerRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      } else if (map) {
        map.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open-gated map lifecycle
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = searchQuery.trim();
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    if (q.length < 2) {
      setSearchHits([]);
      setSearchBusy(false);
      return;
    }

    // 偏置只在发请求时读取，不把坐标放进 deps，避免选点后反复搜
    searchTimerRef.current = setTimeout(() => {
      const seq = ++searchSeqRef.current;
      setSearchBusy(true);
      const biasLat =
        pickedLat ??
        (mapRef.current ? mapRef.current.getCenter().lat : null);
      const biasLng =
        pickedLng ??
        (mapRef.current ? mapRef.current.getCenter().lng : null);
      const params = new URLSearchParams({ q });
      if (biasLat != null && biasLng != null) {
        params.set("lat", String(biasLat));
        params.set("lng", String(biasLng));
      }
      void fetch(`/api/geo/search?${params.toString()}`)
        .then(async (res) => {
          const data = (await res.json()) as { results?: PlaceHit[] };
          if (seq !== searchSeqRef.current) return;
          setSearchHits(Array.isArray(data.results) ? data.results : []);
          setSearchOpen(true);
        })
        .catch(() => {
          if (seq !== searchSeqRef.current) return;
          setSearchHits([]);
          setHint("搜索暂时不可用，可直接在地图上点选");
        })
        .finally(() => {
          if (seq === searchSeqRef.current) setSearchBusy(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bias read at request time
  }, [open, searchQuery]);

  async function selectSearchHit(hit: PlaceHit) {
    setSearchOpen(false);
    setSearchHits([]);
    setSearchQuery(hit.name);
    setPicked(hit.lat, hit.lng);
    // 搜索命中带店名/地名，确认时直接回填，比纯坐标反查更贴近用户意图
    const label =
      hit.address && hit.address !== hit.name
        ? `${hit.name}（${hit.address}）`.slice(0, 120)
        : hit.name.slice(0, 120);
    setPickedLabel(label);
    setHint(`已定位到「${hit.name}」，可拖动标记微调`);
    const map = mapRef.current;
    if (map) {
      map.setView([hit.lat, hit.lng], PICKED_ZOOM);
      await placeOrMoveMarker(hit.lat, hit.lng);
      map.invalidateSize();
    }
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setHint("当前环境不支持定位，请搜索或在地图上点击选点");
      return;
    }
    setGeoBusy(true);
    setHint("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setPickedLabel(null);
          setPicked(lat, lng);
          const map = mapRef.current;
          if (map) {
            map.setView([lat, lng], PICKED_ZOOM);
            await placeOrMoveMarker(lat, lng);
            map.invalidateSize();
          }
          setGeoBusy(false);
          setHint("已定位到当前位置（将作为活动举办地坐标）");
        })();
      },
      () => {
        setGeoBusy(false);
        setHint("定位失败，请检查授权、搜索地点或直接在地图上点选");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  }

  async function handleConfirm() {
    if (pickedLat == null || pickedLng == null) {
      setHint("请先搜索地点、点击地图选点，或使用「定位到我」");
      return;
    }
    setConfirmBusy(true);
    setHint("");
    const placeLabel =
      pickedLabel?.trim() ||
      (await reverseGeocode(pickedLat, pickedLng));
    setConfirmBusy(false);
    onConfirm({
      latitude: pickedLat,
      longitude: pickedLng,
      placeLabel,
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="meetup-map-picker-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[96vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-[var(--line)] bg-[var(--bg)] shadow-xl sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2
              id="meetup-map-picker-title"
              className="text-lg font-semibold"
            >
              地图选择活动地点
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              搜索地点后选点，或点击地图/拖动标记微调；坐标用于广场「距离最近」
            </p>
          </div>
          <button
            type="button"
            className="min-h-11 shrink-0 rounded-full border border-[var(--line)] px-4 text-sm touch-manipulation"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <p
          className="border-b border-[var(--line)] bg-[var(--line)]/25 px-4 py-2.5 text-xs leading-relaxed text-[var(--ink)] sm:px-5 sm:text-sm"
          role="note"
        >
          地图与搜索供参考，请核对地点文案；精确导航请用高德/腾讯/苹果/google地图打开。
        </p>

        <div className="relative z-20 border-b border-[var(--line)] px-4 py-3 sm:px-5">
          <label className="sr-only" htmlFor="meetup-map-place-search">
            搜索地点
          </label>
          <div className="relative">
            <input
              id="meetup-map-place-search"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              className="field min-h-12 w-full touch-manipulation pr-20 text-base"
              placeholder="搜索地点，如：广州塔、附近咖啡馆"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => {
                if (searchHits.length > 0) setSearchOpen(true);
              }}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-[var(--muted)]">
              {searchBusy ? "搜索中…" : "搜索"}
            </span>
          </div>
          {searchOpen && searchHits.length > 0 ? (
            <ul
              className="absolute left-4 right-4 top-[calc(100%-0.25rem)] z-30 max-h-56 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--bg)] shadow-lg sm:left-5 sm:right-5"
              role="listbox"
              aria-label="地点搜索结果"
            >
              {searchHits.map((hit) => (
                <li key={hit.id} role="option">
                  <button
                    type="button"
                    className="flex min-h-12 w-full flex-col items-start gap-0.5 border-b border-[var(--line)] px-4 py-2.5 text-left touch-manipulation last:border-b-0 active:bg-[var(--line)]/40"
                    onClick={() => void selectSearchHit(hit)}
                  >
                    <span className="text-sm font-medium text-[var(--ink)]">
                      {hit.name}
                    </span>
                    <span className="line-clamp-2 text-xs text-[var(--muted)]">
                      {hit.address}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {searchOpen &&
          !searchBusy &&
          searchQuery.trim().length >= 2 &&
          searchHits.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              未找到匹配地点，可换个关键词或直接点地图
            </p>
          ) : null}
        </div>

        <div className="relative min-h-[240px] flex-1 bg-[#e8eef2] sm:min-h-[340px]">
          <div
            ref={mapHostRef}
            className="absolute inset-0 z-0 h-full w-full"
          />
          {!mapReady ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-[var(--muted)]">
              地图加载中…
            </div>
          ) : null}
        </div>

        <div className="space-y-3 border-t border-[var(--line)] px-4 py-3 sm:px-5 sm:py-4">
          <p className="text-sm text-[var(--ink)]">
            {pickedLat != null && pickedLng != null
              ? `已选：${pickedLat}, ${pickedLng}${
                  pickedLabel ? ` · ${pickedLabel}` : ""
                }`
              : "尚未选点 — 请搜索、点击地图或「定位到我」"}
          </p>
          {hint ? (
            <p className="text-xs text-[var(--muted)]">{hint}</p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn min-h-12 flex-1 touch-manipulation"
              disabled={geoBusy || !mapReady}
              onClick={locateMe}
            >
              {geoBusy ? "定位中…" : "定位到我"}
            </button>
            <button
              type="button"
              className="btn btn-primary min-h-12 flex-1 touch-manipulation"
              disabled={
                confirmBusy ||
                pickedLat == null ||
                pickedLng == null ||
                !mapReady
              }
              onClick={() => void handleConfirm()}
            >
              {confirmBusy ? "确认中…" : "确认选点"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

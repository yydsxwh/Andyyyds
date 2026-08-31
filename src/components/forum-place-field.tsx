"use client";

/**
 * 论坛发帖地点：复刻约搭的「地点文案 + 地图选点 + 使用当前位置」。
 * 地点可选；有坐标时与约搭一样成对保存 WGS84。
 */

import { useState } from "react";
import { MeetupPlaceMapPicker } from "@/components/meetup-place-map-picker";
import { FORUM_PLACE_MAX } from "@/lib/forum";
import { GEO_GPS_OPTIONS } from "@/lib/geo-china";

type Props = {
  place: string;
  latitude: string;
  longitude: string;
  onPlace: (value: string) => void;
  onLatitude: (value: string) => void;
  onLongitude: (value: string) => void;
  onMessage?: (value: string) => void;
  cityHint?: string;
};

export function ForumPlaceField({
  place,
  latitude,
  longitude,
  onPlace,
  onLatitude,
  onLongitude,
  onMessage,
  cityHint = "",
}: Props) {
  const [mapOpen, setMapOpen] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      onMessage?.("当前环境不支持定位，请改用「地图选点」");
      return;
    }
    setGeoBusy(true);
    onMessage?.("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        onLatitude(String(lat));
        onLongitude(String(lng));
        setGeoBusy(false);
        void fetch(
          `/api/geo/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
        )
          .then(async (res) => {
            const data = (await res.json()) as { displayName?: string | null };
            if (res.ok && data.displayName?.trim()) {
              onPlace(data.displayName.trim());
            }
          })
          .catch(() => {
            /* 反查失败不阻断，坐标仍可用 */
          });
      },
      () => {
        onMessage?.("定位失败，请检查授权或改用「地图选点」");
        setGeoBusy(false);
      },
      GEO_GPS_OPTIONS,
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="text-[var(--muted)]">地点（可选）</span>
        <input
          className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
          value={place}
          onChange={(e) => onPlace(e.target.value)}
          maxLength={FORUM_PLACE_MAX}
          placeholder={
            cityHint ? `${cityHint} + 店名或具体地点` : "城市 + 具体地点"
          }
        />
      </label>
      <p className="text-xs leading-relaxed text-[var(--muted)]">
        可搜店名。建议带城市，例如「广州 永隆茶餐厅」。地图选点会按本校城市偏置。
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="btn btn-primary min-h-12 flex-1 touch-manipulation"
          onClick={() => setMapOpen(true)}
        >
          地图选点
        </button>
        <button
          type="button"
          className="btn min-h-12 flex-1 touch-manipulation"
          disabled={geoBusy}
          onClick={useCurrentLocation}
        >
          {geoBusy ? "定位中…" : "使用当前位置"}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-transparent px-3"
          type="number"
          step="any"
          inputMode="decimal"
          value={latitude}
          onChange={(e) => onLatitude(e.target.value)}
          placeholder="纬度 lat"
          aria-label="纬度"
        />
        <input
          className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-transparent px-3"
          type="number"
          step="any"
          inputMode="decimal"
          value={longitude}
          onChange={(e) => onLongitude(e.target.value)}
          placeholder="经度 lng"
          aria-label="经度"
        />
      </div>
      <MeetupPlaceMapPicker
        open={mapOpen}
        initialLat={
          latitude.trim() !== "" && Number.isFinite(Number(latitude))
            ? Number(latitude)
            : null
        }
        initialLng={
          longitude.trim() !== "" && Number.isFinite(Number(longitude))
            ? Number(longitude)
            : null
        }
        title="地图选择地点"
        subtitle="搜店名后选点，或点击地图/拖动标记微调。国内餐厅走高德检索。"
        locateSuccessHint="已定位到当前位置"
        cityHint={cityHint}
        autoLocateOnOpen
        onClose={() => setMapOpen(false)}
        onConfirm={(result) => {
          onLatitude(String(result.latitude));
          onLongitude(String(result.longitude));
          if (result.placeLabel) onPlace(result.placeLabel);
          setMapOpen(false);
          onMessage?.("");
        }}
      />
    </div>
  );
}

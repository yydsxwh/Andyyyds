"use client";

/**
 * 约搭广场：分类 + 排序切换（触控友好，与微信内定位授权配合）。
 * 排序与 GET /api/meetup?sort= 一致；距离最近会把 lat/lng 写入 URL 供服务端排序。
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MEETUP_CATEGORIES,
  MEETUP_SORTS,
  type MeetupSortKey,
} from "@andyyyds/meetup/lib/meetup";
import { typoRoleClass, typoRoleStyle } from "@andyyyds/shared/site-typography";

type Props = {
  category: string;
  sort: MeetupSortKey;
  userLat: number | null;
  userLng: number | null;
};

function buildMeetupHref(input: {
  category?: string;
  sort?: string;
  lat?: number | null;
  lng?: number | null;
}): string {
  const params = new URLSearchParams();
  if (input.category) params.set("category", input.category);
  if (input.sort) params.set("sort", input.sort);
  if (
    typeof input.lat === "number" &&
    Number.isFinite(input.lat) &&
    typeof input.lng === "number" &&
    Number.isFinite(input.lng)
  ) {
    params.set("lat", String(input.lat));
    params.set("lng", String(input.lng));
  }
  const q = params.toString();
  return q ? `/meetup?${q}` : "/meetup";
}

export function MeetupPlazaToolbar({
  category,
  sort,
  userLat,
  userLng,
}: Props) {
  const router = useRouter();
  const [geoHint, setGeoHint] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);

  function chipClass(active: boolean) {
    return `chip touch-manipulation ${typoRoleClass("filterTag")} ${
      active ? "chip-active" : "chip-idle"
    }`;
  }

  function requestNearest() {
    setGeoHint("");
    if (!navigator.geolocation) {
      // 无定位能力时仍切到 nearest，服务端会降级按开场时间排
      router.push(
        buildMeetupHref({
          category,
          sort: "nearest",
          lat: userLat,
          lng: userLng,
        }),
      );
      setGeoHint("当前环境无法定位，已按开场时间排序");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        router.push(
          buildMeetupHref({
            category,
            sort: "nearest",
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        );
      },
      () => {
        setGeoLoading(false);
        // 拒绝授权也不崩：仍进入「距离最近」并降级排序
        router.push(
          buildMeetupHref({
            category,
            sort: "nearest",
          }),
        );
        setGeoHint("未授权定位，已按开场时间排序；授权后可按距离查看");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="mb-8 space-y-4">
      {/* 分类筛选胶囊：字号/字体走装扮「筛选标签」，窄屏可点、可换行 */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={buildMeetupHref({
            sort,
            lat: userLat,
            lng: userLng,
          })}
          className={chipClass(!category)}
          style={typoRoleStyle("filterTag")}
        >
          全部
        </Link>
        {MEETUP_CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={buildMeetupHref({
              category: c.key,
              sort,
              lat: userLat,
              lng: userLng,
            })}
            className={chipClass(category === c.key)}
            style={typoRoleStyle("filterTag")}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm text-[var(--muted)]">排序</p>
        <div className="flex flex-wrap gap-2">
          {MEETUP_SORTS.map((s) => {
            if (s.key === "nearest") {
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={requestNearest}
                  disabled={geoLoading}
                  className={chipClass(sort === "nearest")}
                  style={typoRoleStyle("filterTag")}
                >
                  {geoLoading ? "定位中…" : s.label}
                </button>
              );
            }
            return (
              <Link
                key={s.key}
                href={buildMeetupHref({
                  category,
                  sort: s.key,
                  lat: userLat,
                  lng: userLng,
                })}
                className={chipClass(sort === s.key)}
                style={typoRoleStyle("filterTag")}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
        {sort === "nearest" && (userLat == null || userLng == null) ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            {geoHint ||
              "距离最近需授权定位；无定位或活动无坐标时按开场时间排序"}
          </p>
        ) : null}
        {sort === "nearest" && geoHint && userLat != null ? (
          <p className="mt-2 text-sm text-[var(--muted)]">{geoHint}</p>
        ) : null}
        {geoHint && sort !== "nearest" ? (
          <p className="mt-2 text-sm text-[var(--muted)]">{geoHint}</p>
        ) : null}
      </div>
    </div>
  );
}

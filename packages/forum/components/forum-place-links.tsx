import { forumPlaceMapLinks } from "@andyyyds/forum/lib/forum";

/** 帖子地点：文案 + 外链导航（与约搭详情同一套地图 App） */
export function ForumPlaceLinks({
  place,
  latitude,
  longitude,
  compact = false,
}: {
  place: string;
  latitude?: number | null;
  longitude?: number | null;
  compact?: boolean;
}) {
  const text = place.trim();
  if (!text) return null;
  const links = forumPlaceMapLinks(text, latitude, longitude);
  if (compact) {
    return (
      <p className="mt-2 truncate text-xs text-[var(--muted)]">📍 {text}</p>
    );
  }
  return (
    <div className="rounded-2xl bg-[var(--line)]/30 px-4 py-3">
      <p className="text-sm font-medium">📍 {text}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        导航请用地图 App 打开并核对地点
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          className="btn btn-secondary inline-flex min-h-11 items-center px-3 text-sm"
          href={links.amap}
          target="_blank"
          rel="noopener noreferrer"
        >
          高德
        </a>
        <a
          className="btn btn-secondary inline-flex min-h-11 items-center px-3 text-sm"
          href={links.tencent}
          target="_blank"
          rel="noopener noreferrer"
        >
          腾讯
        </a>
        <a
          className="btn btn-secondary inline-flex min-h-11 items-center px-3 text-sm"
          href={links.apple}
          target="_blank"
          rel="noopener noreferrer"
        >
          苹果
        </a>
        <a
          className="btn btn-secondary inline-flex min-h-11 items-center px-3 text-sm"
          href={links.google}
          target="_blank"
          rel="noopener noreferrer"
        >
          Google
        </a>
      </div>
    </div>
  );
}

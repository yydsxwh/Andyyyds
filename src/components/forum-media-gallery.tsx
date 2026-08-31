import type { ForumMediaItem } from "@/lib/forum";

export function ForumMediaGallery({
  items,
  compact = false,
}: {
  items: ForumMediaItem[];
  compact?: boolean;
}) {
  if (items.length === 0) return null;
  const shown = compact ? items.slice(0, 3) : items;
  const extra = compact ? Math.max(0, items.length - shown.length) : 0;
  const cols =
    shown.length === 1
      ? "grid-cols-1"
      : shown.length === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <div className={`mt-3 grid gap-2 ${cols}`}>
      {shown.map((item, index) => (
        <div
          key={`${item.url}-${index}`}
          className="relative overflow-hidden rounded-2xl bg-[var(--line)]/30"
        >
          {item.kind === "video" ? (
            compact ? (
              <div className="flex aspect-square items-center justify-center text-xs text-[var(--muted)]">
                视频
              </div>
            ) : (
              <video
                src={item.url}
                className="max-h-80 w-full bg-black object-contain"
                controls
                playsInline
                preload="metadata"
              />
            )
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.url}
              alt=""
              className={
                compact
                  ? "aspect-square w-full object-cover"
                  : "max-h-96 w-full object-cover"
              }
            />
          )}
          {compact && extra > 0 && index === shown.length - 1 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm text-white">
              +{extra}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

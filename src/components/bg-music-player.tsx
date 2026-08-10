"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { neteaseEmbedSrc } from "@/lib/bg-music";

type PublicTrack = {
  id: string;
  title: string;
  artist: string;
  kind: "audio" | "netease";
  src: string;
  coverUrl?: string;
  credit?: string;
};

type Payload = {
  enabled: boolean;
  loopPlaylist: boolean;
  defaultOpen: boolean;
  tracks: PublicTrack[];
};

/**
 * QQ 空间风格悬浮播放器：点击才播放，触控友好；工作室路径不展示以免挡操作。
 */
export function BgMusicPlayer() {
  const pathname = usePathname() || "/";
  const hideOnStudio = pathname.startsWith("/studio");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [payload, setPayload] = useState<Payload | null>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hideOnStudio) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/bg-music", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Payload;
        if (cancelled) return;
        setPayload(data);
        setOpen(Boolean(data.defaultOpen));
      } catch {
        /* 静默：播放器非关键路径 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hideOnStudio]);

  const tracks = payload?.tracks || [];
  const track = tracks[index] || null;
  const visible =
    !hideOnStudio &&
    Boolean(payload?.enabled) &&
    tracks.length > 0 &&
    Boolean(track);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !track || track.kind !== "audio") return;
    el.src = track.src;
    el.load();
    if (playing) {
      void el.play().catch(() => {
        setPlaying(false);
        setError("浏览器拦截了自动播放，请再点一次播放");
      });
    }
    // 仅切换曲目时重载；playing 由按钮控制
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [track?.id, track?.src, track?.kind]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !track || track.kind !== "audio") return;
    if (playing) {
      void el.play().catch(() => {
        setPlaying(false);
        setError("无法播放该音频（链接失效或跨域）");
      });
    } else {
      el.pause();
    }
  }, [playing, track]);

  function selectTrack(i: number) {
    setError("");
    setIndex(i);
    setPlaying(true);
  }

  function togglePlay() {
    setError("");
    setPlaying((p) => !p);
  }

  function next() {
    if (!tracks.length) return;
    const loop = payload?.loopPlaylist !== false;
    setError("");
    setIndex((i) => {
      if (i + 1 < tracks.length) return i + 1;
      return loop ? 0 : i;
    });
    setPlaying(true);
  }

  function prev() {
    if (!tracks.length) return;
    setError("");
    setIndex((i) => (i <= 0 ? tracks.length - 1 : i - 1));
    setPlaying(true);
  }

  if (!visible || !track) return null;

  return (
    <div className="pointer-events-none fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-[80] flex flex-col items-end gap-2">
      <audio
        ref={audioRef}
        preload="metadata"
        onEnded={() => {
          if (payload?.loopPlaylist === false && index >= tracks.length - 1) {
            setPlaying(false);
            return;
          }
          next();
        }}
        onError={() => {
          setPlaying(false);
          setError("音频加载失败");
        }}
      />

      {open ? (
        <div className="pointer-events-auto w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg)]/95 shadow-lg backdrop-blur-md">
          <div className="flex items-start gap-3 border-b border-[var(--line)] px-3 py-3">
            {track.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.coverUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/15 text-lg text-[var(--brand)]">
                ♪
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-[var(--ink)]">
                {track.title}
              </div>
              <div className="truncate text-xs text-[var(--muted)]">
                {track.artist || track.credit || "背景音乐"}
              </div>
              {error ? (
                <p className="mt-1 text-xs text-[var(--fire-strong)]">{error}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="收起"
              className="min-h-10 min-w-10 rounded-xl text-[var(--muted)]"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          {track.kind === "netease" ? (
            <div className="px-2 py-2">
              <iframe
                title={track.title}
                src={neteaseEmbedSrc(track.src)}
                className="h-[66px] w-full border-0"
                allow="autoplay *; encrypted-media *"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 px-3 py-3">
              <button
                type="button"
                aria-label="上一首"
                className="min-h-11 min-w-11 rounded-xl border border-[var(--line)] text-sm"
                onClick={prev}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label={playing ? "暂停" : "播放"}
                className="min-h-12 min-w-16 rounded-2xl bg-[var(--brand)] px-4 text-sm font-medium text-white"
                onClick={togglePlay}
              >
                {playing ? "暂停" : "播放"}
              </button>
              <button
                type="button"
                aria-label="下一首"
                className="min-h-11 min-w-11 rounded-xl border border-[var(--line)] text-sm"
                onClick={next}
              >
                ›
              </button>
            </div>
          )}

          <ul className="max-h-40 overflow-y-auto border-t border-[var(--line)]">
            {tracks.map((t, i) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm ${
                    i === index
                      ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                      : "text-[var(--ink)]"
                  }`}
                  onClick={() => selectTrack(i)}
                >
                  <span className="w-5 shrink-0 text-xs text-[var(--muted)]">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  {t.kind === "netease" ? (
                    <span className="shrink-0 text-[10px] text-[var(--muted)]">
                      网易
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        aria-label={open ? "收起背景音乐" : "打开背景音乐"}
        aria-expanded={open}
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg)]/95 text-xl text-[var(--brand)] shadow-lg backdrop-blur-md"
        onClick={() => {
          setOpen((o) => {
            const nextOpen = !o;
            // 首次点开时尝试播放当前曲（符合「点击才播」）
            if (nextOpen && track.kind === "audio") setPlaying(true);
            return nextOpen;
          });
        }}
      >
        {playing && track.kind === "audio" ? "❚❚" : "♪"}
      </button>
    </div>
  );
}

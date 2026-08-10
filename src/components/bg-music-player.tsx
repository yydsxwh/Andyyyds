"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  coerceBgMusicTrackKind,
  isEmbedBgMusicKind,
  neteaseEmbedSrc,
  qqmusicEmbedSrc,
} from "@/lib/bg-music";

type PublicTrack = {
  id: string;
  title: string;
  artist: string;
  kind: "audio" | "netease" | "qqmusic";
  src: string;
  coverUrl?: string;
  credit?: string;
};

type Payload = {
  enabled: boolean;
  loopPlaylist: boolean;
  defaultOpen: boolean;
  autoplay: boolean;
  tracks: PublicTrack[];
};

function isWechatUa() {
  if (typeof navigator === "undefined") return false;
  return /MicroMessenger/i.test(navigator.userAgent || "");
}

function isIosUa() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

function normalizePublicTrack(t: PublicTrack): PublicTrack {
  const coerced = coerceBgMusicTrackKind(t.kind, t.src);
  return { ...t, kind: coerced.kind, src: coerced.src };
}

/**
 * QQ 空间风格悬浮播放器。
 * 收成悬浮球后：本站 <audio> / 已开播的外链 iframe 均继续播（外链用 clip 隐藏，不卸载）。
 * 登录/注册页不挂载，避免微信白屏。
 */
export function BgMusicPlayer() {
  const pathname = usePathname() || "/";
  const hideOnStudio = pathname.startsWith("/studio");
  const hideOnAuth =
    pathname.startsWith("/login") || pathname.startsWith("/register");
  const hidden = hideOnStudio || hideOnAuth;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoplayTriedRef = useRef(false);
  const unlockBoundRef = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const [payload, setPayload] = useState<Payload | null>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [awaitingGesture, setAwaitingGesture] = useState(false);
  const [wechat, setWechat] = useState(false);
  const [ios, setIos] = useState(false);
  /** 外链已加载过：收起时仍挂载 iframe，避免断播 */
  const [embedKeepAlive, setEmbedKeepAlive] = useState(false);

  useEffect(() => {
    setWechat(isWechatUa());
    setIos(isIosUa());
  }, []);

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/bg-music", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Payload;
        if (cancelled) return;
        const nextTracks = (data.tracks || []).map(normalizePublicTrack);
        setPayload({ ...data, tracks: nextTracks });
        setOpen(false);
        setEmbedKeepAlive(false);
        const audioIdx = nextTracks.findIndex((t) => t.kind === "audio");
        if (audioIdx >= 0) setIndex(audioIdx);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hidden]);

  const tracks = payload?.tracks || [];
  const track = tracks[index] || null;
  const visible =
    !hidden &&
    Boolean(payload?.enabled) &&
    tracks.length > 0 &&
    Boolean(track);

  function bindAudioEl(el: HTMLAudioElement | null) {
    audioRef.current = el;
    if (!el) return;
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    el.setAttribute("x5-playsinline", "true");
    el.setAttribute("x5-video-player-type", "h5");
  }

  /** 必须在用户手势回调里同步调用 play，否则 iOS 微信会静默失败 */
  function playAudioInGesture(): boolean {
    const el = audioRef.current;
    if (!el || !track || track.kind !== "audio") return false;
    if (!el.src || el.getAttribute("data-src") !== track.src) {
      el.setAttribute("data-src", track.src);
      el.src = track.src;
      el.load();
    }
    setAwaitingGesture(false);
    setError("");
    const p = el.play();
    if (p && typeof p.then === "function") {
      void p
        .then(() => setPlaying(true))
        .catch(() => {
          setPlaying(false);
          setAwaitingGesture(true);
          setError(
            wechat || ios
              ? "请再点一下右下角 ♪ 开始播放"
              : "浏览器拦截了自动播放，请点右下角 ♪",
          );
        });
    } else {
      setPlaying(true);
    }
    return true;
  }

  function pauseAudioInGesture() {
    audioRef.current?.pause();
    setPlaying(false);
  }

  useEffect(() => {
    if (!visible || !payload?.autoplay || !track) return;
    if (autoplayTriedRef.current) return;
    autoplayTriedRef.current = true;

    if (isEmbedBgMusicKind(track.kind)) {
      if (wechat || ios) {
        setAwaitingGesture(true);
        setError("微信内请点右下角 ♪；网易云/QQ 外链需展开后点播放，再收起可继续播");
      }
      return;
    }

    const el = audioRef.current;
    if (!el) {
      setAwaitingGesture(true);
      setError("请点右下角 ♪ 开始播放");
      return;
    }
    el.setAttribute("data-src", track.src);
    el.src = track.src;
    el.load();
    void el.play().then(
      () => setPlaying(true),
      () => {
        setPlaying(false);
        setAwaitingGesture(true);
        setError("请点右下角 ♪ 开始播放");
      },
    );
  }, [visible, payload?.autoplay, track, wechat, ios]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !track || track.kind !== "audio") return;
    if (el.getAttribute("data-src") !== track.src) {
      el.setAttribute("data-src", track.src);
      el.src = track.src;
      el.load();
    }
  }, [track?.id, track?.src, track?.kind]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !track || track.kind !== "audio") return;
    if (!playing) {
      el.pause();
      return;
    }
    void el.play().catch(() => {
      setPlaying(false);
      setAwaitingGesture(true);
      setError("请点右下角 ♪ 继续播放");
    });
  }, [playing, track]);

  useEffect(() => {
    if (!awaitingGesture) return;
    if (unlockBoundRef.current) return;
    unlockBoundRef.current = true;

    const unlock = (ev: Event) => {
      const target = ev.target as HTMLElement | null;
      if (target?.closest?.("[data-bgm-ball]")) return;
      if (track?.kind === "audio") playAudioInGesture();
      document.removeEventListener("touchend", unlock, true);
      document.removeEventListener("click", unlock, true);
      unlockBoundRef.current = false;
    };

    document.addEventListener("touchend", unlock, {
      capture: true,
      passive: true,
    });
    document.addEventListener("click", unlock, { capture: true });

    return () => {
      document.removeEventListener("touchend", unlock, true);
      document.removeEventListener("click", unlock, true);
      unlockBoundRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingGesture, track?.id, track?.kind]);

  // 切到本站音频时释放外链保活；展开外链时开启保活
  useEffect(() => {
    if (!track) return;
    if (track.kind === "audio") {
      setEmbedKeepAlive(false);
      return;
    }
    if (open) setEmbedKeepAlive(true);
  }, [track?.id, track?.kind, open]);

  function collapseToBall() {
    // 外链：先保活再收起，保证 iframe 不卸载、音乐不断
    if (track && isEmbedBgMusicKind(track.kind)) {
      setEmbedKeepAlive(true);
    }
    setOpen(false);
  }

  function selectTrack(i: number) {
    setError("");
    setAwaitingGesture(false);
    setIndex(i);
    const nextTrack = tracks[i];
    if (nextTrack?.kind === "audio") {
      setEmbedKeepAlive(false);
      setPlaying(true);
      requestAnimationFrame(() => {
        const el = audioRef.current;
        if (!el) return;
        el.setAttribute("data-src", nextTrack.src);
        el.src = nextTrack.src;
        el.load();
        void el.play().then(
          () => {
            setPlaying(true);
            setOpen(false);
          },
          () => {
            setPlaying(false);
            setError("请再点一次播放");
          },
        );
      });
      return;
    }
    // 外链：保持展开，方便在官方播放器里点播放；收起用「收起为悬浮球」
    setEmbedKeepAlive(true);
    setOpen(true);
  }

  function togglePlay() {
    if (track?.kind !== "audio") return;
    if (playing) {
      pauseAudioInGesture();
      return;
    }
    playAudioInGesture();
    setOpen(false);
  }

  function next() {
    if (!tracks.length) return;
    const loop = payload?.loopPlaylist !== false;
    setError("");
    setAwaitingGesture(false);
    setIndex((i) => {
      if (i + 1 < tracks.length) return i + 1;
      return loop ? 0 : i;
    });
    setPlaying(true);
  }

  function prev() {
    if (!tracks.length) return;
    setError("");
    setAwaitingGesture(false);
    setIndex((i) => (i <= 0 ? tracks.length - 1 : i - 1));
    setPlaying(true);
  }

  function onBallPointerDown() {
    longPressFired.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setOpen(true);
    }, 450);
  }

  function onBallPointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function onBallClick() {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (open) {
      collapseToBall();
      return;
    }
    if (track?.kind === "audio") {
      if (playing) pauseAudioInGesture();
      else playAudioInGesture();
      return;
    }
    // 外链收起态：再点球展开列表；已保活时音乐应仍在播
    setOpen(true);
    setEmbedKeepAlive(true);
  }

  if (!visible || !track) return null;

  const wantEmbedAuto = Boolean(payload?.autoplay) && !wechat && !ios;
  const embedSrc =
    track.kind === "netease"
      ? neteaseEmbedSrc(track.src, wantEmbedAuto)
      : track.kind === "qqmusic"
        ? qqmusicEmbedSrc(track.src)
        : "";
  const isEmbed = isEmbedBgMusicKind(track.kind);
  // 同一壳层切换展开/收起，iframe 不卸载，收成悬浮球后外链可继续播
  const showShell = open || (isEmbed && embedKeepAlive);
  const ballBusy =
    (playing && track.kind === "audio") || (isEmbed && embedKeepAlive);
  const hasAnyAudio = tracks.some((t) => t.kind === "audio");

  return (
    <div className="pointer-events-none fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-[80] flex flex-col items-end gap-2">
      <audio
        ref={bindAudioEl}
        preload="metadata"
        playsInline
        onEnded={() => {
          if (payload?.loopPlaylist === false && index >= tracks.length - 1) {
            setPlaying(false);
            return;
          }
          next();
        }}
        onError={() => {
          setPlaying(false);
          setError(
            "音频无法播放：请用本站上传的 MP3（网易云网页链接不能当直链）",
          );
        }}
      />

      {showShell ? (
        <div
          className={
            open
              ? "pointer-events-auto w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg)]/95 shadow-lg backdrop-blur-md"
              : "pointer-events-none h-[66px] w-[280px] overflow-hidden"
          }
          style={
            open
              ? undefined
              : {
                  position: "fixed",
                  right: 16,
                  bottom: 72,
                  // 勿用 display:none，否则会停播 iframe
                  clipPath: "inset(50%)",
                }
          }
          aria-hidden={!open}
        >
          {open ? (
            <div className="border-b border-[var(--line)]">
              <div className="flex items-start gap-3 px-3 py-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/15 text-lg text-[var(--brand)]">
                  ♪
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--ink)]">
                    {track.title}
                  </div>
                  <div className="truncate text-xs text-[var(--muted)]">
                    {track.artist || track.credit || "背景音乐"}
                  </div>
                  {error ? (
                    <p className="mt-1 text-xs text-[var(--fire-strong)]">{error}</p>
                  ) : (
                    <p className="mt-1 text-[10px] text-[var(--muted)]">
                      {isEmbed
                        ? "先在播放器里点播放，再点下方收起，音乐会继续"
                        : "本站音频收成悬浮球后仍继续播放"}
                    </p>
                  )}
                  {isEmbed && (wechat || ios) ? (
                    <p className="mt-1 text-[10px] text-[var(--muted)]">
                      微信对外链限制多
                      {hasAnyAudio
                        ? "，更稳请用「本站」MP3"
                        : "，iPhone 建议上传 MP3"}
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                aria-label="收起为悬浮球并继续播放"
                className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-[var(--line)] bg-[var(--brand)]/8 px-3 text-sm font-medium text-[var(--brand)]"
                onClick={collapseToBall}
              >
                收起为悬浮球（继续播放）
              </button>
            </div>
          ) : null}

          {isEmbed && embedSrc ? (
            <div className={open ? "border-b border-[var(--line)] px-2 py-2" : ""}>
              <iframe
                title={track.title}
                src={embedSrc}
                className="h-[66px] w-full border-0"
                allow="autoplay *; encrypted-media *"
              />
            </div>
          ) : null}

          {open && !isEmbed ? (
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
          ) : null}

          {open ? (
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
                    {t.kind === "qqmusic" ? (
                      <span className="shrink-0 text-[10px] text-[var(--muted)]">
                        QQ
                      </span>
                    ) : null}
                    {t.kind === "audio" ? (
                      <span className="shrink-0 text-[10px] text-[var(--muted)]">
                        本站
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {!open && error ? (
        <div className="pointer-events-auto max-w-[14rem] rounded-2xl border border-[var(--line)] bg-[var(--bg)]/95 px-3 py-2 text-xs text-[var(--fire-strong)] shadow-md">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        data-bgm-ball
        aria-label={
          open
            ? "收起为悬浮球并继续播放"
            : track.kind === "audio"
              ? playing
                ? "暂停背景音乐"
                : "播放背景音乐"
              : embedKeepAlive
                ? "展开列表（正在播放）"
                : "展开背景音乐"
        }
        aria-expanded={open}
        title={
          track.kind === "audio"
            ? "点按播放/暂停；长按展开列表"
            : "展开后点官方播放器；收起后继续播"
        }
        className={`pointer-events-auto flex h-14 w-14 touch-manipulation items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg)]/95 text-xl text-[var(--brand)] shadow-lg backdrop-blur-md ${
          ballBusy ? "ring-2 ring-[var(--brand)]/40" : ""
        } ${awaitingGesture ? "animate-pulse" : ""}`}
        onPointerDown={onBallPointerDown}
        onPointerUp={onBallPointerUp}
        onPointerCancel={onBallPointerUp}
        onClick={onBallClick}
      >
        {open
          ? "×"
          : playing && track.kind === "audio"
            ? "❚❚"
            : embedKeepAlive
              ? "♫"
              : "♪"}
      </button>
    </div>
  );
}

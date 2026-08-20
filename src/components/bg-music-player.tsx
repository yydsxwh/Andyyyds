"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  coerceBgMusicTrackKind,
  isEmbedBgMusicKind,
  neteaseEmbedSrc,
  qqmusicEmbedSrc,
  qishuiEmbedSrc,
} from "@/lib/bg-music";

type PublicTrack = {
  id: string;
  title: string;
  artist: string;
  kind: "audio" | "netease" | "qqmusic" | "qishui";
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
 * 进站可自动播放；悬浮球提供「播/停」与「列表」两个按钮；
 * 收起列表后外链 iframe 保活继续播；登录/注册页不挂载。
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

  const [payload, setPayload] = useState<Payload | null>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [awaitingGesture, setAwaitingGesture] = useState(false);
  const [wechat, setWechat] = useState(false);
  const [ios, setIos] = useState(false);
  /** 外链收起后仍挂载，保证继续播 */
  const [embedKeepAlive, setEmbedKeepAlive] = useState(false);
  /** 外链 iframe 是否带 auto=1（进站自动播） */
  const [embedWantAuto, setEmbedWantAuto] = useState(false);

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
        // 手机端默认收起列表，避免外链面板盖住首屏
        const narrow =
          typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
        setOpen(Boolean(data.defaultOpen) && !narrow);
        // 优先本站音频（自动播更稳）；没有再落外链
        const audioIdx = nextTracks.findIndex((t) => t.kind === "audio");
        setIndex(audioIdx >= 0 ? audioIdx : 0);
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
              ? "点一下「播放」或页面任意处开始听歌"
              : "浏览器拦截了自动播放，请点「播放」",
          );
        });
    } else {
      setPlaying(true);
    }
    return true;
  }

  function stopPlayback() {
    audioRef.current?.pause();
    setPlaying(false);
    setAwaitingGesture(false);
    setEmbedKeepAlive(false);
    setEmbedWantAuto(false);
    setError("");
  }

  function pauseOrStop() {
    if (track?.kind === "audio") {
      if (playing) {
        audioRef.current?.pause();
        setPlaying(false);
      } else {
        playAudioInGesture();
      }
      return;
    }
    // 外链：播中再点＝关闭；未挂载则展开并尝试自动播
    if (embedKeepAlive) {
      stopPlayback();
      return;
    }
    setEmbedWantAuto(true);
    setEmbedKeepAlive(true);
    setPlaying(true);
    setOpen(false);
  }

  // 进入站点自动播放（不强制展开列表）
  useEffect(() => {
    if (!visible || !payload?.autoplay || !track) return;
    if (autoplayTriedRef.current) return;
    autoplayTriedRef.current = true;
    setOpen(false);

    if (isEmbedBgMusicKind(track.kind)) {
      // 挂载官方外链并请求 auto 播放；收起态 clip 隐藏，不挡内容
      setEmbedWantAuto(true);
      setEmbedKeepAlive(true);
      setPlaying(true);
      // 手机/微信对外链 iframe 限制很严，常完全无声；本站 MP3 才稳
      if (wechat || ios) {
        setAwaitingGesture(true);
        const onlyEmbed = !tracks.some((t) => t.kind === "audio");
        setError(
          onlyEmbed
            ? "手机微信播不了网易云/QQ外链，请站长上传本站MP3"
            : "若未出声，点「列表」选「本站」曲目，或点页面任意处",
        );
        if (onlyEmbed) {
          // 仅提示，不强制展开列表（窄屏展开会挡住整页）
          const narrow =
            typeof window !== "undefined" &&
            window.matchMedia("(max-width: 640px)").matches;
          if (!narrow) setOpen(true);
        }
      }
      return;
    }

    const el = audioRef.current;
    if (!el) {
      setAwaitingGesture(true);
      setError("点一下「播放」开始听歌");
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
        setError("点一下「播放」或页面任意处开始听歌");
      },
    );
  }, [visible, payload?.autoplay, track, wechat, ios, tracks]);

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
      setError("点一下「播放」继续");
    });
  }, [playing, track]);

  // 自动播被拦：首次点击/触摸页面续播（本站音频）
  useEffect(() => {
    if (!awaitingGesture) return;
    if (unlockBoundRef.current) return;
    unlockBoundRef.current = true;

    const unlock = (ev: Event) => {
      const target = ev.target as HTMLElement | null;
      if (target?.closest?.("[data-bgm-ui]")) return;
      if (track?.kind === "audio") {
        playAudioInGesture();
      } else if (track && isEmbedBgMusicKind(track.kind)) {
        // 外链：手势后确保 iframe 已挂载
        setEmbedWantAuto(true);
        setEmbedKeepAlive(true);
        setPlaying(true);
        setAwaitingGesture(false);
        setError("");
      }
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

  useEffect(() => {
    if (!track) return;
    if (track.kind === "audio") {
      setEmbedKeepAlive(false);
      setEmbedWantAuto(false);
    }
  }, [track?.id, track?.kind]);

  function collapseList() {
    if (track && isEmbedBgMusicKind(track.kind) && playing) {
      setEmbedKeepAlive(true);
    }
    setOpen(false);
  }

  function toggleList() {
    if (open) collapseList();
    else {
      if (track && isEmbedBgMusicKind(track.kind)) setEmbedKeepAlive(true);
      setOpen(true);
    }
  }

  function selectTrack(i: number) {
    setError("");
    setAwaitingGesture(false);
    setIndex(i);
    const nextTrack = tracks[i];
    if (nextTrack?.kind === "audio") {
      setEmbedKeepAlive(false);
      setEmbedWantAuto(false);
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
            setError("请再点一次「播放」");
          },
        );
      });
      return;
    }
    setEmbedWantAuto(true);
    setEmbedKeepAlive(true);
    setPlaying(true);
    setOpen(true);
  }

  function next() {
    if (!tracks.length) return;
    const loop = payload?.loopPlaylist !== false;
    setError("");
    setAwaitingGesture(false);
    const cur = index;
    const ni = cur + 1 < tracks.length ? cur + 1 : loop ? 0 : cur;
    if (ni === cur) return;
    selectTrack(ni);
  }

  function prev() {
    if (!tracks.length) return;
    setError("");
    setAwaitingGesture(false);
    const ni = index <= 0 ? tracks.length - 1 : index - 1;
    selectTrack(ni);
  }

  if (!visible || !track) return null;

  const isEmbed = isEmbedBgMusicKind(track.kind);
  const embedSrc =
    track.kind === "netease"
      ? neteaseEmbedSrc(track.src, embedWantAuto)
      : track.kind === "qqmusic"
        ? qqmusicEmbedSrc(track.src)
        : track.kind === "qishui"
          ? qishuiEmbedSrc(track.src)
          : "";
  // 汽水无迷你外链，分享页需要更高 iframe 才能点播放
  const embedIframeClass =
    track.kind === "qishui"
      ? open
        ? "h-[min(22rem,55vh)] w-full border-0"
        : "h-[22rem] w-full border-0"
      : "h-[66px] w-full border-0";
  const showShell = open || (isEmbed && embedKeepAlive);
  const isLive =
    (playing && track.kind === "audio") || (isEmbed && embedKeepAlive);
  const hasAnyAudio = tracks.some((t) => t.kind === "audio");

  return (
    <div
      data-bgm-ui
      className="pointer-events-none fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-[80] flex flex-col items-end gap-2"
    >
      <audio
        ref={bindAudioEl}
        preload="auto"
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
          setError("音频无法播放：请用本站上传的 MP3");
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
                      收起列表后音乐继续；「关闭」才会停播
                    </p>
                  )}
                  {isEmbed && (wechat || ios) && !hasAnyAudio ? (
                    <p className="mt-1 text-[10px] leading-4 text-[var(--fire-strong)]">
                      手机微信无法稳定播放网易云/QQ/汽水外链。电脑能播不代表手机能播；请站长在「背景音乐」上传本站
                      MP3。
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-0 border-t border-[var(--line)]">
                <button
                  type="button"
                  className="min-h-11 border-r border-[var(--line)] px-2 text-sm font-medium text-[var(--brand)]"
                  onClick={collapseList}
                >
                  收起列表
                </button>
                <button
                  type="button"
                  className="min-h-11 px-2 text-sm font-medium text-[var(--fire-strong)]"
                  onClick={stopPlayback}
                >
                  关闭播放
                </button>
              </div>
            </div>
          ) : null}

          {isEmbed && embedSrc ? (
            <div className={open ? "border-b border-[var(--line)] px-2 py-2" : ""}>
              <iframe
                title={track.title}
                src={embedSrc}
                className={embedIframeClass}
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
                onClick={() => {
                  if (playing) {
                    audioRef.current?.pause();
                    setPlaying(false);
                  } else {
                    playAudioInGesture();
                  }
                }}
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
                    {t.kind === "qishui" ? (
                      <span className="shrink-0 text-[10px] text-[var(--muted)]">
                        汽水
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

      {/* 收起态：列表 + 播/停 两个明确按钮 */}
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          data-bgm-ui
          aria-label={open ? "收起列表" : "展开列表"}
          aria-expanded={open}
          className="flex h-12 min-w-12 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg)]/95 px-3 text-sm font-medium text-[var(--ink)] shadow-lg backdrop-blur-md"
          onClick={toggleList}
        >
          {open ? "收起" : "列表"}
        </button>
        <button
          type="button"
          data-bgm-ui
          aria-label={
            isLive
              ? track.kind === "audio"
                ? playing
                  ? "暂停"
                  : "播放"
                : "关闭播放"
              : "播放"
          }
          title={track.title}
          className={`flex h-14 w-14 touch-manipulation items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg)]/95 text-xl text-[var(--brand)] shadow-lg backdrop-blur-md ${
            isLive ? "ring-2 ring-[var(--brand)]/40" : ""
          } ${awaitingGesture ? "animate-pulse" : ""}`}
          onClick={pauseOrStop}
        >
          {isLive
            ? track.kind === "audio"
              ? playing
                ? "❚❚"
                : "♪"
              : "■"
            : "♪"}
        </button>
      </div>
    </div>
  );
}

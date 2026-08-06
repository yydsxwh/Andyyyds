"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Lesson = {
  id: string;
  title: string;
  type: "VIDEO" | "ARTICLE" | "LIVE";
  content: string;
  videoUrl: string;
  isPreview: boolean;
  durationSec: number;
  liveAt: string | null;
};

type Chapter = {
  id: string;
  title: string;
  lessons: Lesson[];
};

type Props = {
  courseTitle: string;
  chapters: Chapter[];
  canAccessAll: boolean;
  initialLessonId?: string;
  progressMap: Record<string, { completed: boolean; positionSec: number }>;
  enrollmentId?: string;
};

export function LearnPlayer({
  courseTitle,
  chapters,
  canAccessAll,
  initialLessonId,
  progressMap,
  enrollmentId,
}: Props) {
  const router = useRouter();
  const flat = useMemo(() => chapters.flatMap((c) => c.lessons), [chapters]);
  const [activeId, setActiveId] = useState(initialLessonId || flat[0]?.id);
  const active = flat.find((l) => l.id === activeId) || flat[0];
  const locked = active ? !(canAccessAll || active.isPreview) : true;
  const [playSrc, setPlaySrc] = useState("");
  const [playError, setPlayError] = useState("");
  /** CSS 伪横屏全屏（不依赖系统旋转权限） */
  const [landscapeFs, setLandscapeFs] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadPlayUrl() {
      if (!active || locked || active.type !== "VIDEO" || !active.videoUrl) {
        setPlaySrc("");
        setPlayError("");
        return;
      }
      // 点播与私有 OSS 均走服务端签发，避免直链 403
      setPlaySrc("");
      setPlayError("");
      const res = await fetch(`/api/media/play?lessonId=${active.id}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setPlayError(data.error || "获取播放地址失败");
        return;
      }
      setPlaySrc(data.playUrl || "");
    }
    void loadPlayUrl();
    return () => {
      cancelled = true;
    };
  }, [active, locked]);

  // 切课时退出伪全屏，避免旧视频仍盖住页面
  useEffect(() => {
    setLandscapeFs(false);
  }, [activeId]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (landscapeFs) {
      root.classList.add("learn-landscape-fs");
      body.classList.add("learn-landscape-fs");
    } else {
      root.classList.remove("learn-landscape-fs");
      body.classList.remove("learn-landscape-fs");
    }
    return () => {
      root.classList.remove("learn-landscape-fs");
      body.classList.remove("learn-landscape-fs");
    };
  }, [landscapeFs]);

  useEffect(() => {
    if (!landscapeFs) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLandscapeFs(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [landscapeFs]);

  async function markComplete() {
    if (!enrollmentId || !active) return;
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollmentId,
        lessonId: active.id,
        completed: true,
      }),
    });
    router.refresh();
  }

  /**
   * 横屏全屏：用 CSS 把播放器旋成横屏铺满（不依赖系统「竖屏锁定」）。
   * iPhone 点原生全屏按钮时常仍锁竖屏，所以单独提供此入口。
   */
  function enterLandscapeFullscreen() {
    setLandscapeFs(true);
    void videoRef.current?.play().catch(() => undefined);
  }

  function exitLandscapeFullscreen() {
    setLandscapeFs(false);
  }

  if (!active) {
    return <p className="text-[var(--muted)]">暂无课时</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.35fr_0.75fr]">
      <div className="space-y-4">
        <div
          className="learn-video-shell surface overflow-hidden rounded-[28px]"
          data-landscape-fs={landscapeFs ? "1" : "0"}
        >
          {locked ? (
            <div className="flex aspect-video items-center justify-center bg-[var(--bg-deep)] p-8 text-center">
              <div>
                <p className="text-lg font-medium">本课需购买后学习</p>
                <button className="btn btn-primary mt-4" onClick={() => router.push("/courses")} type="button">
                  返回课程广场
                </button>
              </div>
            </div>
          ) : active.type === "VIDEO" && active.videoUrl ? (
            playError ? (
              <div className="flex aspect-video items-center justify-center bg-[var(--bg-deep)] p-8 text-center text-sm text-red-700">
                {playError}
              </div>
            ) : playSrc ? (
              <>
                <video
                  key={playSrc}
                  ref={videoRef}
                  className="aspect-video w-full bg-black"
                  controls
                  playsInline
                  preload="metadata"
                  src={playSrc}
                  onError={() =>
                    setPlayError(
                      "视频无法播放：文件可能已失效，请联系老师重新上传素材",
                    )
                  }
                  // 微信 Android X5：允许横屏全屏；iOS 仍靠下方「横屏全屏」按钮
                  {...{
                    "webkit-playsinline": "true",
                    "x5-playsinline": "true",
                    "x5-video-player-type": "h5",
                    "x5-video-player-fullscreen": "true",
                    "x5-video-orientation": "landscape",
                  }}
                />
                {landscapeFs ? (
                  <button
                    type="button"
                    className="learn-fs-exit"
                    onClick={exitLandscapeFullscreen}
                  >
                    退出全屏
                  </button>
                ) : (
                  <button
                    type="button"
                    className="learn-fs-enter"
                    onClick={enterLandscapeFullscreen}
                  >
                    横屏全屏
                  </button>
                )}
              </>
            ) : (
              <div className="flex aspect-video items-center justify-center bg-[var(--bg-deep)] text-sm text-[var(--muted)]">
                正在加载播放地址…
              </div>
            )
          ) : active.type === "VIDEO" && !active.videoUrl ? (
            <div className="flex aspect-video items-center justify-center bg-[var(--bg-deep)] p-8 text-center text-sm text-[var(--muted)]">
              本课时尚未绑定视频，请老师在课程编辑中选择素材
            </div>
          ) : active.type === "LIVE" ? (
            <div className="flex aspect-video items-center justify-center bg-[var(--bg-deep)] p-8 text-center">
              <div>
                <p className="text-lg font-medium">直播课 · {active.title}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {active.liveAt
                    ? `计划开播：${new Date(active.liveAt).toLocaleString("zh-CN")}`
                    : "开播时间待定"}
                </p>
              </div>
            </div>
          ) : (
            <div className="min-h-[280px] p-8 leading-8">{active.content}</div>
          )}
        </div>
        <div className="surface rounded-[28px] p-6">
          <p className="text-sm text-[var(--muted)]">{courseTitle}</p>
          <h1 className="mt-1 text-2xl font-semibold">{active.title}</h1>
          {!locked && active.content ? (
            <p className="mt-4 leading-7 text-[var(--muted)]">{active.content}</p>
          ) : null}
          {canAccessAll && enrollmentId ? (
            <button className="btn btn-secondary mt-4" onClick={markComplete} type="button">
              标记已学完
            </button>
          ) : null}
        </div>
      </div>

      <aside className="surface h-fit rounded-[28px] p-5">
        <h2 className="font-semibold">目录</h2>
        <div className="mt-4 space-y-4">
          {chapters.map((chapter) => (
            <div key={chapter.id}>
              <div className="text-sm font-medium">{chapter.title}</div>
              <ul className="mt-2 space-y-1">
                {chapter.lessons.map((lesson) => {
                  const done = progressMap[lesson.id]?.completed;
                  const isActive = lesson.id === active.id;
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(lesson.id)}
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                          isActive ? "bg-[var(--brand)] text-white" : "hover:bg-white/70"
                        }`}
                      >
                        {lesson.title}
                        {done ? " · 已学" : ""}
                        {!canAccessAll && !lesson.isPreview ? " · 锁" : ""}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

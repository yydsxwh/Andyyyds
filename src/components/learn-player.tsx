"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isLessonFileType,
  lessonNeedsAccessUrl,
  lessonTypeLabel,
} from "@/lib/lesson-kinds";
import { formatBytes } from "@/lib/media";

type LessonResource = {
  id: string;
  title: string;
  fileName: string;
  sizeBytes: number;
};

type Lesson = {
  id: string;
  title: string;
  type: string;
  content: string;
  videoUrl: string;
  isPreview: boolean;
  durationSec: number;
  liveAt: string | null;
  fileName?: string;
  fileSizeBytes?: number;
  resources?: LessonResource[];
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
  /** MATERIAL：资料包走预览/下载，不按视频课交互 */
  productType?: string;
  /**
   * 防录屏弱水印：叠学员姓名 + 截断 id / 脱敏手机，
   * 无法防专业盗版，但可提高传播追责成本。
   */
  watermarkText?: string;
};

export function LearnPlayer({
  courseTitle,
  chapters,
  canAccessAll,
  initialLessonId,
  progressMap,
  enrollmentId,
  productType = "COURSE",
  watermarkText = "",
}: Props) {
  const router = useRouter();
  const isMaterial = productType === "MATERIAL";
  const flat = useMemo(() => chapters.flatMap((c) => c.lessons), [chapters]);
  const [activeId, setActiveId] = useState(initialLessonId || flat[0]?.id);
  const active = flat.find((l) => l.id === activeId) || flat[0];
  const locked = active ? !(canAccessAll || active.isPreview) : true;
  const [accessUrl, setAccessUrl] = useState("");
  const [accessError, setAccessError] = useState("");
  /** CSS 伪横屏全屏（不依赖系统旋转权限） */
  const [landscapeFs, setLandscapeFs] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  /** 视频节点挂载后再上报进度（accessUrl 刚就绪时 ref 可能仍为空） */
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const progressMapRef = useRef(progressMap);
  progressMapRef.current = progressMap;

  useEffect(() => {
    let cancelled = false;
    async function loadAccessUrl() {
      if (!active || locked || !lessonNeedsAccessUrl(active.type)) {
        setAccessUrl("");
        setAccessError("");
        return;
      }
      // 无绑定地址时不请求（视频缺素材 / 资料缺文件）
      if (!active.videoUrl && active.type === "VIDEO") {
        setAccessUrl("");
        setAccessError("");
        return;
      }
      setAccessUrl("");
      setAccessError("");
      const res = await fetch(`/api/media/play?lessonId=${active.id}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        playUrl?: string;
      };
      if (cancelled) return;
      if (!res.ok) {
        setAccessError(
          data.error ||
            (isMaterial ? "获取资料地址失败" : "获取播放地址失败"),
        );
        return;
      }
      setAccessUrl(data.playUrl || "");
    }
    void loadAccessUrl();
    return () => {
      cancelled = true;
    };
  }, [active, locked, isMaterial]);

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

  /**
   * 视频课：定期上报播放位置与有效观看时长，供站长/老师/商家看学习进度。
   * 仅正放且跳跃 < 3s 时累加时长，避免拖进度条刷时长。
   */
  useEffect(() => {
    if (
      !enrollmentId ||
      !active ||
      locked ||
      active.type !== "VIDEO" ||
      !accessUrl ||
      !videoEl
    ) {
      return;
    }
    const video = videoEl;

    const lessonId = active.id;
    let lastCurrent = video.currentTime || 0;
    let pendingDelta = 0;
    let lastFlushAt = 0;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const savedPos = progressMapRef.current[lessonId]?.positionSec || 0;
    if (savedPos > 2) {
      const seek = () => {
        try {
          if (
            Number.isFinite(savedPos) &&
            savedPos < (video.duration || Infinity)
          ) {
            video.currentTime = savedPos;
            lastCurrent = savedPos;
          }
        } catch {
          /* ignore */
        }
      };
      if (video.readyState >= 1) seek();
      else video.addEventListener("loadedmetadata", seek, { once: true });
    }

    function flush() {
      const positionSec = Math.floor(video.currentTime || 0);
      const watchedDelta = Math.floor(pendingDelta);
      pendingDelta = 0;
      lastFlushAt = Date.now();
      if (watchedDelta <= 0 && positionSec <= 0) return;
      void fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId,
          lessonId,
          positionSec,
          watchedDelta: watchedDelta > 0 ? watchedDelta : undefined,
        }),
      });
    }

    function scheduleFlush() {
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
      }, 12000);
    }

    function onTimeUpdate() {
      const t = video.currentTime || 0;
      if (t > lastCurrent && t - lastCurrent < 3) {
        pendingDelta += t - lastCurrent;
      }
      lastCurrent = t;
      if (Date.now() - lastFlushAt >= 15000 || pendingDelta >= 20) {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        flush();
      } else {
        scheduleFlush();
      }
    }

    function onPause() {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flush();
    }

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("pause", onPause);
    window.addEventListener("pagehide", onPause);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("pause", onPause);
      window.removeEventListener("pagehide", onPause);
      if (flushTimer) clearTimeout(flushTimer);
      flush();
    };
  }, [enrollmentId, active?.id, active?.type, locked, accessUrl, videoEl]);

  async function markComplete() {
    if (!enrollmentId || !active) return;
    const positionSec = Math.floor(videoRef.current?.currentTime || 0);
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollmentId,
        lessonId: active.id,
        completed: true,
        positionSec: positionSec > 0 ? positionSec : undefined,
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
    return (
      <p className="text-[var(--muted)]">
        {isMaterial ? "暂无资料文件" : "暂无课时"}
      </p>
    );
  }

  const fileKind = isLessonFileType(active.type);
  const plazaHref = isMaterial ? "/materials" : "/courses";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.35fr_0.75fr]">
      <div className="space-y-4">
        <div
          className="learn-video-shell surface overflow-hidden rounded-[28px]"
          data-landscape-fs={landscapeFs ? "1" : "0"}
        >
          {locked ? (
            <div className="flex min-h-[240px] aspect-video items-center justify-center bg-[var(--bg-deep)] p-8 text-center">
              <div>
                <p className="text-lg font-medium">
                  {isMaterial
                    ? "本资料需购买后查看 / 下载"
                    : "本课需购买后学习"}
                </p>
                <button
                  className="btn btn-primary mt-4"
                  onClick={() => router.push(plazaHref)}
                  type="button"
                >
                  {isMaterial ? "返回资料广场" : "返回课程广场"}
                </button>
              </div>
            </div>
          ) : fileKind ? (
            <FileLessonPane
              lesson={active}
              accessUrl={accessUrl}
              accessError={accessError}
            />
          ) : active.type === "VIDEO" && active.videoUrl ? (
            accessError ? (
              <div className="flex aspect-video items-center justify-center bg-[var(--bg-deep)] p-8 text-center text-sm text-red-700">
                {accessError}
              </div>
            ) : accessUrl ? (
              <div className="relative">
                <video
                  key={accessUrl}
                  ref={(el) => {
                    videoRef.current = el;
                    setVideoEl(el);
                  }}
                  className="aspect-video w-full bg-black"
                  controls
                  playsInline
                  preload="metadata"
                  src={accessUrl}
                  onError={() =>
                    setAccessError(
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
                {/* 学员水印：CSS 叠加，录屏/截图带身份便于追责（非 DRM） */}
                {watermarkText ? (
                  <div
                    className="learn-watermark pointer-events-none absolute inset-0 overflow-hidden"
                    aria-hidden
                  >
                    <div className="learn-watermark-tile">
                      {Array.from({ length: 18 }, (_, i) => (
                        <span key={i}>{watermarkText}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
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
              </div>
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
            <div className="min-h-[280px] p-8 leading-8">
              {active.content || "暂无内容"}
            </div>
          )}
        </div>
        <div className="surface rounded-[28px] p-6">
          <p className="text-sm text-[var(--muted)]">{courseTitle}</p>
          <h1 className="mt-1 text-2xl font-semibold">{active.title}</h1>
          {!locked && active.content ? (
            <p className="mt-4 leading-7 text-[var(--muted)]">{active.content}</p>
          ) : null}
          {canAccessAll && enrollmentId ? (
            <button
              className="btn btn-secondary mt-4"
              onClick={() => void markComplete()}
              type="button"
            >
              {isMaterial ? "标记已查看" : "标记已学完"}
            </button>
          ) : null}

          {!locked && (active.resources?.length || 0) > 0 ? (
            <div className="mt-5 border-t border-[var(--line)] pt-4">
              <h3 className="text-sm font-semibold">本课课件</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                下载需登录且已报名；链接短时有效，请勿转发。
              </p>
              <ul className="mt-3 space-y-2">
                {active.resources!.map((r) => (
                  <li key={r.id}>
                    <a
                      href={`/api/learn/resources/${r.id}/download`}
                      className="btn btn-secondary flex min-h-11 w-full items-center justify-between gap-2 px-4 text-left text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {r.title}
                        <span className="mt-0.5 block truncate text-xs opacity-80">
                          {r.fileName}
                          {r.sizeBytes > 0
                            ? ` · ${formatBytes(r.sizeBytes)}`
                            : ""}
                        </span>
                      </span>
                      <span className="shrink-0">下载</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="surface h-fit rounded-[28px] p-5">
        <h2 className="font-semibold">
          {isMaterial ? "资料目录" : "目录"}
        </h2>
        <div className="mt-4 space-y-4">
          {chapters.map((chapter) => (
            <div key={chapter.id}>
              <div className="text-sm font-medium">{chapter.title}</div>
              <ul className="mt-2 space-y-1">
                {chapter.lessons.map((lesson) => {
                  const done = progressMap[lesson.id]?.completed;
                  const isActive = lesson.id === active.id;
                  const kindLabel = lessonTypeLabel(lesson.type);
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(lesson.id)}
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                          isActive
                            ? "bg-[var(--brand)] text-white"
                            : "hover:bg-white/70"
                        }`}
                      >
                        <span className="block">{lesson.title}</span>
                        <span
                          className={`mt-0.5 block text-xs ${
                            isActive ? "text-white/80" : "text-[var(--muted)]"
                          }`}
                        >
                          {kindLabel}
                          {done
                            ? isMaterial
                              ? " · 已看"
                              : " · 已学"
                            : ""}
                          {!canAccessAll && !lesson.isPreview ? " · 锁" : ""}
                          {lesson.isPreview && !canAccessAll ? " · 试看" : ""}
                        </span>
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

/** 资料文件：预览图片/音频，文档与其他提供打开与下载 */
function FileLessonPane({
  lesson,
  accessUrl,
  accessError,
}: {
  lesson: Lesson;
  accessUrl: string;
  accessError: string;
}) {
  const sizeLabel =
    lesson.fileSizeBytes && lesson.fileSizeBytes > 0
      ? formatBytes(lesson.fileSizeBytes)
      : "";
  const typeLabel = lessonTypeLabel(lesson.type);

  if (accessError) {
    return (
      <div className="flex min-h-[240px] items-center justify-center bg-[var(--bg-deep)] p-8 text-center text-sm text-red-700">
        {accessError}
      </div>
    );
  }

  if (!accessUrl) {
    return (
      <div className="flex min-h-[240px] items-center justify-center bg-[var(--bg-deep)] text-sm text-[var(--muted)]">
        正在准备文件地址…
      </div>
    );
  }

  if (lesson.type === "IMAGE") {
    return (
      <div className="space-y-4 bg-[var(--bg-deep)] p-4 sm:p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={accessUrl}
          alt={lesson.title}
          className="mx-auto max-h-[70vh] w-auto max-w-full rounded-xl object-contain"
        />
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href={accessUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary min-h-11"
          >
            新窗口打开
          </a>
          <a
            href={accessUrl}
            download={lesson.fileName || lesson.title}
            className="btn btn-secondary min-h-11"
          >
            下载图片
          </a>
        </div>
      </div>
    );
  }

  if (lesson.type === "AUDIO") {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 bg-[var(--bg-deep)] p-8">
        <p className="text-sm text-[var(--muted)]">
          {typeLabel}
          {sizeLabel ? ` · ${sizeLabel}` : ""}
        </p>
        <audio
          key={accessUrl}
          className="w-full max-w-lg"
          controls
          preload="metadata"
          src={accessUrl}
        />
        <a
          href={accessUrl}
          download={lesson.fileName || lesson.title}
          className="btn btn-secondary min-h-11"
        >
          下载音频
        </a>
      </div>
    );
  }

  // DOCUMENT / OTHER：预览（新窗口）+ 下载；PDF 等浏览器可内嵌打开
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 bg-[var(--bg-deep)] p-8 text-center">
      <p className="text-lg font-medium">{lesson.title}</p>
      <p className="text-sm text-[var(--muted)]">
        {typeLabel}
        {sizeLabel ? ` · ${sizeLabel}` : ""}
        {lesson.fileName ? ` · ${lesson.fileName}` : ""}
      </p>
      <p className="max-w-md text-sm text-[var(--muted)]">
        可在线打开预览，或下载到手机 / 电脑本地查看。
      </p>
      <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
        <a
          href={accessUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary min-h-11 flex-1"
        >
          预览 / 打开
        </a>
        <a
          href={accessUrl}
          download={lesson.fileName || lesson.title}
          className="btn btn-secondary min-h-11 flex-1"
        >
          下载文件
        </a>
      </div>
    </div>
  );
}

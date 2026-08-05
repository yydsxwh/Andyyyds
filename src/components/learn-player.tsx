"use client";

import { useMemo, useState } from "react";
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

  if (!active) {
    return <p className="text-[var(--muted)]">暂无课时</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.35fr_0.75fr]">
      <div className="space-y-4">
        <div className="surface overflow-hidden rounded-[28px]">
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
            <video className="aspect-video w-full bg-black" controls src={active.videoUrl} />
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

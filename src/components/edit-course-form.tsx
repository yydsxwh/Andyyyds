"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MediaAssetPickerModal,
  type PickerMediaAsset,
} from "@/components/media-asset-picker-modal";
import { PRODUCT_TITLE_MAX } from "@/lib/media";

type MediaOption = {
  id: string;
  name: string;
  fileUrl: string;
  durationSec: number;
};

type LessonDraft = {
  key: string;
  id?: string;
  title: string;
  sortOrder: number;
  type: "VIDEO" | "ARTICLE" | "LIVE";
  content: string;
  videoUrl: string;
  durationSec: number;
  isPreview: boolean;
  mediaAssetId: string | null;
};

type ChapterDraft = {
  key: string;
  id?: string;
  title: string;
  sortOrder: number;
  lessons: LessonDraft[];
};

export type EditableCourse = {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  price: number;
  coverUrl: string;
  status: string;
  productType: string;
  chapters: Array<{
    id: string;
    title: string;
    sortOrder: number;
    lessons: Array<{
      id: string;
      title: string;
      sortOrder: number;
      type: string;
      content: string;
      videoUrl: string;
      durationSec: number;
      isPreview: boolean;
      mediaAssetId: string | null;
    }>;
  }>;
};

type Props = {
  course: EditableCourse;
  mediaAssets: MediaOption[];
};

const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";

function newKey(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function toDrafts(course: EditableCourse): ChapterDraft[] {
  return course.chapters.map((c, ci) => ({
    key: c.id,
    id: c.id,
    title: c.title,
    sortOrder: c.sortOrder || ci + 1,
    lessons: c.lessons.map((l, li) => ({
      key: l.id,
      id: l.id,
      title: l.title,
      sortOrder: l.sortOrder || li + 1,
      type: (["VIDEO", "ARTICLE", "LIVE"].includes(l.type)
        ? l.type
        : "VIDEO") as LessonDraft["type"],
      content: l.content || "",
      videoUrl: l.videoUrl || "",
      durationSec: l.durationSec || 0,
      isPreview: Boolean(l.isPreview),
      mediaAssetId: l.mediaAssetId,
    })),
  }));
}

export function EditCourseForm({ course, mediaAssets }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(course.title);
  const [subtitle, setSubtitle] = useState(course.subtitle || "");
  const [description, setDescription] = useState(course.description || "");
  const [price, setPrice] = useState(
    String(Number((course.price / 100).toFixed(2))),
  );
  const [coverUrl, setCoverUrl] = useState(course.coverUrl || "");
  const [slug, setSlug] = useState(course.slug);
  const [productType, setProductType] = useState<"COURSE" | "COLUMN">(
    course.productType === "COLUMN" ? "COLUMN" : "COURSE",
  );
  const [published, setPublished] = useState(course.status === "PUBLISHED");
  const [chapters, setChapters] = useState<ChapterDraft[]>(() =>
    toDrafts(course),
  );
  const [assetCatalog, setAssetCatalog] = useState<MediaOption[]>(mediaAssets);
  const [pickerTarget, setPickerTarget] = useState<{
    chapterKey: string;
    lessonKey: string;
    mediaAssetId: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const kind = productType === "COLUMN" ? "专栏" : "课程";
  const mediaMap = useMemo(
    () => Object.fromEntries(assetCatalog.map((m) => [m.id, m])),
    [assetCatalog],
  );

  function updateChapter(key: string, partial: Partial<ChapterDraft>) {
    setChapters((list) =>
      list.map((c) => (c.key === key ? { ...c, ...partial } : c)),
    );
  }

  function updateLesson(
    chapterKey: string,
    lessonKey: string,
    partial: Partial<LessonDraft>,
  ) {
    setChapters((list) =>
      list.map((c) => {
        if (c.key !== chapterKey) return c;
        return {
          ...c,
          lessons: c.lessons.map((l) =>
            l.key === lessonKey ? { ...l, ...partial } : l,
          ),
        };
      }),
    );
  }

  function moveChapter(key: string, dir: -1 | 1) {
    setChapters((list) => {
      const idx = list.findIndex((c) => c.key === key);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= list.length) return list;
      const copy = [...list];
      const [item] = copy.splice(idx, 1);
      copy.splice(next, 0, item);
      return copy.map((c, i) => ({ ...c, sortOrder: i + 1 }));
    });
  }

  function moveLesson(chapterKey: string, lessonKey: string, dir: -1 | 1) {
    setChapters((list) =>
      list.map((c) => {
        if (c.key !== chapterKey) return c;
        const idx = c.lessons.findIndex((l) => l.key === lessonKey);
        const next = idx + dir;
        if (idx < 0 || next < 0 || next >= c.lessons.length) return c;
        const lessons = [...c.lessons];
        const [item] = lessons.splice(idx, 1);
        lessons.splice(next, 0, item);
        return {
          ...c,
          lessons: lessons.map((l, i) => ({ ...l, sortOrder: i + 1 })),
        };
      }),
    );
  }

  function addChapter() {
    setChapters((list) => [
      ...list,
      {
        key: newKey("ch"),
        title: `第${list.length + 1}章`,
        sortOrder: list.length + 1,
        lessons: [],
      },
    ]);
  }

  function removeChapter(key: string) {
    if (!confirm("确定删除该章节及其全部课时？")) return;
    setChapters((list) =>
      list
        .filter((c) => c.key !== key)
        .map((c, i) => ({ ...c, sortOrder: i + 1 })),
    );
  }

  function addLesson(chapterKey: string) {
    setChapters((list) =>
      list.map((c) => {
        if (c.key !== chapterKey) return c;
        return {
          ...c,
          lessons: [
            ...c.lessons,
            {
              key: newKey("ls"),
              title: `课时 ${c.lessons.length + 1}`,
              sortOrder: c.lessons.length + 1,
              type: "VIDEO",
              content: "",
              videoUrl: "",
              durationSec: 0,
              isPreview: c.lessons.length === 0,
              mediaAssetId: null,
            },
          ],
        };
      }),
    );
  }

  function removeLesson(chapterKey: string, lessonKey: string) {
    setChapters((list) =>
      list.map((c) => {
        if (c.key !== chapterKey) return c;
        return {
          ...c,
          lessons: c.lessons
            .filter((l) => l.key !== lessonKey)
            .map((l, i) => ({ ...l, sortOrder: i + 1 })),
        };
      }),
    );
  }

  function rememberAsset(asset: PickerMediaAsset) {
    setAssetCatalog((prev) => {
      if (prev.some((m) => m.id === asset.id)) {
        return prev.map((m) =>
          m.id === asset.id
            ? {
                id: asset.id,
                name: asset.name,
                fileUrl: asset.fileUrl,
                durationSec: asset.durationSec || 0,
              }
            : m,
        );
      }
      return [
        ...prev,
        {
          id: asset.id,
          name: asset.name,
          fileUrl: asset.fileUrl,
          durationSec: asset.durationSec || 0,
        },
      ];
    });
  }

  function bindMedia(
    chapterKey: string,
    lessonKey: string,
    asset: PickerMediaAsset | null,
  ) {
    if (asset) rememberAsset(asset);
    updateLesson(chapterKey, lessonKey, {
      mediaAssetId: asset?.id || null,
      videoUrl: asset?.fileUrl || "",
      durationSec: asset?.durationSec || 0,
      ...(asset?.name ? { title: asset.name } : {}),
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    if (trimmedTitle.length < 2) {
      setError("标题至少需要 2 个字");
      return;
    }
    if (trimmedDesc.length < 2) {
      setError("介绍至少需要 2 个字");
      return;
    }
    const priceNum = Number(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError("请填写有效价格");
      return;
    }
    if (chapters.length === 0) {
      setError("请至少保留一个章节");
      return;
    }
    for (const ch of chapters) {
      if (!ch.title.trim()) {
        setError("章节标题不能为空");
        return;
      }
      for (const ls of ch.lessons) {
        if (!ls.title.trim()) {
          setError(`章节「${ch.title}」里有课时标题为空`);
          return;
        }
      }
    }

    setLoading(true);
    setError("");
    setMessage("");
    const res = await fetch(`/api/studio/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: trimmedTitle,
        subtitle: subtitle.trim(),
        description: trimmedDesc,
        price: priceNum,
        coverUrl: coverUrl.trim(),
        slug: slug.trim(),
        productType,
        status: published ? "PUBLISHED" : "DRAFT",
        chapters: chapters.map((c, ci) => ({
          id: c.id,
          title: c.title.trim(),
          sortOrder: ci + 1,
          lessons: c.lessons.map((l, li) => ({
            id: l.id,
            title: l.title.trim(),
            sortOrder: li + 1,
            type: l.type,
            content: l.content,
            videoUrl: l.videoUrl,
            durationSec: l.durationSec,
            isPreview: l.isPreview,
            mediaAssetId: l.mediaAssetId,
          })),
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "保存失败");
      return;
    }
    if (data.course) {
      setSlug(data.course.slug);
      setChapters(toDrafts(data.course));
    }
    setMessage("全部信息已保存，前台即时生效");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-6">
      <div className="surface space-y-4 rounded-[28px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">编辑{kind}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              可改基础信息、章节目录、课时视频与试看设置。
            </p>
          </div>
        <Link href="/studio/courses" className="btn btn-secondary px-4 py-2 text-sm">
          返回课程中心
        </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn ${productType === "COURSE" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProductType("COURSE")}
          >
            单课
          </button>
          <button
            type="button"
            className={`btn ${productType === "COLUMN" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProductType("COLUMN")}
          >
            专栏
          </button>
        </div>

        <label className="block text-sm">
          <span className="text-[var(--muted)]">标题</span>
          <input
            className={`${inputClass} mt-1`}
            value={title}
            maxLength={PRODUCT_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <label className="block text-sm">
          <span className="text-[var(--muted)]">一句话卖点</span>
          <input
            className={`${inputClass} mt-1`}
            value={subtitle}
            maxLength={200}
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </label>

        <label className="block text-sm">
          <span className="text-[var(--muted)]">产品介绍</span>
          <textarea
            className={`${inputClass} mt-1 min-h-28`}
            value={description}
            maxLength={5000}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">售价（元）</span>
            <input
              className={`${inputClass} mt-1`}
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">链接地址 slug</span>
            <input
              className={`${inputClass} mt-1`}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              前台：/courses/{slug || "…"}
            </p>
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-[var(--muted)]">封面图 URL</span>
          <input
            className={`${inputClass} mt-1`}
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://..."
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          上架售卖（取消勾选即下架为草稿）
        </label>
      </div>

      <div className="surface space-y-4 rounded-[28px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">章节与课时</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              可增删章节/课时、调整顺序、改标题、设试看、更换绑定视频。
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={addChapter}>
            添加章节
          </button>
        </div>

        {chapters.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            还没有章节，点击「添加章节」开始。
          </p>
        ) : null}

        <div className="space-y-4">
          {chapters.map((chapter, cIndex) => (
            <div
              key={chapter.key}
              className="rounded-2xl border border-[var(--line)] bg-white/60 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[var(--muted)]">章节 {cIndex + 1}</span>
                <input
                  className={`${inputClass} min-w-[200px] flex-1`}
                  value={chapter.title}
                  onChange={(e) =>
                    updateChapter(chapter.key, { title: e.target.value })
                  }
                />
                <button
                  type="button"
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs"
                  onClick={() => moveChapter(chapter.key, -1)}
                  disabled={cIndex === 0}
                >
                  上移
                </button>
                <button
                  type="button"
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs"
                  onClick={() => moveChapter(chapter.key, 1)}
                  disabled={cIndex === chapters.length - 1}
                >
                  下移
                </button>
                <button
                  type="button"
                  className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-700"
                  onClick={() => removeChapter(chapter.key)}
                >
                  删除章节
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {chapter.lessons.map((lesson, lIndex) => (
                  <div
                    key={lesson.key}
                    className="rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.8)] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[var(--muted)]">
                        课时 {lIndex + 1}
                      </span>
                      <input
                        className={`${inputClass} min-w-[180px] flex-1`}
                        value={lesson.title}
                        onChange={(e) =>
                          updateLesson(chapter.key, lesson.key, {
                            title: e.target.value,
                          })
                        }
                      />
                      <button
                        type="button"
                        className="rounded-full border border-[var(--line)] px-2 py-1 text-xs"
                        onClick={() => moveLesson(chapter.key, lesson.key, -1)}
                        disabled={lIndex === 0}
                      >
                        上
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-[var(--line)] px-2 py-1 text-xs"
                        onClick={() => moveLesson(chapter.key, lesson.key, 1)}
                        disabled={lIndex === chapter.lessons.length - 1}
                      >
                        下
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-red-200 px-2 py-1 text-xs text-red-700"
                        onClick={() => removeLesson(chapter.key, lesson.key)}
                      >
                        删
                      </button>
                    </div>

                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="block text-xs">
                        <span className="text-[var(--muted)]">类型</span>
                        <select
                          className={`${inputClass} mt-1`}
                          value={lesson.type}
                          onChange={(e) =>
                            updateLesson(chapter.key, lesson.key, {
                              type: e.target.value as LessonDraft["type"],
                            })
                          }
                        >
                          <option value="VIDEO">视频</option>
                          <option value="ARTICLE">图文</option>
                          <option value="LIVE">直播</option>
                        </select>
                      </label>
                      <div className="block text-xs">
                        <span className="text-[var(--muted)]">绑定素材视频</span>
                        <button
                          type="button"
                          className={`${inputClass} mt-1 flex w-full items-center justify-between gap-2 text-left`}
                          onClick={() =>
                            setPickerTarget({
                              chapterKey: chapter.key,
                              lessonKey: lesson.key,
                              mediaAssetId: lesson.mediaAssetId,
                            })
                          }
                        >
                          <span className="min-w-0 truncate">
                            {lesson.mediaAssetId
                              ? mediaMap[lesson.mediaAssetId]?.name ||
                                "已绑定素材（点击重选）"
                              : "点击从素材中心选择…"}
                          </span>
                          <span className="shrink-0 text-[var(--brand)]">
                            {lesson.mediaAssetId ? "重选" : "选择"}
                          </span>
                        </button>
                      </div>
                      <label className="block text-xs sm:col-span-2">
                        <span className="text-[var(--muted)]">视频地址</span>
                        <input
                          className={`${inputClass} mt-1`}
                          value={lesson.videoUrl}
                          onChange={(e) =>
                            updateLesson(chapter.key, lesson.key, {
                              videoUrl: e.target.value,
                            })
                          }
                          placeholder="vod:… 或 https://…"
                        />
                      </label>
                      <label className="block text-xs sm:col-span-2">
                        <span className="text-[var(--muted)]">课时说明</span>
                        <textarea
                          className={`${inputClass} mt-1`}
                          rows={2}
                          value={lesson.content}
                          onChange={(e) =>
                            updateLesson(chapter.key, lesson.key, {
                              content: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={lesson.isPreview}
                          onChange={(e) =>
                            updateLesson(chapter.key, lesson.key, {
                              isPreview: e.target.checked,
                            })
                          }
                        />
                        允许试看
                      </label>
                      <label className="block text-xs">
                        <span className="text-[var(--muted)]">时长（秒）</span>
                        <input
                          className={`${inputClass} mt-1`}
                          type="number"
                          min={0}
                          value={lesson.durationSec}
                          onChange={(e) =>
                            updateLesson(chapter.key, lesson.key, {
                              durationSec: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-secondary mt-3"
                onClick={() => addLesson(chapter.key)}
              >
                添加课时
              </button>
            </div>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? (
        <p className="text-sm text-[var(--brand-strong)]">{message}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading ? "保存中…" : "保存全部修改"}
        </button>
        <Link
          href={`/courses/${slug || course.slug}`}
          className="btn btn-secondary"
          target="_blank"
        >
          查看前台页
        </Link>
      </div>

      <MediaAssetPickerModal
        open={Boolean(pickerTarget)}
        selectedId={pickerTarget?.mediaAssetId}
        initialAssets={assetCatalog}
        onClose={() => setPickerTarget(null)}
        onSelect={(asset) => {
          if (!pickerTarget) return;
          bindMedia(pickerTarget.chapterKey, pickerTarget.lessonKey, asset);
          setPickerTarget(null);
        }}
        onClear={() => {
          if (!pickerTarget) return;
          bindMedia(pickerTarget.chapterKey, pickerTarget.lessonKey, null);
          setPickerTarget(null);
        }}
      />
    </form>
  );
}

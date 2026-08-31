"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageUrlField } from "@/components/image-url-field";
import { LessonResourcesEditor } from "@/components/lesson-resources-editor";
import {
  MediaAssetPickerModal,
  type PickerMediaAsset,
} from "@/components/media-asset-picker-modal";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";
import { StudioProductDeleteButton } from "@/components/studio-product-delete-button";
import { PRODUCT_TITLE_MAX } from "@/lib/media";
import { centsToYuanString, isValidYuanInput } from "@/lib/money";
import { productDetailPath } from "@/lib/product-types";
import { formatPrice } from "@/lib/utils";

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
  /** 含资料文件类型 DOCUMENT/IMAGE/AUDIO/OTHER，避免编辑时被压成 VIDEO */
  type: "VIDEO" | "ARTICLE" | "LIVE" | "DOCUMENT" | "IMAGE" | "AUDIO" | "OTHER";
  content: string;
  videoUrl: string;
  durationSec: number;
  isPreview: boolean;
  mediaAssetId: string | null;
};

const LESSON_DRAFT_TYPES: LessonDraft["type"][] = [
  "VIDEO",
  "ARTICLE",
  "LIVE",
  "DOCUMENT",
  "IMAGE",
  "AUDIO",
  "OTHER",
];

type ChapterDraft = {
  key: string;
  id?: string;
  title: string;
  sortOrder: number;
  lessons: LessonDraft[];
};

export type BundleCourseOption = {
  id: string;
  title: string;
  slug: string;
  price: number;
  status: string;
  coverUrl?: string;
};

export type EditableCourse = {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  price: number;
  hidePrice?: boolean;
  coverUrl: string;
  status: string;
  productType: string;
  bundleCourses?: BundleCourseOption[];
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
  /** 可打进专栏套餐的名下单课 */
  availableBundleCourses?: BundleCourseOption[];
  /** 老师不可删章节/课程结构 */
  canDeleteStructure?: boolean;
  /** 站长/商家/代理可删除整件商品 */
  canDeleteProduct?: boolean;
  /**
   * product = 产品介绍（标题/封面/价格等）；
   * content = 章节课时或专栏套餐内容。
   * 两套入口分开，避免改介绍时误动目录。
   */
  mode?: "product" | "content";
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
      type: (LESSON_DRAFT_TYPES.includes(l.type as LessonDraft["type"])
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

export function EditCourseForm({
  course,
  mediaAssets,
  availableBundleCourses = [],
  canDeleteStructure = true,
  canDeleteProduct = false,
  mode = "product",
}: Props) {
  const router = useRouter();
  const isProductMode = mode === "product";
  const isContentMode = mode === "content";
  const [title, setTitle] = useState(course.title);
  const [subtitle, setSubtitle] = useState(course.subtitle || "");
  const [description, setDescription] = useState(course.description || "");
  const [price, setPrice] = useState(centsToYuanString(course.price));
  const [hidePrice, setHidePrice] = useState(Boolean(course.hidePrice));
  const [coverUrl, setCoverUrl] = useState(course.coverUrl || "");
  const [slug, setSlug] = useState(course.slug);
  const [productType, setProductType] = useState<
    "COURSE" | "COLUMN" | "MATERIAL"
  >(
    course.productType === "COLUMN"
      ? "COLUMN"
      : course.productType === "MATERIAL"
        ? "MATERIAL"
        : "COURSE",
  );
  const [published, setPublished] = useState(course.status === "PUBLISHED");
  const [bundleCourseIds, setBundleCourseIds] = useState<string[]>(
    () => (course.bundleCourses || []).map((c) => c.id),
  );
  const [chapters, setChapters] = useState<ChapterDraft[]>(() =>
    toDrafts(course),
  );
  const isColumn = productType === "COLUMN";

  const bundleCatalog = useMemo(() => {
    const map = new Map<string, BundleCourseOption>();
    for (const c of availableBundleCourses) map.set(c.id, c);
    for (const c of course.bundleCourses || []) map.set(c.id, c);
    return map;
  }, [availableBundleCourses, course.bundleCourses]);

  const selectedBundleCourses = useMemo(
    () =>
      bundleCourseIds
        .map((id) => bundleCatalog.get(id))
        .filter(Boolean) as BundleCourseOption[],
    [bundleCourseIds, bundleCatalog],
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
  const [saveFeedback, setSaveFeedback] = useState<SaveStatus>(null);

  const kind =
    productType === "MATERIAL"
      ? "资料"
      : productType === "COLUMN"
        ? "专栏"
        : "课程";
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
    if (!canDeleteStructure) {
      setError("老师账号不可删除章节，请联系站长处理");
      return;
    }
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

  function toggleBundleCourse(id: string) {
    setBundleCourseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function moveBundleCourse(id: string, dir: -1 | 1) {
    setBundleCourseIds((prev) => {
      const i = prev.indexOf(id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();

    if (isProductMode) {
      if (trimmedTitle.length < 2) {
        setError("标题至少需要 2 个字");
        return;
      }
      if (!isValidYuanInput(price)) {
        setError("请填写有效价格（可到分，如 99.90）");
        return;
      }
    } else if (isColumn) {
      if (bundleCourseIds.length === 0) {
        setError("专栏套餐请至少包含一门单课");
        return;
      }
    } else {
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
    }

    setLoading(true);
    setError("");
    setMessage("");
    setSaveFeedback(null);

    // 产品介绍与章节内容分接口载荷，避免互相覆盖空结构
    const body = isProductMode
      ? {
          title: trimmedTitle,
          subtitle: subtitle.trim(),
          description: trimmedDesc,
          price,
          hidePrice,
          coverUrl: coverUrl.trim(),
          slug: slug.trim(),
          productType,
          status: published ? "PUBLISHED" : "DRAFT",
        }
      : isColumn
        ? { courseIds: bundleCourseIds }
        : {
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
          };

    const result = await postSave(`/api/studio/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error || "保存失败");
      setSaveFeedback({ kind: "error", text: result.error || "保存失败" });
      return;
    }
    if (result.data.course) {
      const next = result.data.course as EditableCourse;
      setSlug(next.slug);
      if (next.bundleCourses) {
        setBundleCourseIds(next.bundleCourses.map((c) => c.id));
      }
      if (!isColumn) setChapters(toDrafts(next));
    }
    setMessage(
      isProductMode ? "产品介绍已保存，前台即时生效" : "章节/内容已保存",
    );
    setSaveFeedback({ kind: "ok", text: "保存成功" });
    router.refresh();
  }

  const contentHref = `/studio/courses/${course.id}/content`;
  const productHref = `/studio/courses/${course.id}/edit`;
  const contentLabel = isColumn ? "编辑套餐内容" : "编辑章节/课时";

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-6">
      <div className="surface space-y-4 rounded-[28px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {isProductMode ? `编辑${kind}` : contentLabel}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {isProductMode
                ? isColumn
                  ? "维护产品介绍、售价与上架；套餐内单课请到「编辑套餐内容」。"
                  : "维护产品介绍信息（标题、封面、价格等）；章节与课时请到「编辑章节/课时」。"
                : isColumn
                  ? "勾选要打包的单课并调整顺序。买专栏会开通各单课权限。"
                  : "管理章节目录、课时视频与试看设置。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isProductMode ? (
              <Link
                href={contentHref}
                className="btn btn-primary px-4 py-2 text-sm"
              >
                {contentLabel}
              </Link>
            ) : (
              <Link
                href={productHref}
                className="btn btn-secondary px-4 py-2 text-sm"
              >
                编辑产品介绍
              </Link>
            )}
            <Link
              href="/studio/courses"
              className="btn btn-secondary px-4 py-2 text-sm"
            >
              返回课程中心
            </Link>
          </div>
        </div>

        {isProductMode ? (
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
            专栏套餐
          </button>
          <button
            type="button"
            className={`btn ${productType === "MATERIAL" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProductType("MATERIAL")}
          >
            资料
          </button>
        </div>
        ) : (
          <p className="rounded-2xl bg-[var(--brand-soft)] px-4 py-3 text-sm">
            当前产品：<span className="font-medium">{course.title}</span>
          </p>
        )}

        {isProductMode ? (
        <>

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
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              可精确到分，例如 99.90
            </p>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">链接地址 slug</span>
            <input
              className={`${inputClass} mt-1`}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              前台：{productDetailPath(slug || "…", productType)}
            </p>
          </label>
        </div>
        <label className="flex min-h-11 cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
            checked={hidePrice}
            onChange={(e) => setHidePrice(e.target.checked)}
          />
          <span>
            前台隐藏价格
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              列表与详情不显示售价；结账仍显示应付金额
            </span>
          </span>
        </label>

        <ImageUrlField
          label="封面图"
          value={coverUrl}
          onChange={setCoverUrl}
          showPresets
          hint="可上传图片，或选用推荐封面。"
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          上架售卖（取消勾选即下架为草稿）
        </label>
        </>
        ) : null}
      </div>

      {isContentMode && isColumn ? (
        <div className="surface space-y-4 rounded-[28px] p-6">
          <div>
            <h2 className="text-lg font-semibold">套餐内单课</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              勾选要打包的单课并调整顺序。旧版「素材型专栏」可在此改为真正的单课套餐。
            </p>
          </div>
          {selectedBundleCourses.length > 0 ? (
            <ol className="space-y-2">
              {selectedBundleCourses.map((c, index) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] px-3 py-2 text-sm"
                >
                  <span className="text-xs text-[var(--muted)]">{index + 1}.</span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {c.title}
                  </span>
                  <span className="text-[var(--muted)]">
                    {formatPrice(c.price)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-9 px-2 text-xs"
                    onClick={() => moveBundleCourse(c.id, -1)}
                    disabled={index === 0}
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-9 px-2 text-xs"
                    onClick={() => moveBundleCourse(c.id, 1)}
                    disabled={index === selectedBundleCourses.length - 1}
                  >
                    下移
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-9 px-2 text-xs"
                    onClick={() => toggleBundleCourse(c.id)}
                  >
                    移除
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--muted)]">
              尚未加入单课
            </p>
          )}
          <div>
            <h3 className="text-sm font-medium">可添加的单课</h3>
            <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
              {availableBundleCourses
                .filter((c) => !bundleCourseIds.includes(c.id))
                .map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full min-h-11 items-center justify-between gap-2 rounded-2xl border border-[var(--line)] px-3 py-2 text-left text-sm hover:border-[var(--brand)]/40"
                      onClick={() => toggleBundleCourse(c.id)}
                    >
                      <span className="truncate">{c.title}</span>
                      <span className="shrink-0 text-[var(--muted)]">
                        {formatPrice(c.price)} · 加入
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
            {availableBundleCourses.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                暂无单课可打包，请先创建单课。
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {isContentMode && !isColumn ? (
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
                {canDeleteStructure ? (
                  <button
                    type="button"
                    className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-700"
                    onClick={() => removeChapter(chapter.key)}
                  >
                    删除章节
                  </button>
                ) : null}
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
                          <option value="DOCUMENT">文档</option>
                          <option value="IMAGE">图片</option>
                          <option value="AUDIO">音频</option>
                          <option value="OTHER">其他</option>
                        </select>
                      </label>
                      <div className="block text-xs">
                        <span className="text-[var(--muted)]">绑定素材</span>
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

                    <LessonResourcesEditor
                      courseId={course.id}
                      lessonId={lesson.id}
                    />
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
      ) : null}

      {error && !saveFeedback ? (
        <p className="text-sm text-[var(--fire-strong)]">{error}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="btn btn-primary min-h-11"
          disabled={loading}
          type="submit"
        >
          {loading
            ? "保存中…"
            : isProductMode
              ? "保存产品介绍"
              : "保存章节/内容"}
        </button>
        <SaveFeedback
          status={
            saveFeedback ||
            (message ? { kind: "ok", text: message } : null)
          }
        />
        {isProductMode ? (
          <Link
            href={contentHref}
            className="btn btn-secondary min-h-11"
          >
            {contentLabel}
          </Link>
        ) : null}
        <Link
          href={productDetailPath(slug || course.slug, productType)}
          className="btn btn-secondary min-h-11"
          target="_blank"
        >
          查看前台页
        </Link>
      </div>

      {isProductMode && canDeleteProduct ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/60 px-4 py-4">
          <p className="text-sm text-red-800">
            删除后不可恢复，相关报名与订单也会一并清除。
          </p>
          <div className="mt-3">
            <StudioProductDeleteButton
              productId={course.id}
              title={title || course.title}
              productType={productType}
              variant="button"
              redirectTo="/studio/courses"
            />
          </div>
        </div>
      ) : null}

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

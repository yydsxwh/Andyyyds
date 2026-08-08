"use client";

/**
 * 图片字段：本地上传（入库素材中心+按分类分路径）/ 从素材中心选用 / 推荐封面 / 粘贴链接。
 */

import { useEffect, useRef, useState } from "react";
import { CoverImagePicker } from "@/components/cover-image-picker";
import {
  MediaAssetPickerModal,
  type PickerMediaAsset,
} from "@/components/media-asset-picker-modal";

type Category = { id: string; name: string };

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  showPresets?: boolean;
  allowUrlInput?: boolean;
  hint?: string;
  className?: string;
};

async function uploadToMediaCenter(
  file: File,
  categoryId: string,
): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  body.append(
    "name",
    file.name.replace(/\.[^.]+$/, "").trim() || file.name,
  );
  body.append("description", "封面/图集上传");
  if (categoryId) body.append("categoryId", categoryId);

  const res = await fetch("/api/studio/media", {
    method: "POST",
    body,
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    asset?: { fileUrl?: string };
  };
  if (!res.ok) {
    throw new Error(data.error || "上传到素材中心失败");
  }
  const url = (data.asset?.fileUrl || "").trim();
  if (!url) throw new Error("上传成功但未返回地址");
  return url;
}

/** 无素材中心权限时的兜底直传 */
async function uploadImageFallback(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/upload/image", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    url?: string;
    previewUrl?: string;
  };
  if (!res.ok) throw new Error(data.error || "上传失败");
  const url = (data.url || data.previewUrl || "").trim();
  if (!url) throw new Error("上传成功但未返回地址");
  return url;
}

export function ImageUrlField({
  label,
  value,
  onChange,
  showPresets = false,
  allowUrlInput = true,
  hint,
  className = "",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showUrl, setShowUrl] = useState(Boolean(value));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [mediaReady, setMediaReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/studio/media-categories")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setMediaReady(false);
          return;
        }
        const data = (await res.json()) as { categories?: Category[] };
        setCategories(data.categories || []);
        setMediaReady(true);
      })
      .catch(() => {
        if (!cancelled) setMediaReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function finishUpload(file: File, catId: string) {
    setError("");
    setUploading(true);
    try {
      if (mediaReady) {
        onChange(await uploadToMediaCenter(file, catId));
      } else {
        onChange(await uploadImageFallback(file));
      }
      setCategoryOpen(false);
      pendingFileRef.current = null;
    } catch (e) {
      // 素材中心失败时再试直传，避免约搭发起人完全传不了
      try {
        onChange(await uploadImageFallback(file));
        setError(
          e instanceof Error
            ? `${e.message}（已改用临时上传，未写入素材中心）`
            : "已改用临时上传",
        );
        setCategoryOpen(false);
        pendingFileRef.current = null;
      } catch (e2) {
        setError(e2 instanceof Error ? e2.message : "上传失败");
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onFilePicked(file: File | null) {
    if (!file) return;
    pendingFileRef.current = file;
    if (mediaReady && categories.length > 0) {
      setCategoryOpen(true);
      return;
    }
    if (mediaReady) {
      // 无分类时直接进「未分类」并入库
      void finishUpload(file, "");
      return;
    }
    void finishUpload(file, "");
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-sm font-medium">{label}</label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary min-h-11 px-3 text-sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "上传中…" : value ? "本地上传" : "本地上传"}
          </button>
          <button
            type="button"
            className="btn btn-secondary min-h-11 px-3 text-sm"
            disabled={uploading || mediaReady === false}
            title={
              mediaReady === false
                ? "需创作者/商家等角色才能打开素材中心"
                : "从素材中心选用已有图片"
            }
            onClick={() => setPickerOpen(true)}
          >
            素材中心
          </button>
          {value ? (
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-3 text-sm"
              disabled={uploading}
              onClick={() => onChange("")}
            >
              清除
            </button>
          ) : null}
          {allowUrlInput ? (
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-3 text-sm"
              onClick={() => setShowUrl((v) => !v)}
            >
              {showUrl ? "收起链接" : "粘贴链接"}
            </button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => onFilePicked(e.target.files?.[0] || null)}
      />

      {value ? (
        <div className="flex aspect-[16/9] max-h-48 w-full items-center justify-center overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-deep)]/40">
          {/* 预览与前台一致：整图适应，不裁切 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : (
        <button
          type="button"
          className="flex min-h-28 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg-deep)]/30 px-4 text-sm text-[var(--muted)]"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading
            ? "正在上传…"
            : "本地上传将自动进入素材中心；也可点「素材中心」选用"}
        </button>
      )}

      {allowUrlInput && showUrl ? (
        <input
          className="field min-h-11"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/covers/... 或 https://..."
          maxLength={800}
        />
      ) : null}

      {hint ? <p className="text-xs text-[var(--muted)]">{hint}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {showPresets ? (
        <CoverImagePicker value={value} onChange={onChange} />
      ) : null}

      {categoryOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="选择素材分类"
          onClick={() => {
            setCategoryOpen(false);
            pendingFileRef.current = null;
            if (inputRef.current) inputRef.current.value = "";
          }}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-[24px] border border-[var(--line)] bg-[var(--bg)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">入库素材中心</h3>
            <p className="text-sm text-[var(--muted)]">
              选择分类后上传：图片会写入素材库，并按「图片/分类名」分路径存储。
            </p>
            <label className="block text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">分类</span>
              <select
                className="field min-h-11 w-full"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">未分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary min-h-11 flex-1"
                disabled={uploading || !pendingFileRef.current}
                onClick={() => {
                  const file = pendingFileRef.current;
                  if (file) void finishUpload(file, categoryId);
                }}
              >
                {uploading ? "上传中…" : "确认上传"}
              </button>
              <button
                type="button"
                className="btn btn-secondary min-h-11"
                disabled={uploading}
                onClick={() => {
                  setCategoryOpen(false);
                  pendingFileRef.current = null;
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MediaAssetPickerModal
        open={pickerOpen}
        mediaKind="IMAGE"
        title="从素材中心选择图片"
        description="按分类浏览图片素材；选中后填入当前封面/图片字段"
        onClose={() => setPickerOpen(false)}
        onSelect={(asset: PickerMediaAsset) => {
          onChange(asset.fileUrl);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

type GalleryProps = {
  label: string;
  valueText: string;
  onChangeText: (text: string) => void;
  hint?: string;
};

/** 多图：本地上传入库素材中心，或从素材中心多选追加 */
export function ImageGalleryField({
  label,
  valueText,
  onChangeText,
  hint,
}: GalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingFilesRef = useRef<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [mediaReady, setMediaReady] = useState<boolean | null>(null);

  const urls = valueText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/studio/media-categories")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setMediaReady(false);
          return;
        }
        const data = (await res.json()) as { categories?: Category[] };
        setCategories(data.categories || []);
        setMediaReady(true);
      })
      .catch(() => {
        if (!cancelled) setMediaReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function uploadOne(file: File, catId: string) {
    if (mediaReady) {
      try {
        return await uploadToMediaCenter(file, catId);
      } catch {
        return uploadImageFallback(file);
      }
    }
    return uploadImageFallback(file);
  }

  async function finishUploads(files: File[], catId: string) {
    setError("");
    setUploading(true);
    try {
      const next = [...urls];
      for (const file of files) {
        next.push(await uploadOne(file, catId));
      }
      onChangeText(next.join("\n"));
      setCategoryOpen(false);
      pendingFilesRef.current = [];
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onFilesPicked(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list);
    pendingFilesRef.current = files;
    if (mediaReady && categories.length > 0) {
      setCategoryOpen(true);
      return;
    }
    void finishUploads(files, "");
  }

  function removeAt(index: number) {
    onChangeText(urls.filter((_, i) => i !== index).join("\n"));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-sm font-medium">{label}</label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary min-h-11 px-3 text-sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "上传中…" : "本地上传"}
          </button>
          <button
            type="button"
            className="btn btn-secondary min-h-11 px-3 text-sm"
            disabled={uploading || mediaReady === false}
            onClick={() => setPickerOpen(true)}
          >
            素材中心
          </button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => onFilesPicked(e.target.files)}
      />
      {urls.length ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {urls.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="relative overflow-hidden rounded-xl border border-[var(--line)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="aspect-square w-full object-cover" />
              <button
                type="button"
                className="absolute right-1 top-1 rounded-lg bg-black/55 px-2 py-1 text-xs text-white"
                onClick={() => removeAt(i)}
              >
                删除
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          可本地上传（自动进素材中心）或从素材中心选用。
        </p>
      )}
      <textarea
        className="field min-h-20 text-xs"
        value={valueText}
        onChange={(e) => onChangeText(e.target.value)}
        placeholder="也可每行粘贴一个图片链接（选填）"
      />
      {hint ? <p className="text-xs text-[var(--muted)]">{hint}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {categoryOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setCategoryOpen(false);
            pendingFilesRef.current = [];
            if (inputRef.current) inputRef.current.value = "";
          }}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-[24px] border border-[var(--line)] bg-[var(--bg)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">入库素材中心</h3>
            <p className="text-sm text-[var(--muted)]">
              共 {pendingFilesRef.current.length}{" "}
              张，将按所选分类写入素材库并分路径存储。
            </p>
            <select
              className="field min-h-11 w-full"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">未分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary min-h-11 flex-1"
                disabled={uploading}
                onClick={() =>
                  void finishUploads(pendingFilesRef.current, categoryId)
                }
              >
                {uploading ? "上传中…" : "确认上传"}
              </button>
              <button
                type="button"
                className="btn btn-secondary min-h-11"
                onClick={() => {
                  setCategoryOpen(false);
                  pendingFilesRef.current = [];
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MediaAssetPickerModal
        open={pickerOpen}
        mediaKind="IMAGE"
        title="从素材中心选择图片"
        description="选中后追加到图集（可多次打开继续添加）"
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => {
          onChangeText([...urls, asset.fileUrl].join("\n"));
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

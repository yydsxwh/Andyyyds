"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ASSET_DESC_MAX,
  ASSET_NAME_MAX,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  MEDIA_CATEGORY_NAME_MAX,
  MEDIA_KINDS,
  MEDIA_KIND_LABEL,
  MEDIA_UPLOAD_ACCEPT,
  type MediaKind,
  formatBytes,
  isMediaKind,
} from "@/lib/media";
import {
  uploadFileToOssDirect,
  uploadFileWithSignedParts,
} from "@/lib/browser-oss-multipart";

type Category = {
  id: string;
  name: string;
  _count: { assets: number };
};

type Asset = {
  id: string;
  name: string;
  description: string;
  /** 媒体类型 mediaKind，与用户自由分类 category 分离 */
  type: string;
  fileUrl: string;
  fileName: string;
  sizeBytes: number;
  durationSec: number;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  storageProvider?: string;
  vodVideoId?: string;
};

type Props = {
  initialCategories: Category[];
  initialAssets: Asset[];
  /** 老师不可删素材；站长/商家/代理可删 */
  canDelete?: boolean;
  /** 老师不可创建可售课程；站长/商家/代理可以 */
  canCreateSellable?: boolean;
};

type UploadProgress = {
  fileIndex: number;
  fileCount: number;
  fileName: string;
  percent: number;
  loaded: number;
  total: number;
  speedBps: number;
};

function formatSpeed(bps: number) {
  if (!Number.isFinite(bps) || bps <= 0) return "计算中…";
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`;
}

/** 上传失败旁展示短中文，避免阿里云 StringToSign 全文撑爆界面 */
function shortUploadError(raw: string | undefined, fallback = "上传失败") {
  const text = (raw || "").trim();
  if (!text) return fallback;
  if (
    /signature is not matched/i.test(text) ||
    /server string to sign/i.test(text)
  ) {
    return "点播密钥校验失败，请在系统设置重新填写 AccessKey";
  }
  if (text.length > 100) return `${text.slice(0, 90)}…`;
  return text;
}

function uploadWithProgress(
  form: FormData,
  onProgress: (loaded: number, total: number) => void,
): Promise<{ ok: boolean; status: number; data: { asset?: Asset; error?: string } }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/studio/media");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(event.loaded, event.total);
    };
    xhr.onload = () => {
      const data =
        xhr.response && typeof xhr.response === "object"
          ? xhr.response
          : (() => {
              try {
                return JSON.parse(xhr.responseText || "{}");
              } catch {
                return { error: "上传响应无效" };
              }
            })();
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        data,
      });
    };
    xhr.onerror = () => {
      resolve({
        ok: false,
        status: 0,
        data: { error: "网络错误，上传中断" },
      });
    };
    xhr.send(form);
  });
}

type PrepareResponse = {
  mode: "vod_multipart" | "vod_direct" | "oss_multipart" | "proxy";
  mediaKind?: string;
  mimeType?: string;
  error?: string;
  vod?: {
    videoId: string;
    fileUrl: string;
    host: string;
    bucket: string;
    objectKey: string;
    accessKeyId: string;
    accessKeySecret: string;
    securityToken: string;
    uploadId?: string;
    partSize?: number;
    parts?: Array<{ partNumber: number; url: string }>;
  };
  oss?: {
    uploadId: string;
    objectKey: string;
    fileUrl: string;
    partSize: number;
    parts: Array<{ partNumber: number; url: string }>;
  };
};

async function uploadFileDirect(input: {
  file: File;
  name: string;
  description: string;
  categoryId: string;
  onProgress: (loaded: number, total: number) => void;
}): Promise<{ ok: boolean; data: { asset?: Asset; error?: string } }> {
  if (input.file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      data: { error: `文件不能超过 ${MAX_UPLOAD_LABEL}` },
    };
  }

  const prepareRes = await fetch("/api/studio/media/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      fileName: input.file.name,
      mimeType: input.file.type || "",
      sizeBytes: input.file.size,
      categoryId: input.categoryId || undefined,
      description: input.description || undefined,
    }),
  });
  const prepare = (await prepareRes.json().catch(() => ({}))) as PrepareResponse;
  if (!prepareRes.ok) {
    return {
      ok: false,
      data: { error: prepare.error || "无法获取直传凭证" },
    };
  }

  // 未配云存储时回退旧代理（仅小文件）
  if (prepare.mode === "proxy") {
    const form = new FormData();
    form.set("name", input.name);
    form.set("description", input.description);
    if (input.categoryId) form.set("categoryId", input.categoryId);
    form.set("file", input.file);
    const result = await uploadWithProgress(form, input.onProgress);
    return { ok: result.ok, data: result.data };
  }

  try {
    // 点播：服务端预签名分片 URL（vod_multipart）；旧 vod_direct 仅作兼容回退
    if (
      (prepare.mode === "vod_multipart" || prepare.mode === "vod_direct") &&
      prepare.vod
    ) {
      const vod = prepare.vod;
      let uploadedParts: Array<{ partNumber: number; etag: string }> = [];
      if (vod.parts?.length && vod.partSize) {
        uploadedParts = await uploadFileWithSignedParts({
          file: input.file,
          partSize: vod.partSize,
          parts: vod.parts,
          onProgress: input.onProgress,
          // 无 uploadId 表示单次 PUT，不依赖 CORS 暴露 ETag
          requireEtag: Boolean(vod.uploadId),
        });
      } else {
        await uploadFileToOssDirect({
          file: input.file,
          contentType: prepare.mimeType || input.file.type || "video/mp4",
          creds: {
            host: vod.host,
            bucket: vod.bucket,
            objectKey: vod.objectKey,
            accessKeyId: vod.accessKeyId,
            accessKeySecret: vod.accessKeySecret,
            securityToken: vod.securityToken,
          },
          onProgress: input.onProgress,
        });
      }
      const completeRes = await fetch("/api/studio/media/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          categoryId: input.categoryId || undefined,
          fileName: input.file.name,
          mimeType: prepare.mimeType || input.file.type || "",
          sizeBytes: input.file.size,
          mediaKind: prepare.mediaKind || "VIDEO",
          provider: "ALIYUN_VOD",
          vodVideoId: vod.videoId,
          fileUrl: vod.fileUrl,
          vod: {
            host: vod.host,
            bucket: vod.bucket,
            objectKey: vod.objectKey,
            accessKeyId: vod.accessKeyId,
            accessKeySecret: vod.accessKeySecret,
            securityToken: vod.securityToken,
            uploadId: vod.uploadId || undefined,
            parts: vod.uploadId ? uploadedParts : undefined,
          },
        }),
      });
      const completeData = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok || !completeData.asset) {
        return {
          ok: false,
          data: { error: completeData.error || "点播直传后入库失败" },
        };
      }
      return { ok: true, data: { asset: completeData.asset as Asset } };
    }

    if (prepare.mode === "oss_multipart" && prepare.oss) {
      const parts = await uploadFileWithSignedParts({
        file: input.file,
        partSize: prepare.oss.partSize,
        parts: prepare.oss.parts,
        onProgress: input.onProgress,
      });
      const completeRes = await fetch("/api/studio/media/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          categoryId: input.categoryId || undefined,
          fileName: input.file.name,
          mimeType: prepare.mimeType || input.file.type || "",
          sizeBytes: input.file.size,
          mediaKind: prepare.mediaKind,
          provider: "ALIYUN_OSS",
          fileUrl: prepare.oss.fileUrl,
          oss: {
            objectKey: prepare.oss.objectKey,
            uploadId: prepare.oss.uploadId,
            parts,
          },
        }),
      });
      const completeData = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok || !completeData.asset) {
        return {
          ok: false,
          data: { error: completeData.error || "OSS 直传后入库失败" },
        };
      }
      return { ok: true, data: { asset: completeData.asset as Asset } };
    }

    return { ok: false, data: { error: "未知的上传模式" } };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "直传失败";
    return { ok: false, data: { error: shortUploadError(msg) } };
  }
}

export function MediaCenter({
  initialCategories,
  initialAssets,
  canDelete = true,
  canCreateSellable = true,
}: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [assets, setAssets] = useState(initialAssets);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  /** 按媒体类型筛选；与用户自由分类 activeCategory 独立 */
  const [activeMediaKind, setActiveMediaKind] = useState<"all" | MediaKind>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null,
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");

  function assetNameForFile(file: File, index: number, total: number) {
    const base = file.name.replace(/\.[^.]+$/, "").trim() || file.name;
    const trimmed = name.trim();
    if (!trimmed) return base.slice(0, ASSET_NAME_MAX);
    if (total === 1) return trimmed.slice(0, ASSET_NAME_MAX);
    const suffix = ` (${index + 1})`;
    return `${trimmed.slice(0, Math.max(1, ASSET_NAME_MAX - suffix.length))}${suffix}`;
  }

  const kindCounts = useMemo(() => {
    const counts: Record<MediaKind, number> = {
      VIDEO: 0,
      IMAGE: 0,
      AUDIO: 0,
      DOCUMENT: 0,
      OTHER: 0,
    };
    for (const asset of assets) {
      const kind = isMediaKind(asset.type) ? asset.type : "OTHER";
      counts[kind] += 1;
    }
    return counts;
  }, [assets]);

  const filtered = useMemo(() => {
    return assets.filter((asset) => {
      const byCategory =
        activeCategory === "all"
          ? true
          : activeCategory === "uncategorized"
            ? !asset.categoryId
            : asset.categoryId === activeCategory;
      const byKind =
        activeMediaKind === "all"
          ? true
          : (isMediaKind(asset.type) ? asset.type : "OTHER") === activeMediaKind;
      const byQuery =
        !query ||
        asset.name.includes(query) ||
        asset.description.includes(query) ||
        asset.fileName.includes(query);
      return byCategory && byKind && byQuery;
    });
  }, [assets, activeCategory, activeMediaKind, query]);

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const filteredIds = useMemo(() => filtered.map((a) => a.id), [filtered]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.includes(id));

  function toggleSelectAllFiltered() {
    if (allFilteredSelected) {
      setSelected((prev) => prev.filter((id) => !filteredIds.includes(id)));
      return;
    }
    setSelected((prev) => [...new Set([...prev, ...filteredIds])]);
  }

  async function removeSelectedAssets() {
    if (!canDelete) {
      setMessage("当前角色不可删除素材");
      return;
    }
    if (selected.length === 0) {
      setMessage("请先勾选要删除的素材");
      return;
    }
    if (
      !window.confirm(
        `确认删除已选的 ${selected.length} 个素材？删除后不可恢复。`,
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    setMessage("");
    const res = await fetch("/api/studio/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected }),
    });
    const data = await res.json().catch(() => ({}));
    setBulkDeleting(false);
    if (!res.ok) {
      setMessage(data.error || "批量删除失败");
      return;
    }
    const deleted: string[] = data.deletedIds || selected;
    setAssets((prev) => prev.filter((a) => !deleted.includes(a.id)));
    setSelected((prev) => prev.filter((id) => !deleted.includes(id)));
    setMessage(`已删除 ${data.deletedCount ?? deleted.length} 个素材`);
    router.refresh();
  }

  async function createCategory() {
    setMessage("");
    const res = await fetch("/api/studio/media-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "创建分类失败");
      return;
    }
    setCategories((prev) => [data.category, ...prev]);
    setNewCategoryName("");
    setCategoryId(data.category.id);
  }

  async function renameCategory(id: string, current: string) {
    const next = window.prompt("修改分类名称", current)?.trim();
    if (!next || next === current) return;
    const res = await fetch(`/api/studio/media-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "重命名失败");
      return;
    }
    setCategories((prev) => prev.map((c) => (c.id === id ? data.category : c)));
    setAssets((prev) =>
      prev.map((a) =>
        a.categoryId === id ? { ...a, category: { id, name: next } } : a,
      ),
    );
  }

  async function deleteCategory(id: string) {
    if (!canDelete) {
      setMessage("当前角色不可删除分类");
      return;
    }
    if (!window.confirm("删除分类后，素材会变为未分类，确认吗？")) return;
    const res = await fetch(`/api/studio/media-categories/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "删除失败");
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setAssets((prev) =>
      prev.map((a) =>
        a.categoryId === id ? { ...a, categoryId: null, category: null } : a,
      ),
    );
    if (activeCategory === id) setActiveCategory("all");
  }

  async function uploadAsset(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);
    setMessage("");
    setUploadProgress(null);

    if (files.length === 0 && !externalUrl.trim()) {
      setUploading(false);
      setMessage("请选择至少一个文件，或填写外链");
      return;
    }

    if (files.length === 0 && externalUrl.trim() && !name.trim()) {
      setUploading(false);
      setMessage("使用外链入库时请填写素材名称");
      return;
    }

    /** 每成功一个就立刻插入列表，避免等整批结束才刷新 */
    const prependAsset = (asset: Asset) => {
      setAssets((prev) => [asset, ...prev]);
      if (asset.categoryId) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === asset.categoryId
              ? {
                  ...c,
                  _count: { assets: (c._count?.assets ?? 0) + 1 },
                }
              : c,
          ),
        );
      }
      // 若当前筛选会把刚上传的素材藏起来，切到「全部」保证列表里立刻能看见
      const kind = isMediaKind(asset.type) ? asset.type : "OTHER";
      setActiveMediaKind((prev) =>
        prev === "all" || prev === kind ? prev : "all",
      );
      if (
        activeCategory !== "all" &&
        activeCategory !== "uncategorized" &&
        asset.categoryId !== activeCategory
      ) {
        setActiveCategory("all");
      } else if (activeCategory === "uncategorized" && asset.categoryId) {
        setActiveCategory("all");
      }
    };

    let uploadedCount = 0;
    const errors: string[] = [];

    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let lastLoaded = 0;
        let lastAt = Date.now();
        let speedBps = 0;

        setUploadProgress({
          fileIndex: i + 1,
          fileCount: files.length,
          fileName: file.name,
          percent: 0,
          loaded: 0,
          total: file.size,
          speedBps: 0,
        });
        setMessage(`正在直传 ${i + 1}/${files.length}：${file.name}`);

        const result = await uploadFileDirect({
          file,
          name: assetNameForFile(file, i, files.length),
          description,
          categoryId,
          onProgress: (loaded, total) => {
            const now = Date.now();
            const dt = (now - lastAt) / 1000;
            if (dt >= 0.25) {
              speedBps = Math.max(0, (loaded - lastLoaded) / dt);
              lastLoaded = loaded;
              lastAt = now;
            }
            const percent =
              total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
            setUploadProgress({
              fileIndex: i + 1,
              fileCount: files.length,
              fileName: file.name,
              percent,
              loaded,
              total,
              speedBps,
            });
          },
        });

        if (!result.ok || !result.data.asset) {
          errors.push(
            `${file.name}：${shortUploadError(result.data.error)}`,
          );
          continue;
        }
        uploadedCount += 1;
        prependAsset(result.data.asset);
        setMessage(
          `已入库 ${uploadedCount}/${files.length}：${result.data.asset.name}`,
        );
      }
    } else {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("description", description);
      if (categoryId) form.set("categoryId", categoryId);
      form.set("externalUrl", externalUrl.trim());
      setMessage("正在保存外链素材…");
      const result = await uploadWithProgress(form, () => undefined);
      if (!result.ok || !result.data.asset) {
        setUploading(false);
        setUploadProgress(null);
        setMessage(shortUploadError(result.data.error));
        return;
      }
      uploadedCount += 1;
      prependAsset(result.data.asset);
    }

    setUploading(false);
    setUploadProgress(null);
    if (uploadedCount > 0) {
      setName("");
      setDescription("");
      setExternalUrl("");
      setFiles([]);
    }
    if (errors.length && uploadedCount) {
      setMessage(`成功入库 ${uploadedCount} 个；失败 ${errors.length} 个。${errors[0]}`);
    } else if (errors.length) {
      setMessage(errors.join("；"));
    } else {
      setMessage(
        uploadedCount > 1
          ? `已入库 ${uploadedCount} 个素材`
          : "素材已入库",
      );
    }
    router.refresh();
  }

  async function renameAsset(asset: Asset) {
    const next = window.prompt(`修改素材名称（最多 ${ASSET_NAME_MAX} 字）`, asset.name);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === asset.name) return;
    if (trimmed.length > ASSET_NAME_MAX) {
      setMessage(`名称不能超过 ${ASSET_NAME_MAX} 字`);
      return;
    }
    const res = await fetch(`/api/studio/media/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "重命名失败");
      return;
    }
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? data.asset : a)));
  }

  async function moveAsset(asset: Asset, nextCategoryId: string) {
    const res = await fetch(`/api/studio/media/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: nextCategoryId === "" ? null : nextCategoryId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "移动失败");
      return;
    }
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? data.asset : a)));
  }

  async function removeAsset(id: string) {
    if (!canDelete) {
      setMessage("当前角色不可删除素材");
      return;
    }
    if (!window.confirm("确认删除该素材？")) return;
    const res = await fetch(`/api/studio/media/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "删除失败");
      return;
    }
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  function goCompose() {
    if (selected.length === 0) {
      setMessage("请先勾选至少一个素材");
      return;
    }
    const ids = selected.join(",");
    router.push(`/studio/courses/compose?assets=${encodeURIComponent(ids)}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">素材中心</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            上传视频/图片/音频/文档（最大 {MAX_UPLOAD_LABEL}，大文件直传云端不经本机中转）；自动识别媒体类型；用户分类可自行整理（最多{" "}
            {ASSET_NAME_MAX} 字命名）
            {canCreateSellable
              ? "，再多选做成可售单课、专栏或资料。"
              : "。老师不可新建可售产品，请在已分配课程中维护内容。"}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          {canDelete ? (
            <button
              className="btn btn-secondary w-full sm:w-auto"
              type="button"
              disabled={bulkDeleting || selected.length === 0}
              onClick={() => void removeSelectedAssets()}
            >
              {bulkDeleting
                ? "删除中…"
                : `删除已选 ${selected.length} 个`}
            </button>
          ) : null}
          {canCreateSellable ? (
            <button
              className="btn btn-accent w-full sm:w-auto"
              type="button"
              onClick={goCompose}
            >
              用已选 {selected.length} 个素材创建课程/资料
            </button>
          ) : null}
        </div>
      </div>

      {message || uploadProgress ? (
        <div className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm">
          {message ? <div>{message}</div> : null}
          {uploadProgress ? (
            <div className={message ? "mt-3" : ""}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
                <span>
                  第 {uploadProgress.fileIndex}/{uploadProgress.fileCount} 个 ·{" "}
                  {uploadProgress.percent}%
                </span>
                <span>
                  {formatBytes(uploadProgress.loaded)} /{" "}
                  {formatBytes(uploadProgress.total)} ·{" "}
                  {formatSpeed(uploadProgress.speedBps)}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(28,36,48,0.08)]">
                <div
                  className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-150"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.2fr]">
        <form onSubmit={uploadAsset} className="surface space-y-3 rounded-[28px] p-6">
          <h2 className="text-lg font-semibold">上传 / 入库素材</h2>
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">
              素材名称（最多 {ASSET_NAME_MAX} 字）
              {files.length > 1 ? " · 多选时可选，用作统一前缀" : ""}
            </label>
            <input
              className="field"
              value={name}
              maxLength={ASSET_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                files.length > 1
                  ? "可选：多文件统一前缀；留空则用各自文件名"
                  : "例如：第 3 讲｜从痛点切入的详情页话术拆解与完整演示"
              }
              required={files.length === 0}
            />
            <div className="mt-1 text-right text-xs text-[var(--muted)]">
              {name.length}/{ASSET_NAME_MAX}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">备注说明</label>
            <textarea
              className="field min-h-24"
              value={description}
              maxLength={ASSET_DESC_MAX}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选：拍摄备注、适用场景、是否需要二次剪辑"
            />
          </div>
          <select
            className="field"
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
          <div>
            <input
              className="field"
              type="file"
              multiple
              accept={MEDIA_UPLOAD_ACCEPT}
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            {files.length > 0 ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                已选 {files.length} 个文件（入库时按 MIME/扩展名自动分类）
                {files.length <= 3
                  ? `：${files.map((f) => f.name).join("、")}`
                  : `：${files
                      .slice(0, 3)
                      .map((f) => f.name)
                      .join("、")} 等`}
              </p>
            ) : (
              <p className="mt-2 text-xs text-[var(--muted)]">
                支持视频、图片、音频、文档（如 mp4 / jpg / mp3 / pdf）
              </p>
            )}
          </div>
          <input
            className="field"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="或填写单个外链（http/https）"
            disabled={files.length > 0}
          />
          <button className="btn btn-primary w-full" disabled={uploading} type="submit">
            {uploading
              ? "上传中..."
              : files.length > 1
                ? `保存 ${files.length} 个到素材库`
                : "保存到素材库"}
          </button>
        </form>

        <div className="surface space-y-4 rounded-[28px] p-6">
          <div>
            <h2 className="text-lg font-semibold">用户分类</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              自建文件夹式归类，可随时改名 / 移动；与列表里的媒体类型筛选互不影响
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                className="field"
                value={newCategoryName}
                maxLength={MEDIA_CATEGORY_NAME_MAX}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={`新建分类名（最多 ${MEDIA_CATEGORY_NAME_MAX} 字）`}
              />
              <button
                className="btn btn-secondary w-full shrink-0 sm:w-auto"
                type="button"
                onClick={createCategory}
              >
                新建分类
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={`min-h-10 rounded-full px-3.5 py-2 text-sm ${activeCategory === "all" ? "bg-[var(--brand)] text-white" : "border border-[var(--line)]"}`}
                onClick={() => setActiveCategory("all")}
              >
                全部分类 ({assets.length})
              </button>
              <button
                type="button"
                className={`min-h-10 rounded-full px-3.5 py-2 text-sm ${activeCategory === "uncategorized" ? "bg-[var(--brand)] text-white" : "border border-[var(--line)]"}`}
                onClick={() => setActiveCategory("uncategorized")}
              >
                未分类
              </button>
              {categories.map((c) => (
                <div
                  key={c.id}
                  className={`flex min-h-10 items-center gap-1 rounded-full border px-2 py-1 text-sm ${
                    activeCategory === c.id
                      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                      : "border-[var(--line)]"
                  }`}
                >
                  <button
                    type="button"
                    className="px-1.5 py-1"
                    onClick={() => setActiveCategory(c.id)}
                  >
                    {c.name} ({c._count?.assets ?? 0})
                  </button>
                  {/* 改/删始终可见，不依赖 hover */}
                  <button
                    type="button"
                    className="min-h-8 min-w-8 rounded-full px-2 py-1 opacity-90"
                    aria-label={`重命名分类 ${c.name}`}
                    onClick={() => renameCategory(c.id, c.name)}
                  >
                    改
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      className="min-h-8 min-w-8 rounded-full px-2 py-1 opacity-90"
                      aria-label={`删除分类 ${c.name}`}
                      onClick={() => deleteCategory(c.id)}
                    >
                      删
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="surface rounded-[28px] p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">素材列表</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              按媒体类型筛选；上传成功会立刻出现在下方
            </p>
          </div>
          <input
            className="field sm:max-w-xs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索名称 / 备注 / 文件名"
          />
        </div>

        {/* 媒体类型与列表合并：筛选当前列表内容 */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={`min-h-10 rounded-full px-3.5 py-2 text-sm ${
              activeMediaKind === "all"
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--line)]"
            }`}
            onClick={() => setActiveMediaKind("all")}
          >
            全部类型 ({assets.length})
          </button>
          {MEDIA_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className={`min-h-10 rounded-full px-3.5 py-2 text-sm ${
                activeMediaKind === kind
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--line)]"
              }`}
              onClick={() => setActiveMediaKind(kind)}
            >
              {MEDIA_KIND_LABEL[kind]} ({kindCounts[kind]})
            </button>
          ))}
        </div>

        {/* 多选工具条：全选当前筛选结果 + 批量删除 */}
        <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-[var(--line)] bg-white/50 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              disabled={filteredIds.length === 0}
              onChange={toggleSelectAllFiltered}
            />
            <span>
              全选当前列表（{filteredIds.length}）
              {selected.length > 0 ? (
                <span className="text-[var(--muted)]">
                  {" "}
                  · 已选 {selected.length}
                </span>
              ) : null}
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {selected.length > 0 ? (
              <button
                type="button"
                className="btn btn-secondary min-h-10 px-3 text-sm"
                onClick={() => setSelected([])}
              >
                清除选择
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                className="btn btn-secondary min-h-10 px-3 text-sm"
                disabled={bulkDeleting || selected.length === 0}
                onClick={() => void removeSelectedAssets()}
              >
                {bulkDeleting
                  ? "删除中…"
                  : `一键删除已选（${selected.length}）`}
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((asset) => {
            const checked = selected.includes(asset.id);
            const mediaKind: MediaKind = isMediaKind(asset.type) ? asset.type : "OTHER";
            return (
              <div
                key={asset.id}
                className={`rounded-2xl border px-4 py-3 ${
                  checked ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-white/60"
                }`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                  <label className="flex items-start gap-3 lg:w-[42%]">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      onChange={() => toggleSelect(asset.id)}
                    />
                    <span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium leading-snug break-words">{asset.name}</span>
                        <span className="rounded-full border border-[var(--line)] bg-white/80 px-2 py-0.5 text-[11px] text-[var(--muted)]">
                          {MEDIA_KIND_LABEL[mediaKind]}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-[var(--muted)]">
                        {asset.category?.name || "未分类"} · {formatBytes(asset.sizeBytes || 0)}
                        {asset.fileName ? ` · ${asset.fileName}` : ""}
                      </span>
                      {asset.description ? (
                        <span className="mt-1 block text-sm text-[var(--muted)]">{asset.description}</span>
                      ) : null}
                    </span>
                  </label>
                  <div className="flex w-full flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <select
                      className="field py-2.5"
                      value={asset.categoryId || ""}
                      onChange={(e) => moveAsset(asset, e.target.value)}
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
                        className="btn btn-secondary min-h-10 flex-1 px-3 py-2 text-sm sm:flex-none"
                        type="button"
                        onClick={() => renameAsset(asset)}
                      >
                        重命名
                      </button>
                      <a
                        className="btn btn-secondary min-h-10 flex-1 px-3 py-2 text-sm sm:flex-none"
                        // 一律走签发接口：本地 /uploads 直链在文件丢失时只会显示框架 404
                        href={`/api/studio/media/${asset.id}/play`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        预览
                      </a>
                      {canDelete ? (
                        <button
                          className="btn btn-secondary min-h-10 flex-1 px-3 py-2 text-sm sm:flex-none"
                          type="button"
                          onClick={() => removeAsset(asset.id)}
                        >
                          删除
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--muted)]">暂无匹配素材，试试换筛选或上传文件</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ASSET_DESC_MAX,
  ASSET_NAME_MAX,
  MEDIA_CATEGORY_NAME_MAX,
  formatBytes,
} from "@/lib/media";

type Category = {
  id: string;
  name: string;
  _count: { assets: number };
};

type Asset = {
  id: string;
  name: string;
  description: string;
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

export function MediaCenter({ initialCategories, initialAssets }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [assets, setAssets] = useState(initialAssets);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
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

  const filtered = useMemo(() => {
    return assets.filter((asset) => {
      const byCategory =
        activeCategory === "all"
          ? true
          : activeCategory === "uncategorized"
            ? !asset.categoryId
            : asset.categoryId === activeCategory;
      const byQuery =
        !query ||
        asset.name.includes(query) ||
        asset.description.includes(query) ||
        asset.fileName.includes(query);
      return byCategory && byQuery;
    });
  }, [assets, activeCategory, query]);

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
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
      setMessage("请选择至少一个视频文件，或填写视频外链");
      return;
    }

    if (files.length === 0 && externalUrl.trim() && !name.trim()) {
      setUploading(false);
      setMessage("使用外链入库时请填写素材名称");
      return;
    }

    const uploaded: Asset[] = [];
    const errors: string[] = [];

    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const form = new FormData();
        form.set("name", assetNameForFile(file, i, files.length));
        form.set("description", description);
        if (categoryId) form.set("categoryId", categoryId);
        form.set("file", file);

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
        setMessage(`正在上传 ${i + 1}/${files.length}：${file.name}`);

        const result = await uploadWithProgress(form, (loaded, total) => {
          const now = Date.now();
          const dt = (now - lastAt) / 1000;
          if (dt >= 0.25) {
            speedBps = Math.max(0, (loaded - lastLoaded) / dt);
            lastLoaded = loaded;
            lastAt = now;
          }
          const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
          setUploadProgress({
            fileIndex: i + 1,
            fileCount: files.length,
            fileName: file.name,
            percent,
            loaded,
            total,
            speedBps,
          });
        });

        if (!result.ok || !result.data.asset) {
          errors.push(`${file.name}：${result.data.error || "上传失败"}`);
          continue;
        }
        uploaded.push(result.data.asset);
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
        setMessage(result.data.error || "上传失败");
        return;
      }
      uploaded.push(result.data.asset);
    }

    setUploading(false);
    setUploadProgress(null);
    if (uploaded.length > 0) {
      setAssets((prev) => [...uploaded, ...prev]);
      setName("");
      setDescription("");
      setExternalUrl("");
      setFiles([]);
    }
    if (errors.length && uploaded.length) {
      setMessage(`成功入库 ${uploaded.length} 个；失败 ${errors.length} 个。${errors[0]}`);
    } else if (errors.length) {
      setMessage(errors.join("；"));
    } else {
      setMessage(
        uploaded.length > 1
          ? `已入库 ${uploaded.length} 个素材`
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
    router.push(`/studio/compose?assets=${encodeURIComponent(ids)}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">素材中心</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            上传视频、自由分类与长命名（最多 {ASSET_NAME_MAX} 字），再多选做成可售课程或专栏。
          </p>
        </div>
        <button className="btn btn-accent" type="button" onClick={goCompose}>
          用已选 {selected.length} 个素材做课
        </button>
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
          <h2 className="text-lg font-semibold">上传 / 入库视频</h2>
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
              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/mpeg"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            {files.length > 0 ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                已选 {files.length} 个文件
                {files.length <= 3
                  ? `：${files.map((f) => f.name).join("、")}`
                  : `：${files
                      .slice(0, 3)
                      .map((f) => f.name)
                      .join("、")} 等`}
              </p>
            ) : null}
          </div>
          <input
            className="field"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="或填写单个视频外链（http/https）"
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
          <h2 className="text-lg font-semibold">素材分类</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="field"
              value={newCategoryName}
              maxLength={MEDIA_CATEGORY_NAME_MAX}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={`新建分类名（最多 ${MEDIA_CATEGORY_NAME_MAX} 字）`}
            />
            <button className="btn btn-secondary" type="button" onClick={createCategory}>
              新建分类
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm ${activeCategory === "all" ? "bg-[var(--brand)] text-white" : "border border-[var(--line)]"}`}
              onClick={() => setActiveCategory("all")}
            >
              全部 ({assets.length})
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm ${activeCategory === "uncategorized" ? "bg-[var(--brand)] text-white" : "border border-[var(--line)]"}`}
              onClick={() => setActiveCategory("uncategorized")}
            >
              未分类
            </button>
            {categories.map((c) => (
              <div
                key={c.id}
                className={`flex items-center gap-1 rounded-full border px-2 py-1 text-sm ${
                  activeCategory === c.id
                    ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                    : "border-[var(--line)]"
                }`}
              >
                <button type="button" onClick={() => setActiveCategory(c.id)}>
                  {c.name} ({c._count?.assets ?? 0})
                </button>
                <button type="button" className="opacity-80" onClick={() => renameCategory(c.id, c.name)}>
                  改
                </button>
                <button type="button" className="opacity-80" onClick={() => deleteCategory(c.id)}>
                  删
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="surface rounded-[28px] p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">素材列表</h2>
          <input
            className="field sm:max-w-xs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索名称 / 备注 / 文件名"
          />
        </div>

        <div className="space-y-3">
          {filtered.map((asset) => {
            const checked = selected.includes(asset.id);
            return (
              <div
                key={asset.id}
                className={`rounded-2xl border px-4 py-3 ${
                  checked ? "border-[var(--brand)] bg-[rgba(15,107,92,0.06)]" : "border-[var(--line)] bg-white/60"
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
                      <span className="block font-medium leading-snug break-words">{asset.name}</span>
                      <span className="mt-1 block text-xs text-[var(--muted)]">
                        {asset.category?.name || "未分类"} · {formatBytes(asset.sizeBytes || 0)}
                        {asset.fileName ? ` · ${asset.fileName}` : ""}
                      </span>
                      {asset.description ? (
                        <span className="mt-1 block text-sm text-[var(--muted)]">{asset.description}</span>
                      ) : null}
                    </span>
                  </label>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <select
                      className="field py-2"
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
                    <button className="btn btn-secondary px-3 py-2 text-sm" type="button" onClick={() => renameAsset(asset)}>
                      重命名
                    </button>
                    <a
                      className="btn btn-secondary px-3 py-2 text-sm"
                      href={
                        asset.fileUrl.startsWith("vod:") ||
                        asset.storageProvider === "ALIYUN_VOD"
                          ? `/api/studio/media/${asset.id}/play`
                          : asset.fileUrl
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      预览
                    </a>
                    <button className="btn btn-secondary px-3 py-2 text-sm" type="button" onClick={() => removeAsset(asset.id)}>
                      删除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--muted)]">暂无素材，先上传一个视频吧</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

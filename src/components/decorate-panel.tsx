"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_DECORATE,
  DEFAULT_LOGO_URL,
  newBanner,
  type DecorateBanner,
  type DecorateConfig,
} from "@/lib/decorate";

type Props = { initial: DecorateConfig };

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";

export function DecoratePanel({ initial }: Props) {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<DecorateConfig>(() => ({
    ...DEFAULT_DECORATE,
    ...initial,
    banners: initial.banners?.length
      ? initial.banners
      : structuredClone(DEFAULT_DECORATE.banners),
  }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [bannerTarget, setBannerTarget] = useState<"new" | string>("new");

  function patch(partial: Partial<DecorateConfig>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  function updateBanner(id: string, partial: Partial<DecorateBanner>) {
    patch({
      banners: form.banners.map((b) =>
        b.id === id ? { ...b, ...partial } : b,
      ),
    });
  }

  function moveBanner(id: string, dir: -1 | 1) {
    const idx = form.banners.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= form.banners.length) return;
    const banners = [...form.banners];
    const [item] = banners.splice(idx, 1);
    banners.splice(next, 0, item);
    patch({ banners });
  }

  async function uploadImage(file: File): Promise<string | null> {
    const body = new FormData();
    body.append("file", file);
    setUploading(true);
    setMessage("");
    const res = await fetch("/api/studio/decorate/upload", {
      method: "POST",
      body,
    });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setMessage(data.error || "上传失败");
      return null;
    }
    return data.url as string;
  }

  async function onLogoFile(file: File | null) {
    if (!file) return;
    const url = await uploadImage(file);
    if (url) {
      patch({ logoUrl: url });
      setMessage("Logo 已上传，记得保存");
    }
  }

  async function onBannerFile(file: File | null) {
    if (!file) return;
    const url = await uploadImage(file);
    if (!url) return;
    if (bannerTarget === "new") {
      patch({
        banners: [...form.banners, newBanner({ url, alt: file.name })],
      });
      setMessage("已添加 Banner，记得保存");
    } else {
      updateBanner(bannerTarget, { url });
      setMessage("Banner 图片已更新，记得保存");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/studio/decorate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error || "保存失败");
      return;
    }
    if (data.decorate) setForm(data.decorate);
    setMessage("店铺装修已保存，前台即时生效");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="surface space-y-4 rounded-[28px] p-6">
        <div>
          <h2 className="text-lg font-semibold">品牌 Logo</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            显示在站点顶栏、页脚与首页主视觉。默认使用
            <code className="mx-1">{DEFAULT_LOGO_URL}</code>。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={form.logoUrl || DEFAULT_LOGO_URL}
              alt={form.brandName || "品牌 Logo"}
              className="h-16 w-auto max-w-[240px] object-contain"
            />
          </div>
          <div className="min-w-[240px] flex-1 space-y-3">
            <Field label="Logo 图片地址">
              <input
                className={inputClass}
                value={form.logoUrl}
                onChange={(e) => patch({ logoUrl: e.target.value })}
                placeholder={DEFAULT_LOGO_URL}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={uploading}
                onClick={() => logoInputRef.current?.click()}
              >
                {uploading ? "上传中…" : "上传 Logo"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => patch({ logoUrl: DEFAULT_LOGO_URL })}
              >
                恢复默认 Logo
              </button>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              className="hidden"
              onChange={(e) => void onLogoFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
        <Field
          label="网站名称"
          hint="浏览器标签、添加到主屏幕等提示里显示的名字，可任意修改"
        >
          <input
            className={inputClass}
            value={form.siteName || form.brandName}
            onChange={(e) => patch({ siteName: e.target.value })}
            placeholder="例如：歪歪艾斯"
            maxLength={80}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="品牌名称（Logo 旁文字）">
            <input
              className={inputClass}
              value={form.brandName}
              onChange={(e) => patch({ brandName: e.target.value })}
            />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.showBrandText}
              onChange={(e) => patch({ showBrandText: e.target.checked })}
            />
            Logo 旁额外显示品牌文字
          </label>
        </div>
      </div>

      <div className="surface space-y-4 rounded-[28px] p-6">
        <div>
          <h2 className="text-lg font-semibold">首页文案</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            首屏标题与说明。品牌 Logo 始终作为主视觉品牌信号。
          </p>
        </div>
        <Field label="主标题">
          <input
            className={inputClass}
            value={form.heroHeadline}
            onChange={(e) => patch({ heroHeadline: e.target.value })}
          />
        </Field>
        <Field label="副文案">
          <textarea
            className={inputClass}
            rows={3}
            value={form.heroSubtext}
            onChange={(e) => patch({ heroSubtext: e.target.value })}
          />
        </Field>
      </div>

      <div className="surface space-y-4 rounded-[28px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">首页主视觉 / Banner</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              第一张用作首页右侧大图；可上传、粘贴 URL、删除与调序。
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={uploading}
            onClick={() => {
              setBannerTarget("new");
              bannerInputRef.current?.click();
            }}
          >
            上传新图
          </button>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            className="hidden"
            onChange={(e) => void onBannerFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="space-y-3">
          {form.banners.map((banner, index) => (
            <div
              key={banner.id}
              className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white/60 p-4 lg:grid-cols-[120px_1fr_auto]"
            >
              <div className="overflow-hidden rounded-xl bg-[var(--bg-deep)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={banner.url}
                  alt={banner.alt || `Banner ${index + 1}`}
                  className="aspect-[4/3] h-full w-full object-cover"
                />
              </div>
              <div className="space-y-2">
                <Field label={`图片 URL${index === 0 ? "（首页主图）" : ""}`}>
                  <input
                    className={inputClass}
                    value={banner.url}
                    onChange={(e) =>
                      updateBanner(banner.id, { url: e.target.value })
                    }
                  />
                </Field>
                <Field label="替代文字">
                  <input
                    className={inputClass}
                    value={banner.alt}
                    onChange={(e) =>
                      updateBanner(banner.id, { alt: e.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2 lg:flex-col">
                <button
                  type="button"
                  className="btn btn-secondary px-3 py-2 text-sm"
                  disabled={uploading}
                  onClick={() => {
                    setBannerTarget(banner.id);
                    bannerInputRef.current?.click();
                  }}
                >
                  换图
                </button>
                <button
                  type="button"
                  className="btn btn-secondary px-3 py-2 text-sm"
                  disabled={index === 0}
                  onClick={() => moveBanner(banner.id, -1)}
                >
                  上移
                </button>
                <button
                  type="button"
                  className="btn btn-secondary px-3 py-2 text-sm"
                  disabled={index === form.banners.length - 1}
                  onClick={() => moveBanner(banner.id, 1)}
                >
                  下移
                </button>
                <button
                  type="button"
                  className="btn btn-secondary px-3 py-2 text-sm"
                  onClick={() =>
                    patch({
                      banners: form.banners.filter((b) => b.id !== banner.id),
                    })
                  }
                >
                  删除
                </button>
              </div>
            </div>
          ))}
          {form.banners.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              还没有 Banner。可上传图片，或点击下方添加空位后粘贴 URL。
            </p>
          ) : null}
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            patch({
              banners: [
                ...form.banners,
                newBanner({ url: "", alt: `Banner ${form.banners.length + 1}` }),
              ],
            })
          }
        >
          添加图片位（粘贴 URL）
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "保存中…" : "保存店铺装修"}
        </button>
        {message ? (
          <span className="text-sm text-[var(--brand-strong)]">{message}</span>
        ) : null}
      </div>
    </form>
  );
}

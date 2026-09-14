"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CoverImagePicker } from "@/components/cover-image-picker";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";
import { COVER_IMAGES } from "@andyyyds/shared/cover-images";
import {
  DEFAULT_DECORATE,
  DEFAULT_LOGO_URL,
  newBanner,
  type DecorateBanner,
  type DecorateConfig,
} from "@andyyyds/decorate/lib/decorate";

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
    heroPrimaryCta: {
      ...DEFAULT_DECORATE.heroPrimaryCta,
      ...(initial.heroPrimaryCta || {}),
    },
    heroSecondaryCta: {
      ...DEFAULT_DECORATE.heroSecondaryCta,
      ...(initial.heroSecondaryCta || {}),
    },
  }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<SaveStatus>(null);
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
    setFeedback(null);
    const result = await postSave("/api/studio/decorate/upload", {
      method: "POST",
      body,
    });
    setUploading(false);
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "上传失败" });
      return null;
    }
    return typeof result.data.url === "string" ? result.data.url : null;
  }

  async function onLogoFile(file: File | null) {
    if (!file) return;
    const url = await uploadImage(file);
    if (url) {
      patch({ logoUrl: url });
      setFeedback({ kind: "ok", text: "Logo 已上传，记得点保存" });
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
      setFeedback({ kind: "ok", text: "已添加 Banner，记得点保存" });
    } else {
      updateBanner(bannerTarget, { url });
      setFeedback({ kind: "ok", text: "Banner 图片已更新，记得点保存" });
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    // 只提交门面字段，避免覆盖「网站装扮」里已保存的主题/配色/背景/字号
    const result = await postSave("/api/studio/decorate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logoUrl: form.logoUrl,
        logoHref: form.logoHref || "",
        logoOpenInNewTab: Boolean(form.logoOpenInNewTab),
        siteName: form.siteName,
        brandName: form.brandName,
        showBrandText: form.showBrandText,
        heroHeadline: form.heroHeadline,
        heroSubtext: form.heroSubtext,
        heroImageUrl: form.heroImageUrl,
        banners: form.banners,
        heroPrimaryCta: form.heroPrimaryCta,
        heroSecondaryCta: form.heroSecondaryCta,
      }),
    });
    setSaving(false);
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "保存失败" });
      return;
    }
    if (result.data.decorate) {
      setForm(result.data.decorate as DecorateConfig);
    }
    setFeedback({ kind: "ok", text: "门面装修已保存成功" });
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
            <Field
              label="链接地址（首页 Logo）"
              hint="填了才可点；可写站内路径如 /courses，或 https:// 外链。顶栏 Logo 仍固定回首页。"
            >
              <input
                className={inputClass}
                value={form.logoHref || ""}
                onChange={(e) => patch({ logoHref: e.target.value })}
                placeholder="在此填写链接，如 /courses 或 https://…"
                inputMode="url"
                autoComplete="off"
              />
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--muted)]">
              <input
                type="checkbox"
                checked={Boolean(form.logoOpenInNewTab)}
                onChange={(e) =>
                  patch({ logoOpenInNewTab: e.target.checked })
                }
              />
              新标签页打开
            </label>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-white/50 p-3">
            <p className="text-sm font-medium text-[var(--ink)]">主按钮</p>
            <Field label="按钮文案">
              <input
                className={inputClass}
                value={form.heroPrimaryCta?.label || ""}
                onChange={(e) =>
                  patch({
                    heroPrimaryCta: {
                      ...form.heroPrimaryCta,
                      label: e.target.value,
                    },
                  })
                }
                placeholder="进入知识付费"
                maxLength={40}
              />
            </Field>
            <Field label="链接地址">
              <input
                className={inputClass}
                value={form.heroPrimaryCta?.href || ""}
                onChange={(e) =>
                  patch({
                    heroPrimaryCta: {
                      ...form.heroPrimaryCta,
                      href: e.target.value,
                    },
                  })
                }
                placeholder="在此填写链接，如 /courses 或 https://…"
                inputMode="url"
                autoComplete="off"
              />
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--muted)]">
              <input
                type="checkbox"
                checked={Boolean(form.heroPrimaryCta?.openInNewTab)}
                onChange={(e) =>
                  patch({
                    heroPrimaryCta: {
                      ...form.heroPrimaryCta,
                      openInNewTab: e.target.checked,
                    },
                  })
                }
              />
              新标签页打开
            </label>
          </div>
          <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-white/50 p-3">
            <p className="text-sm font-medium text-[var(--ink)]">次按钮</p>
            <Field label="按钮文案">
              <input
                className={inputClass}
                value={form.heroSecondaryCta?.label || ""}
                onChange={(e) =>
                  patch({
                    heroSecondaryCta: {
                      ...form.heroSecondaryCta,
                      label: e.target.value,
                    },
                  })
                }
                placeholder="了解公司"
                maxLength={40}
              />
            </Field>
            <Field label="链接地址">
              <input
                className={inputClass}
                value={form.heroSecondaryCta?.href || ""}
                onChange={(e) =>
                  patch({
                    heroSecondaryCta: {
                      ...form.heroSecondaryCta,
                      href: e.target.value,
                    },
                  })
                }
                placeholder="在此填写链接，如 /about/company 或 https://…"
                inputMode="url"
                autoComplete="off"
              />
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--muted)]">
              <input
                type="checkbox"
                checked={Boolean(form.heroSecondaryCta?.openInNewTab)}
                onChange={(e) =>
                  patch({
                    heroSecondaryCta: {
                      ...form.heroSecondaryCta,
                      openInNewTab: e.target.checked,
                    },
                  })
                }
              />
              新标签页打开
            </label>
          </div>
        </div>
      </div>

      <div className="surface space-y-4 rounded-[28px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">首页主视觉 / Banner</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              第一张用作首页右侧大图；可上传、粘贴 URL、删除与调序。每张图可单独填「链接地址」，主图默认新标签打开。
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
                <Field
                  label={
                    index === 0
                      ? "链接地址（首页主图，点击跳转）"
                      : "链接地址"
                  }
                  hint="可填站内路径或 https；留空则图片不可点"
                >
                  <input
                    className={inputClass}
                    value={banner.href || ""}
                    onChange={(e) =>
                      updateBanner(banner.id, { href: e.target.value })
                    }
                    placeholder="在此填写链接，如 /courses 或 https://…"
                    inputMode="url"
                    autoComplete="off"
                  />
                </Field>
                <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={banner.openInNewTab !== false}
                    onChange={(e) =>
                      updateBanner(banner.id, {
                        openInNewTab: e.target.checked,
                      })
                    }
                  />
                  新标签页打开
                  {index === 0 ? "（主图默认开启）" : ""}
                </label>
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

        <CoverImagePicker
          title="选用推荐主视觉（写入第一张 Banner，也可先添加图片位）"
          value={form.banners[0]?.url || ""}
          onChange={(url) => {
            const cover = COVER_IMAGES.find((c) => c.url === url);
            const alt = cover?.label || "首页主视觉";
            if (form.banners.length === 0) {
              patch({
                banners: [newBanner({ url, alt })],
                heroImageUrl: url,
              });
              return;
            }
            const [first, ...rest] = form.banners;
            patch({
              banners: [{ ...first, url, alt: first.alt || alt }, ...rest],
              heroImageUrl: url,
            });
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="btn btn-primary min-h-11"
          disabled={saving || uploading}
        >
          {saving ? "保存中…" : "保存门面装修"}
        </button>
        <SaveFeedback status={feedback} />
      </div>
    </form>
  );
}

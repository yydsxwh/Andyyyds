"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";
import type { DecorateConfig } from "@/lib/decorate";
import {
  DEFAULT_FONT_SIZES,
  FONT_SIZE_FIELDS,
  LAYOUT_DENSITIES,
  THEME_BACKGROUNDS,
  THEME_PACKS,
  THEME_PALETTE_CATEGORIES,
  THEME_PALETTES,
  applyThemePreview,
  backgroundById,
  buildThemeStyleVars,
  categoryLabel,
  normalizeFontSizes,
  paletteById,
  palettesInCategory,
  themePackById,
  type FontSizeKey,
  type FontSizesConfig,
  type LayoutDensity,
  type ThemePaletteCategory,
} from "@/lib/site-theme";

type TabKey = "packs" | "backgrounds" | "palettes" | "layout" | "type";
type PaletteFilter = "all" | ThemePaletteCategory;

/** 装扮草稿：仅本地试穿，点「保存装扮」后才写入 SiteSettings */
type ThemeDraft = {
  themePackId: string;
  paletteId: string;
  backgroundId: string;
  layoutDensity: LayoutDensity;
  fontSizes: FontSizesConfig;
};

type Props = {
  initial: DecorateConfig;
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "packs", label: "一键装扮" },
  { key: "backgrounds", label: "换背景" },
  { key: "palettes", label: "换配色" },
  { key: "layout", label: "换版式" },
  { key: "type", label: "字号" },
];

function draftFromConfig(config: DecorateConfig): ThemeDraft {
  return {
    themePackId: config.themePackId,
    paletteId: config.paletteId,
    backgroundId: config.backgroundId,
    layoutDensity: config.layoutDensity,
    fontSizes: normalizeFontSizes(config.fontSizes),
  };
}

function draftsEqual(a: ThemeDraft, b: ThemeDraft): boolean {
  if (
    a.themePackId !== b.themePackId ||
    a.paletteId !== b.paletteId ||
    a.backgroundId !== b.backgroundId ||
    a.layoutDensity !== b.layoutDensity
  ) {
    return false;
  }
  return FONT_SIZE_FIELDS.every(
    (field) => a.fontSizes[field.key] === b.fontSizes[field.key],
  );
}

export function SiteThemePanel({ initial }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("packs");
  // saved = 库中已生效；draft = 本页试穿，未点保存绝不写库
  const [saved, setSaved] = useState<ThemeDraft>(() => draftFromConfig(initial));
  const [draft, setDraft] = useState<ThemeDraft>(() => draftFromConfig(initial));
  const [paletteFilter, setPaletteFilter] = useState<PaletteFilter>("all");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveFeedback, setSaveFeedback] = useState<SaveStatus>(null);

  const { themePackId, paletteId, backgroundId, layoutDensity, fontSizes } =
    draft;
  const isDirty = !draftsEqual(draft, saved);
  const savedRef = useRef(saved);
  const dirtyRef = useRef(isDirty);
  savedRef.current = saved;
  dirtyRef.current = isDirty;

  // 服务端 refresh 后同步「已保存」基准；有未保存草稿时不覆盖试穿
  useEffect(() => {
    const next = draftFromConfig(initial);
    setDraft((prev) =>
      draftsEqual(prev, savedRef.current) ? next : prev,
    );
    setSaved(next);
  }, [
    initial.themePackId,
    initial.paletteId,
    initial.backgroundId,
    initial.layoutDensity,
    initial.fontSizes?.nav,
    initial.fontSizes?.brand,
    initial.fontSizes?.heroTitle,
    initial.fontSizes?.heroSubtext,
    initial.fontSizes?.sectionTitle,
    initial.fontSizes?.sectionDesc,
  ]);

  // 未保存离开页：浏览器原生提示（站内 Link 无法拦截，靠文案提醒）
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const filteredPalettes = useMemo(
    () => palettesInCategory(paletteFilter),
    [paletteFilter],
  );

  /** 「全部」时按分类分段展示，避免上百张卡片无序铺开 */
  const paletteSections = useMemo(() => {
    if (paletteFilter !== "all") {
      return [
        {
          id: paletteFilter,
          label: categoryLabel(paletteFilter),
          items: filteredPalettes,
        },
      ];
    }
    return THEME_PALETTE_CATEGORIES.map((cat) => ({
      id: cat.id,
      label: cat.label,
      items: THEME_PALETTES.filter((p) => p.category === cat.id),
    })).filter((section) => section.items.length > 0);
  }, [paletteFilter, filteredPalettes]);

  const draftVars = useMemo(
    () =>
      buildThemeStyleVars({
        paletteId,
        backgroundId,
        layoutDensity,
        fontSizes,
      }),
    [paletteId, backgroundId, layoutDensity, fontSizes],
  );

  // 试穿只改本页 CSS 变量；离开或切换时写回「已保存」，避免草稿泄漏到其它路由
  useEffect(() => {
    applyThemePreview(draftVars);
    return () => {
      const latest = savedRef.current;
      applyThemePreview(
        buildThemeStyleVars({
          paletteId: latest.paletteId,
          backgroundId: latest.backgroundId,
          layoutDensity: latest.layoutDensity,
          fontSizes: latest.fontSizes,
        }),
      );
    };
  }, [draftVars]);

  const currentPack = themePackById(themePackId);
  const currentPalette = paletteById(paletteId);
  const currentBackground = backgroundById(backgroundId);

  function applyPack(packId: string) {
    const pack = themePackById(packId);
    if (!pack) return;
    setDraft({
      themePackId: pack.id,
      paletteId: pack.paletteId,
      backgroundId: pack.backgroundId,
      layoutDensity: draft.layoutDensity,
      fontSizes: draft.fontSizes,
    });
    setMessage(`已试穿「${pack.name}」，请点「保存装扮」后全站生效`);
  }

  function applyFontSize(key: FontSizeKey, value: number) {
    setDraft((prev) => ({
      ...prev,
      fontSizes: normalizeFontSizes({ ...prev.fontSizes, [key]: value }),
    }));
    setMessage("已试穿字号，请点「保存装扮」后全站生效");
  }

  function resetFontSizes() {
    setDraft((prev) => ({
      ...prev,
      fontSizes: { ...DEFAULT_FONT_SIZES },
    }));
    setMessage("已恢复默认字号（仍需点「保存装扮」）");
  }

  function applyPalette(id: string) {
    setDraft((prev) => ({
      ...prev,
      paletteId: id,
      themePackId: "",
    }));
    setMessage(`已试穿配色「${paletteById(id).name}」，请点「保存装扮」`);
  }

  function applyBackground(id: string) {
    setDraft((prev) => ({
      ...prev,
      backgroundId: id,
      themePackId: "",
    }));
    setMessage(`已试穿背景「${backgroundById(id).name}」，请点「保存装扮」`);
  }

  function applyLayout(id: LayoutDensity) {
    setDraft((prev) => ({ ...prev, layoutDensity: id }));
    setMessage(
      `已试穿版式「${LAYOUT_DENSITIES.find((d) => d.id === id)?.name}」，请点「保存装扮」`,
    );
  }

  function resetDraft() {
    // 撤销到上次成功写入 decorateJson 的组合，而不是清空
    setDraft(saved);
    setMessage("已撤销试穿，恢复为上次保存");
  }

  async function save() {
    if (!isDirty || saving) return;
    setSaving(true);
    setMessage("");
    setSaveFeedback(null);
    const result = await postSave("/api/studio/decorate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        themePackId,
        paletteId,
        backgroundId,
        layoutDensity,
        fontSizes,
      }),
    });
    setSaving(false);
    if (!result.ok) {
      setSaveFeedback({
        kind: "error",
        text: result.error || "保存失败",
      });
      return;
    }
    const next = result.data.decorate
      ? draftFromConfig(result.data.decorate as DecorateConfig)
      : draft;
    setSaved(next);
    setDraft(next);
    setSaveFeedback({
      kind: "ok",
      text: "装扮已保存成功，前台访客将看到新装扮",
    });
    router.refresh();
  }

  const saveLabel = saving ? "保存中…" : "保存装扮";

  const toolbarActions = (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="btn btn-secondary min-h-11 px-4 text-sm"
        title="新窗口打开前台，显示的是已保存装扮（非本页试穿）"
      >
        预览前台
      </a>
      <button
        type="button"
        className="btn btn-secondary min-h-11 px-4 text-sm"
        disabled={!isDirty || saving}
        onClick={resetDraft}
      >
        撤销试穿
      </button>
      <button
        type="button"
        className={`btn btn-primary min-h-11 min-w-[7rem] px-5 text-sm font-semibold shadow-sm ${
          isDirty && !saving ? "ring-2 ring-[var(--brand)]/40" : ""
        }`}
        disabled={!isDirty || saving}
        onClick={() => void save()}
      >
        {saveLabel}
      </button>
      <SaveFeedback status={saveFeedback} />
    </div>
  );

  return (
    <div className="space-y-4 pb-24">
      {/*
        吸顶工具栏：压在全站 header（h-14/h-16、z-40）之下，
        滚动选配色时「保存装扮」始终可见。
      */}
      <div className="sticky top-14 z-30 -mx-1 rounded-[22px] border-2 border-[var(--brand)]/25 bg-[var(--card)] px-3 py-3 shadow-lg backdrop-blur-md sm:top-16 sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[var(--ink)]">网站装扮</p>
              {isDirty ? (
                <span className="rounded-full bg-[var(--fire-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--fire-strong)]">
                  未保存
                </span>
              ) : (
                <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--brand-strong)]">
                  已保存
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
              试穿中：
              {currentPack ? currentPack.name : "自定义组合"} ·{" "}
              {currentPalette.name} · {currentBackground.name}
              {isDirty ? " · 访客仍见上次保存" : ""}
            </p>
          </div>
          {toolbarActions}
        </div>
        {saveFeedback ? (
          <div className="mt-2">
            <SaveFeedback status={saveFeedback} />
          </div>
        ) : message ? (
          <p className="mt-2 text-sm font-medium text-[var(--brand-strong)]">
            {message}
          </p>
        ) : (
          <p className="mt-2 text-xs text-[var(--muted)]">
            点选主题/背景/配色只在本页试穿，不会自动改全站；确认后必须点「保存装扮」。
          </p>
        )}
      </div>

      {/* 底部固定保存条（手机+电脑）：选了未保存时一直能看见 */}
      {isDirty ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--card)] px-3 py-3 shadow-[0_-8px_28px_rgba(0,0,0,0.12)] sm:px-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--fire-strong)]">
                有未保存的装扮
              </p>
              <p className="truncate text-xs text-[var(--muted)]">
                {currentPack ? currentPack.name : "自定义"} · {currentPalette.name}{" "}
                · 点保存后全站生效
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary min-h-11 px-3 text-sm sm:px-4"
                disabled={saving}
                onClick={resetDraft}
              >
                撤销
              </button>
              <button
                type="button"
                className="btn btn-primary min-h-11 min-w-[7rem] px-5 text-sm font-semibold ring-2 ring-[var(--brand)]/35"
                disabled={saving}
                onClick={() => void save()}
              >
                {saveLabel}
              </button>
              <SaveFeedback status={saveFeedback} />
            </div>
          </div>
        </div>
      ) : null}

      {/* 当前装扮条 */}
      <div className="surface rounded-[22px] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">当前装扮</h2>
          <span className="text-xs text-[var(--muted)]">
            点击下方仅试穿，需点「保存装扮」才改全站
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <CurrentSlot
            label="主题包"
            title={currentPack?.name || "自定义"}
            preview={currentPack?.cover || currentBackground.preview}
          />
          <CurrentSlot
            label="背景"
            title={currentBackground.name}
            preview={currentBackground.preview}
          />
          <CurrentSlot
            label="配色"
            title={currentPalette.name}
            swatches={currentPalette.swatches}
          />
          <CurrentSlot
            label="版式"
            title={
              LAYOUT_DENSITIES.find((d) => d.id === layoutDensity)?.name ||
              "标准"
            }
            preview="linear-gradient(135deg, var(--bg-deep), var(--card))"
          />
          <CurrentSlot
            label="字号"
            title={`导航 ${fontSizes.nav}px`}
            preview="linear-gradient(135deg, var(--brand-soft), var(--card))"
          />
        </div>
      </div>

      {/* 分类 Tab：触控友好，窄屏可横滑 */}
      <div
        className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--line)] bg-white/70 p-1"
        role="tablist"
        aria-label="装扮分类"
      >
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-medium transition ${
                active
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)]"
              }`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "packs" ? (
        <section className="space-y-3">
          <Header
            title="一键装扮"
            hint="主题包会同时切换背景与配色，适合快速定调"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {THEME_PACKS.map((pack) => {
              const selected = themePackId === pack.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => applyPack(pack.id)}
                  className={`group overflow-hidden rounded-2xl border text-left transition ${
                    selected
                      ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/30"
                      : "border-[var(--line)] hover:border-[var(--brand)]/40"
                  }`}
                >
                  <div
                    className="aspect-[4/3] w-full bg-[var(--bg-deep)]"
                    style={{ background: pack.cover }}
                  />
                  <div className="space-y-0.5 bg-white/90 px-3 py-2.5">
                    <p className="text-sm font-semibold text-[var(--ink)]">
                      {pack.name}
                    </p>
                    <p className="text-xs text-[var(--muted)]">{pack.tagline}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "backgrounds" ? (
        <section className="space-y-3">
          <Header
            title="换背景"
            hint="含渐变、纹理与照片；照片自带遮罩，保证正文可读"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {THEME_BACKGROUNDS.map((bg) => {
              const selected = backgroundId === bg.id;
              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => applyBackground(bg.id)}
                  className={`overflow-hidden rounded-2xl border text-left transition ${
                    selected
                      ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/30"
                      : "border-[var(--line)] hover:border-[var(--brand)]/40"
                  }`}
                >
                  <div
                    className="aspect-[4/3] w-full bg-[var(--bg-deep)]"
                    style={{ background: bg.preview }}
                  />
                  <div className="flex items-center justify-between gap-2 bg-white/90 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold">{bg.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {bg.kind === "photo"
                          ? "照片"
                          : bg.kind === "pattern"
                            ? "纹理"
                            : "渐变"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "palettes" ? (
        <section className="space-y-4">
          <Header
            title="换配色"
            hint={`共 ${THEME_PALETTES.length} 套原创配色，映射全站 CSS 变量（品牌色、点缀色、底色等）`}
          />
          {/* 分类筛选：窄屏横滑，触控可点 */}
          <div
            className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="配色分类"
          >
            <PaletteFilterChip
              label="全部"
              active={paletteFilter === "all"}
              onClick={() => setPaletteFilter("all")}
            />
            {THEME_PALETTE_CATEGORIES.map((cat) => (
              <PaletteFilterChip
                key={cat.id}
                label={cat.label}
                active={paletteFilter === cat.id}
                onClick={() => setPaletteFilter(cat.id)}
              />
            ))}
          </div>
          <div className="space-y-6">
            {paletteSections.map((section) => (
              <div key={section.id} className="space-y-3">
                {paletteFilter === "all" ? (
                  <h3 className="text-sm font-semibold text-[var(--ink)]">
                    {section.label}
                    <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                      {section.items.length}
                    </span>
                  </h3>
                ) : null}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {section.items.map((palette) => {
                    const selected = paletteId === palette.id;
                    return (
                      <button
                        key={palette.id}
                        type="button"
                        onClick={() => applyPalette(palette.id)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/30"
                            : "border-[var(--line)] bg-white/70 hover:border-[var(--brand)]/40"
                        }`}
                      >
                        <div className="flex h-10 overflow-hidden rounded-xl">
                          {palette.swatches.map((color, idx) => (
                            <span
                              key={`${palette.id}-${idx}`}
                              className="flex-1"
                              style={{ background: color }}
                            />
                          ))}
                        </div>
                        <p className="mt-3 text-sm font-semibold">
                          {palette.name}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {palette.tagline}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "layout" ? (
        <section className="space-y-3">
          <Header
            title="换版式"
            hint="轻量密度：只调圆角与表面呼吸感，不改页面结构"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {LAYOUT_DENSITIES.map((item) => {
              const selected = layoutDensity === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applyLayout(item.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected
                      ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/30"
                      : "border-[var(--line)] bg-white/70 hover:border-[var(--brand)]/40"
                  }`}
                >
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {item.tagline}
                  </p>
                  <div
                    className="mt-3 border border-[var(--line)] bg-[var(--card)]"
                    style={{
                      borderRadius:
                        item.id === "compact"
                          ? 14
                          : item.id === "airy"
                            ? 28
                            : 20,
                      padding:
                        item.id === "compact"
                          ? 10
                          : item.id === "airy"
                            ? 18
                            : 14,
                    }}
                  >
                    <div className="h-2 w-2/3 rounded bg-[var(--brand-soft)]" />
                    <div className="mt-2 h-2 w-full rounded bg-[var(--bg-deep)]" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "type" ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <Header
              title="字号"
              hint="分别调节顶栏导航、首页主标题、区块标题等；拖动后即时试穿，需点「保存装扮」全站生效"
            />
            <button
              type="button"
              className="btn btn-secondary min-h-11 w-full shrink-0 px-4 text-sm sm:w-auto"
              onClick={resetFontSizes}
            >
              恢复默认字号
            </button>
          </div>

          <div className="surface rounded-[22px] p-4">
            <p className="text-xs text-[var(--muted)]">预览</p>
            <p
              className="mt-2 font-medium text-[var(--muted)]"
              style={{ fontSize: `${fontSizes.nav}px` }}
            >
              导航示例：首页 · 公司介绍 · 商城
            </p>
            <p
              className="mt-3 font-semibold leading-tight text-[var(--ink)]"
              style={{ fontSize: `${fontSizes.heroTitle}px` }}
            >
              首页主标题预览
            </p>
            <p
              className="mt-2 text-[var(--muted)]"
              style={{ fontSize: `${fontSizes.heroSubtext}px` }}
            >
              副文案预览：说明文字会随滑杆变大变小
            </p>
            <p
              className="mt-4 font-semibold"
              style={{ fontSize: `${fontSizes.sectionTitle}px` }}
            >
              区块标题
            </p>
            <p
              className="mt-1 text-[var(--muted)]"
              style={{ fontSize: `${fontSizes.sectionDesc}px` }}
            >
              区块说明文字
            </p>
          </div>

          <div className="space-y-4">
            {FONT_SIZE_FIELDS.map((field) => {
              const value = fontSizes[field.key];
              return (
                <label
                  key={field.key}
                  className="block rounded-2xl border border-[var(--line)] bg-white/70 p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-[var(--ink)]">
                      {field.label}
                    </span>
                    <span className="tabular-nums text-sm text-[var(--brand-strong)]">
                      {value}px
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">{field.hint}</p>
                  <input
                    type="range"
                    className="mt-3 w-full accent-[var(--brand)]"
                    min={field.min}
                    max={field.max}
                    step={1}
                    value={value}
                    onChange={(e) =>
                      applyFontSize(field.key, Number(e.target.value))
                    }
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-[var(--muted)]">
                    <span>{field.min}px</span>
                    <span>{field.max}px</span>
                  </div>
                </label>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Header({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function PaletteFilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`min-h-10 shrink-0 rounded-full px-3.5 text-sm font-medium transition ${
        active
          ? "bg-[var(--brand)] text-white"
          : "border border-[var(--line)] bg-white/80 text-[var(--muted)] hover:border-[var(--brand)]/40 hover:text-[var(--brand-strong)]"
      }`}
    >
      {label}
    </button>
  );
}

function CurrentSlot({
  label,
  title,
  preview,
  swatches,
}: {
  label: string;
  title: string;
  preview?: string;
  swatches?: string[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white/80">
      {swatches ? (
        <div className="flex h-16">
          {swatches.map((color) => (
            <span key={color} className="flex-1" style={{ background: color }} />
          ))}
        </div>
      ) : (
        <div
          className="h-16 bg-[var(--bg-deep)]"
          style={preview ? { background: preview } : undefined}
        />
      )}
      <div className="px-2.5 py-2">
        <p className="text-[11px] text-[var(--muted)]">{label}</p>
        <p className="truncate text-xs font-medium">{title}</p>
      </div>
    </div>
  );
}

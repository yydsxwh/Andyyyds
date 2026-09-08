"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";
import { SiteFontLoader } from "@/components/site-font-loader";
import {
  HomeClockFace,
  HOME_CLOCK_FRAME_CLASS,
} from "@/components/home-clock-face";
import type { DecorateConfig } from "@andyyyds/shared/decorate";
import {
  HOME_CLOCK_STYLES,
  HOME_CLOCK_STYLE_META,
  homeClockEqual,
  normalizeHomeClock,
  type HomeClockConfig,
} from "@andyyyds/shared/home-clock";
import {
  HOME_LOGO_ALT,
  HOME_LOGO_ANIM_SRC,
  HOME_LOGO_STILL_SRC,
  homeLogoEqual,
  normalizeHomeLogo,
  type HomeLogoConfig,
} from "@andyyyds/shared/home-logo";
import { resolveThemeFx } from "@andyyyds/shared/site-theme-islands";
import {
  DEFAULT_FONT_SIZES,
  FONT_SIZE_FIELDS,
  LAYOUT_DENSITIES,
  THEME_BACKGROUNDS,
  THEME_PACK_CATEGORIES,
  THEME_PALETTE_CATEGORIES,
  THEME_PALETTES,
  applyThemePreview,
  backgroundById,
  buildThemeStyleVars,
  categoryLabel,
  normalizeFontSizes,
  paletteById,
  packsInCategory,
  palettesInCategory,
  themePackById,
  type FontSizeKey,
  type FontSizesConfig,
  type LayoutDensity,
  type ThemePackCategory,
  type ThemePaletteCategory,
} from "@andyyyds/shared/site-theme";
import {
  DEFAULT_TYPOGRAPHY,
  FONT_CATEGORIES,
  FONT_LIBRARY,
  TEXT_ANIMATIONS,
  TEXT_COLOR_PRESETS,
  TEXT_EFFECTS,
  THEME_TEXT_COLOR,
  buildTypographyCss,
  buildTypographyFontVars,
  collectFontCssUrls,
  collectTypographyFontUrls,
  filterFonts,
  fontById,
  normalizeTextColor,
  normalizeTypography,
  typoRoleClass,
  typographyEqual,
  type FontCategory,
  type RoleTypography,
  type TextAnimationId,
  type TextEffectId,
  type TypographyConfig,
} from "@andyyyds/shared/site-typography";

type TabKey = "packs" | "backgrounds" | "palettes" | "layout" | "type" | "clock" | "logo";
type PaletteFilter = "all" | ThemePaletteCategory;
type PackFilter = "all" | ThemePackCategory;

/** 装扮草稿：仅本地试穿，点「保存装扮」后才写入 SiteSettings */
type ThemeDraft = {
  themePackId: string;
  paletteId: string;
  backgroundId: string;
  layoutDensity: LayoutDensity;
  fontSizes: FontSizesConfig;
  typography: TypographyConfig;
  homeClock: HomeClockConfig;
  homeLogo: HomeLogoConfig;
};

type Props = {
  initial: DecorateConfig;
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "packs", label: "一键装扮" },
  { key: "backgrounds", label: "换背景" },
  { key: "palettes", label: "换配色" },
  { key: "layout", label: "换版式" },
  { key: "type", label: "文字" },
  { key: "clock", label: "时钟" },
  { key: "logo", label: "颗秒标" },
];

function draftFromConfig(config: DecorateConfig): ThemeDraft {
  return {
    themePackId: config.themePackId,
    paletteId: config.paletteId,
    backgroundId: config.backgroundId,
    layoutDensity: config.layoutDensity,
    fontSizes: normalizeFontSizes(config.fontSizes),
    typography: normalizeTypography(config.typography),
    homeClock: normalizeHomeClock(config.homeClock),
    homeLogo: normalizeHomeLogo(config.homeLogo),
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
  const sizesMatch = FONT_SIZE_FIELDS.every(
    (field) => a.fontSizes[field.key] === b.fontSizes[field.key],
  );
  return (
    sizesMatch &&
    typographyEqual(a.typography, b.typography) &&
    homeClockEqual(a.homeClock, b.homeClock) &&
    homeLogoEqual(a.homeLogo, b.homeLogo)
  );
}

export function SiteThemePanel({ initial }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("packs");
  // saved = 库中已生效；draft = 本页试穿，未点保存绝不写库
  const [saved, setSaved] = useState<ThemeDraft>(() => draftFromConfig(initial));
  const [draft, setDraft] = useState<ThemeDraft>(() => draftFromConfig(initial));
  const [paletteFilter, setPaletteFilter] = useState<PaletteFilter>("all");
  // 默认露出「海岛/阳光」，方便站长一键试穿热带装扮
  const [packFilter, setPackFilter] = useState<PackFilter>("island");
  const [fontFilter, setFontFilter] = useState<FontCategory | "all">("all");
  const [fontSearch, setFontSearch] = useState("");
  const [activeTypeRole, setActiveTypeRole] = useState<FontSizeKey>("heroTitle");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveFeedback, setSaveFeedback] = useState<SaveStatus>(null);

  const {
    themePackId,
    paletteId,
    backgroundId,
    layoutDensity,
    fontSizes,
    typography,
    homeClock,
    homeLogo,
  } = draft;
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
    initial.fontSizes?.portalCardTitle,
    initial.fontSizes?.portalCardDesc,
    initial.fontSizes?.filterTag,
    initial.typography,
    initial.homeClock,
    initial.homeLogo,
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

  const filteredPacks = useMemo(
    () => packsInCategory(packFilter),
    [packFilter],
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
        fontFamilyVars: buildTypographyFontVars(typography),
      }),
    [paletteId, backgroundId, layoutDensity, fontSizes, typography],
  );

  const draftTypographyCss = useMemo(
    () => buildTypographyCss(typography),
    [typography],
  );

  const filteredFonts = useMemo(
    () => filterFonts(fontFilter, fontSearch),
    [fontFilter, fontSearch],
  );

  // 试穿中的字体 + 当前列表可见字体一并注入，选字预览才能立刻用真字体渲染
  const draftFontUrls = useMemo(() => {
    const urls = new Set([
      ...collectTypographyFontUrls(typography),
      ...collectFontCssUrls(filteredFonts),
    ]);
    return [...urls];
  }, [typography, filteredFonts]);

  // 试穿只改本页 CSS 变量；离开或切换时写回「已保存」，避免草稿泄漏到其它路由
  useEffect(() => {
    applyThemePreview(draftVars);
    // 同步海岛动效到 html，与配色试穿同一生命周期
    const draftFx = resolveThemeFx({
      themePackId,
      backgroundId,
      packFx: themePackById(themePackId)?.fx,
    });
    const root = document.documentElement;
    if (draftFx) root.setAttribute("data-theme-fx", draftFx);
    else root.removeAttribute("data-theme-fx");

    let styleEl = document.getElementById(
      "site-typography-preview",
    ) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "site-typography-preview";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = draftTypographyCss;
    return () => {
      const latest = savedRef.current;
      applyThemePreview(
        buildThemeStyleVars({
          paletteId: latest.paletteId,
          backgroundId: latest.backgroundId,
          layoutDensity: latest.layoutDensity,
          fontSizes: latest.fontSizes,
          fontFamilyVars: buildTypographyFontVars(latest.typography),
        }),
      );
      const savedFx = resolveThemeFx({
        themePackId: latest.themePackId,
        backgroundId: latest.backgroundId,
        packFx: themePackById(latest.themePackId)?.fx,
      });
      if (savedFx) root.setAttribute("data-theme-fx", savedFx);
      else root.removeAttribute("data-theme-fx");
      if (styleEl) {
        styleEl.textContent = buildTypographyCss(latest.typography);
      }
    };
  }, [draftVars, draftTypographyCss, themePackId, backgroundId]);

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
      typography: draft.typography,
      homeClock: draft.homeClock,
      homeLogo: draft.homeLogo,
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

  function applyRoleTypography(
    key: FontSizeKey,
    patch: Partial<RoleTypography>,
  ) {
    setDraft((prev) => ({
      ...prev,
      typography: normalizeTypography({
        ...prev.typography,
        [key]: { ...prev.typography[key], ...patch },
      }),
    }));
    setMessage("已试穿文字样式，请点「保存装扮」后全站生效");
  }

  function resetFontSizes() {
    setDraft((prev) => ({
      ...prev,
      fontSizes: { ...DEFAULT_FONT_SIZES },
    }));
    setMessage("已恢复默认字号（仍需点「保存装扮」）");
  }

  function resetTypography() {
    setDraft((prev) => ({
      ...prev,
      typography: structuredClone(DEFAULT_TYPOGRAPHY),
    }));
    setMessage("已恢复默认字体与特效（仍需点「保存装扮」）");
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

  function applyHomeClock(patch: Partial<HomeClockConfig>) {
    setDraft((prev) => ({
      ...prev,
      homeClock: normalizeHomeClock({ ...prev.homeClock, ...patch }),
    }));
    setMessage("已试穿时钟，请点「保存装扮」后全站生效");
  }

  function applyHomeLogo(patch: Partial<HomeLogoConfig>) {
    setDraft((prev) => ({
      ...prev,
      homeLogo: normalizeHomeLogo({ ...prev.homeLogo, ...patch }),
    }));
    setMessage("已试穿颗秒标，请点「保存装扮」后全站生效");
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
        typography,
        // 未改时钟时不回写，避免覆盖首页刚拖好的位置
        ...(homeClockEqual(homeClock, saved.homeClock) ? {} : { homeClock }),
        ...(homeLogoEqual(homeLogo, saved.homeLogo) ? {} : { homeLogo }),
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
      <SiteFontLoader urls={draftFontUrls} />
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
            点选主题/背景/配色/时钟/颗秒标只在本页试穿，不会自动改全站；确认后必须点「保存装扮」。位置请回首页按住拖动。
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
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
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
            label="文字"
            title={`${fontById(typography.heroTitle.fontFamily).name} · ${fontSizes.heroTitle}px`}
            preview="linear-gradient(135deg, var(--brand-soft), var(--card))"
          />
          <CurrentSlot
            label="时钟"
            title={HOME_CLOCK_STYLE_META[homeClock.style]?.name || "皇家金"}
            preview="linear-gradient(145deg, #1a140c, #d4af37 55%, #f3e6c4)"
          />
          <CurrentSlot
            label="颗秒标"
            title={homeLogo.visible ? (homeLogo.useAnimation ? "动画" : "静帧") : "已隐藏"}
            preview="radial-gradient(circle at 40% 35%, #7cff6b, #1a140c 70%)"
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
            hint="主题包会同时切换背景与配色；「海岛/阳光」含唯美摄影与轻动效"
          />
          {/* 分类横滑：窄屏/微信内可触控点选「海岛/阳光」 */}
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            role="group"
            aria-label="主题包分类"
          >
            {THEME_PACK_CATEGORIES.map((cat) => {
              const active = packFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`min-h-10 shrink-0 rounded-full px-3.5 text-sm font-medium transition ${
                    active
                      ? "bg-[var(--brand)] text-white"
                      : "border border-[var(--line)] bg-white/80 text-[var(--muted)]"
                  }`}
                  onClick={() => setPackFilter(cat.id)}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filteredPacks.map((pack) => {
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
        <TypeTab
          fontSizes={fontSizes}
          typography={typography}
          activeRole={activeTypeRole}
          fontFilter={fontFilter}
          fontSearch={fontSearch}
          filteredFonts={filteredFonts}
          onActiveRole={setActiveTypeRole}
          onFontFilter={setFontFilter}
          onFontSearch={setFontSearch}
          onFontSize={applyFontSize}
          onRoleTypography={applyRoleTypography}
          onResetSizes={resetFontSizes}
          onResetTypography={resetTypography}
        />
      ) : null}

      {tab === "clock" ? (
        <ClockTab clock={homeClock} onChange={applyHomeClock} />
      ) : null}

      {tab === "logo" ? (
        <LogoTab logo={homeLogo} onChange={applyHomeLogo} />
      ) : null}
    </div>
  );
}

function TypeTab({
  fontSizes,
  typography,
  activeRole,
  fontFilter,
  fontSearch,
  filteredFonts,
  onActiveRole,
  onFontFilter,
  onFontSearch,
  onFontSize,
  onRoleTypography,
  onResetSizes,
  onResetTypography,
}: {
  fontSizes: FontSizesConfig;
  typography: TypographyConfig;
  activeRole: FontSizeKey;
  fontFilter: FontCategory | "all";
  fontSearch: string;
  filteredFonts: ReturnType<typeof filterFonts>;
  onActiveRole: (key: FontSizeKey) => void;
  onFontFilter: (cat: FontCategory | "all") => void;
  onFontSearch: (q: string) => void;
  onFontSize: (key: FontSizeKey, value: number) => void;
  onRoleTypography: (key: FontSizeKey, patch: Partial<RoleTypography>) => void;
  onResetSizes: () => void;
  onResetTypography: () => void;
}) {
  const field = FONT_SIZE_FIELDS.find((f) => f.key === activeRole)!;
  const role = typography[activeRole];
  const size = fontSizes[activeRole];
  const previewClass = typoRoleClass(activeRole);
  const colorValue = role.color || THEME_TEXT_COLOR;
  const pickerValue = colorValue || "#1a1a1a";
  // 十六进制输入允许半成品，合法时再写回，避免边输边被清空
  const [hexDraft, setHexDraft] = useState(role.color);
  useEffect(() => {
    setHexDraft(role.color);
  }, [activeRole, role.color]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Header
          title="文字装扮"
          hint={`字号 + 颜色 + 字体（${FONT_LIBRARY.length} 款）+ 特效 + 动画；按文本角色分别设置，点选后即时试穿，需「保存装扮」全站生效。字体按需 CDN 加载，移动端/微信有系统字体回退。`}
        />
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            className="btn btn-secondary min-h-11 w-full px-4 text-sm sm:w-auto"
            onClick={onResetSizes}
          >
            恢复默认字号
          </button>
          <button
            type="button"
            className="btn btn-secondary min-h-11 w-full px-4 text-sm sm:w-auto"
            onClick={onResetTypography}
          >
            恢复字体特效
          </button>
        </div>
      </div>

      {/* 角色切换：窄屏横滑 */}
      <div
        className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="文本角色"
      >
        {FONT_SIZE_FIELDS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={activeRole === item.key}
            className={`min-h-10 shrink-0 rounded-full px-3.5 text-sm font-medium transition ${
              activeRole === item.key
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--line)] bg-white/80 text-[var(--muted)]"
            }`}
            onClick={() => onActiveRole(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="surface rounded-[22px] p-4">
        <p className="text-xs text-[var(--muted)]">
          预览 · {field.label}（{fontById(role.fontFamily).name}
          {role.color ? ` · ${role.color}` : " · 跟随主题色"}）
        </p>
        <p
          className={`mt-3 font-semibold leading-tight text-[var(--ink)] ${previewClass}`}
          style={{
            fontSize: `${size}px`,
            ...(role.color ? { color: role.color } : {}),
          }}
        >
          {field.label}预览：歪歪艾斯课程平台
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">{field.hint}</p>
      </div>

      {/* 字号 */}
      <label className="block rounded-2xl border border-[var(--line)] bg-white/70 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-[var(--ink)]">字号</span>
          <span className="tabular-nums text-sm text-[var(--brand-strong)]">
            {size}px
          </span>
        </div>
        <input
          type="range"
          className="mt-3 w-full accent-[var(--brand)]"
          min={field.min}
          max={field.max}
          step={1}
          value={size}
          onChange={(e) => onFontSize(activeRole, Number(e.target.value))}
        />
        <div className="mt-1 flex justify-between text-[11px] text-[var(--muted)]">
          <span>{field.min}px</span>
          <span>{field.max}px</span>
        </div>
      </label>

      {/* 文字颜色：快捷色板 + 原生 color（手机触控可用） */}
      <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">文字颜色</h3>
          <span className="text-xs text-[var(--muted)]">
            {role.color ? role.color : "跟随主题"}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {TEXT_COLOR_PRESETS.map((preset) => {
            const selected =
              normalizeTextColor(preset.value) ===
              normalizeTextColor(colorValue);
            const isTheme = preset.value === THEME_TEXT_COLOR;
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.label}
                aria-label={preset.label}
                aria-pressed={selected}
                onClick={() =>
                  onRoleTypography(activeRole, {
                    color: normalizeTextColor(preset.value),
                  })
                }
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-center transition ${
                  selected
                    ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/30"
                    : "border-[var(--line)] bg-white/90"
                }`}
              >
                <span
                  className="h-6 w-6 rounded-full border border-black/10"
                  style={
                    isTheme
                      ? {
                          background:
                            "linear-gradient(135deg, var(--ink), var(--brand), var(--fire))",
                        }
                      : { background: preset.value }
                  }
                />
                <span className="max-w-full truncate text-[10px] text-[var(--muted)]">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex min-h-12 flex-1 items-center gap-3 rounded-xl border border-[var(--line)] bg-white/90 px-3">
            <span className="shrink-0 text-sm text-[var(--muted)]">自定义</span>
            <input
              type="color"
              className="h-10 w-14 cursor-pointer rounded border-0 bg-transparent p-0"
              value={pickerValue}
              onChange={(e) =>
                onRoleTypography(activeRole, {
                  color: normalizeTextColor(e.target.value),
                })
              }
              aria-label="自定义文字颜色"
            />
            <input
              type="text"
              inputMode="text"
              className="min-h-10 w-full min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white px-2 text-sm"
              placeholder="#1a1a1a 或留空跟随主题"
              value={hexDraft}
              onChange={(e) => {
                const next = e.target.value.trim();
                if (next && !/^#[0-9a-fA-F]{0,6}$/.test(next)) return;
                setHexDraft(next);
                if (!next || /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(next)) {
                  onRoleTypography(activeRole, {
                    color: normalizeTextColor(next),
                  });
                }
              }}
              onBlur={() => {
                const normalized = normalizeTextColor(hexDraft);
                setHexDraft(normalized);
                if (normalized !== role.color) {
                  onRoleTypography(activeRole, { color: normalized });
                }
              }}
              aria-label="文字颜色十六进制"
            />
          </label>
          <button
            type="button"
            className="btn btn-secondary min-h-12 px-4 text-sm"
            onClick={() =>
              onRoleTypography(activeRole, { color: THEME_TEXT_COLOR })
            }
          >
            跟随主题
          </button>
        </div>
      </div>

      {/* 字体 */}
      <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">字体</h3>
          <span className="text-xs text-[var(--muted)]">
            当前：{fontById(role.fontFamily).name}
          </span>
        </div>
        <label className="block">
          <span className="sr-only">搜索字体</span>
          <input
            type="search"
            enterKeyHint="search"
            placeholder="搜索字体名 / 拼音 / 风格…"
            className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
            value={fontSearch}
            onChange={(e) => onFontSearch(e.target.value)}
          />
        </label>
        <div
          className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="字体分类"
        >
          <PaletteFilterChip
            label="全部"
            active={fontFilter === "all"}
            onClick={() => onFontFilter("all")}
          />
          {FONT_CATEGORIES.map((cat) => (
            <PaletteFilterChip
              key={cat.id}
              label={cat.label}
              active={fontFilter === cat.id}
              onClick={() => onFontFilter(cat.id)}
            />
          ))}
        </div>
        <div className="grid max-h-[22rem] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
          {filteredFonts.length === 0 ? (
            <p className="col-span-full py-6 text-center text-sm text-[var(--muted)]">
              没有匹配的字体，试试其它关键词
            </p>
          ) : null}
          {filteredFonts.map((font) => {
            const selected = role.fontFamily === font.id;
            return (
              <button
                key={font.id}
                type="button"
                onClick={() =>
                  onRoleTypography(activeRole, { fontFamily: font.id })
                }
                className={`min-h-14 rounded-xl border px-3 py-2.5 text-left transition ${
                  selected
                    ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/30"
                    : "border-[var(--line)] bg-white/90"
                }`}
              >
                <p
                  className="truncate text-base font-medium text-[var(--ink)]"
                  style={{ fontFamily: font.stack }}
                >
                  {font.name}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
                  {font.license}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 特效 */}
      <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white/70 p-4">
        <h3 className="text-sm font-semibold">特效</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TEXT_EFFECTS.map((effect) => {
            const selected = role.effect === effect.id;
            return (
              <button
                key={effect.id}
                type="button"
                onClick={() =>
                  onRoleTypography(activeRole, {
                    effect: effect.id as TextEffectId,
                  })
                }
                className={`min-h-12 rounded-xl border px-3 py-2 text-left transition ${
                  selected
                    ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/30"
                    : "border-[var(--line)] bg-white/90"
                }`}
              >
                <p className="text-sm font-medium">{effect.label}</p>
                <p className="text-[11px] text-[var(--muted)]">{effect.hint}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 动画 */}
      <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white/70 p-4">
        <h3 className="text-sm font-semibold">动画</h3>
        <p className="text-xs text-[var(--muted)]">
          轻量 CSS；系统开启「减少动态效果」时自动关闭，兼顾微信耗电
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TEXT_ANIMATIONS.map((anim) => {
            const selected = role.animation === anim.id;
            return (
              <button
                key={anim.id}
                type="button"
                onClick={() =>
                  onRoleTypography(activeRole, {
                    animation: anim.id as TextAnimationId,
                  })
                }
                className={`min-h-12 rounded-xl border px-3 py-2 text-left transition ${
                  selected
                    ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/30"
                    : "border-[var(--line)] bg-white/90"
                }`}
              >
                <p className="text-sm font-medium">{anim.label}</p>
                <p className="text-[11px] text-[var(--muted)]">{anim.hint}</p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** 腕表广告常用 10:10 姿态；按上海时区换算成 UTC */
const CLOCK_PREVIEW_POSE = new Date(Date.UTC(2026, 0, 1, 2, 10, 31));
const CLOCK_PREVIEW_TZ = "Asia/Shanghai";

function ClockTab({
  clock,
  onChange,
}: {
  clock: HomeClockConfig;
  onChange: (patch: Partial<HomeClockConfig>) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const placed =
    clock.xPercent != null && clock.yPercent != null
      ? `距左 ${clock.xPercent}% · 距顶 ${clock.yPercent}%`
      : "默认：顶栏右下角";

  return (
    <section className="space-y-5">
      <Header
        title="首页时钟"
        hint="选一套奢华表盘；位置请回首页按住时钟拖动，松手即保存。点击表盘出现＋－，再逐步放大或缩小（只影响本机）。访客看到同一套样式和位置。"
      />

      <div
        className={`flex flex-col items-center gap-3 rounded-[22px] border px-4 py-6 sm:flex-row sm:items-center sm:justify-center sm:gap-5 ${
          HOME_CLOCK_FRAME_CLASS[clock.style] || HOME_CLOCK_FRAME_CLASS.imperial
        }`}
      >
        <span className="inline-flex h-24 w-24 sm:h-28 sm:w-28">
          <HomeClockFace
            now={now}
            timeZone={CLOCK_PREVIEW_TZ}
            style={clock.style}
            className="h-full w-full"
          />
        </span>
        <div className="text-center sm:text-left">
          <p className="text-lg font-semibold tracking-wide">
            {HOME_CLOCK_STYLE_META[clock.style]?.name}
          </p>
          <p className="mt-1 text-sm opacity-80">
            {HOME_CLOCK_STYLE_META[clock.style]?.hint}
          </p>
          <p className="mt-2 text-xs opacity-70">当前摆放：{placed}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {HOME_CLOCK_STYLES.map((style) => {
          const meta = HOME_CLOCK_STYLE_META[style];
          const selected = clock.style === style;
          return (
            <button
              key={style}
              type="button"
              onClick={() => onChange({ style })}
              className={`min-h-11 rounded-2xl border p-3 text-left transition ${
                selected
                  ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/30"
                  : "border-[var(--line)] bg-white/90 hover:border-[var(--brand)]/40"
              }`}
            >
              <span
                className={`mb-2 flex h-16 items-center justify-center rounded-xl ${
                  HOME_CLOCK_FRAME_CLASS[style]
                }`}
              >
                <HomeClockFace
                  now={CLOCK_PREVIEW_POSE}
                  timeZone={CLOCK_PREVIEW_TZ}
                  style={style}
                  className="h-14 w-14"
                />
              </span>
              <p className="text-sm font-medium">{meta.name}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">
                {meta.hint}
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white/90 px-4">
          <span className="text-sm">显示数字时间</span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--brand)]"
            checked={clock.showDigital}
            onChange={(event) => onChange({ showDigital: event.target.checked })}
          />
        </label>
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white/90 px-4">
          <span className="text-sm">显示金句</span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--brand)]"
            checked={clock.showProverb}
            onChange={(event) => onChange({ showProverb: event.target.checked })}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">
          想改位置：打开首页，按住时钟拖到想要的地方。点击表盘出现＋－，再逐步放大或缩小。改时区请点城市名。
        </p>
        <button
          type="button"
          className="btn btn-secondary min-h-11 shrink-0 px-4 text-sm"
          disabled={clock.xPercent == null && clock.yPercent == null}
          onClick={() => onChange({ xPercent: null, yPercent: null })}
        >
          恢复默认右上角
        </button>
      </div>
    </section>
  );
}

function LogoTab({
  logo,
  onChange,
}: {
  logo: HomeLogoConfig;
  onChange: (patch: Partial<HomeLogoConfig>) => void;
}) {
  const placed =
    logo.xPercent != null && logo.yPercent != null
      ? `距左 ${logo.xPercent}% · 距顶 ${logo.yPercent}%`
      : "默认：顶栏左下角，与时钟对称";
  const previewSrc = logo.useAnimation ? HOME_LOGO_ANIM_SRC : HOME_LOGO_STILL_SRC;

  return (
    <section className="space-y-5">
      <Header
        title="首页颗秒标"
        hint="从颗秒抠图素材里选用了透明底静帧和压缩后的旋转动画。位置请回首页按住拖动；点击后出现＋－，再逐步放大或缩小（只影响本机）。"
      />

      <div className="flex flex-col items-center gap-3 rounded-[22px] border border-[var(--line)] bg-white/80 px-4 py-6 sm:flex-row sm:items-center sm:justify-center sm:gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewSrc}
          alt={HOME_LOGO_ALT}
          width={128}
          height={128}
          className="h-28 w-28 object-contain"
        />
        <div className="text-center sm:text-left">
          <p className="text-lg font-semibold tracking-wide">
            {logo.visible ? (logo.useAnimation ? "旋转动画" : "透明静帧") : "已隐藏"}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            动画已压到约 0.5MB，避免原 15MB GIF 在微信里拖垮首页。
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">当前摆放：{placed}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white/90 px-4">
          <span className="text-sm">首页显示颗秒标</span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--brand)]"
            checked={logo.visible}
            onChange={(event) => onChange({ visible: event.target.checked })}
          />
        </label>
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white/90 px-4">
          <span className="text-sm">使用旋转动画</span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--brand)]"
            checked={logo.useAnimation}
            onChange={(event) => onChange({ useAnimation: event.target.checked })}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">
          想改位置：打开首页，按住颗秒标拖到想要的地方。点击后出现＋－，再逐步放大或缩小。窄屏微信里同样可拖、可点。
        </p>
        <button
          type="button"
          className="btn btn-secondary min-h-11 shrink-0 px-4 text-sm"
          disabled={logo.xPercent == null && logo.yPercent == null}
          onClick={() => onChange({ xPercent: null, yPercent: null })}
        >
          恢复默认左上角
        </button>
      </div>
    </section>
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

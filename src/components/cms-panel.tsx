"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OrderFormSettings } from "@/components/order-form-settings";
import {
  AboutEditor,
  ContactEditor,
  HomeSectionOrderEditor,
  PortalNavSettings,
} from "@/components/portal-settings";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";
import { StudioNavSettings } from "@/components/studio-nav-settings";
import { DEFAULT_ORDER_FORM, type OrderFormConfig } from "@/lib/order-form";
import {
  DEFAULT_HOME_SECTION_ORDER,
  DEFAULT_PORTAL,
  DEFAULT_PORTAL_CONTACT,
  HOME_SECTION_LABELS,
  normalizeHomeSectionOrder,
  type PortalConfig,
} from "@/lib/portal";
import {
  DEFAULT_STUDIO_NAV,
  type StudioNavConfig,
} from "@/lib/studio-nav-config";
import { DEFAULT_UI_COPY, type ComposeUiCopy } from "@/lib/ui-copy";

type Props = {
  initial: {
    uiCopy: { compose: ComposeUiCopy };
    orderForm: OrderFormConfig;
    studioNav: StudioNavConfig;
    portal: PortalConfig;
  };
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";

type CmsSectionId =
  | "portal-nav"
  | "portal-home-order"
  | "portal-contact"
  | "portal-company"
  | "portal-person"
  | "studio-nav"
  | "order-form"
  | "ui-copy";

/** 与系统设置一致：点击标题展开/收起，同一时间只开一块 */
function CmsSection({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  id: CmsSectionId;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: (id: CmsSectionId) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="surface overflow-hidden rounded-[28px]">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left hover:bg-white/40 sm:px-6 sm:py-5"
        onClick={() => onToggle(id)}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {summary ? (
            <p className="mt-1 text-sm text-[var(--muted)]">{summary}</p>
          ) : null}
        </div>
        <span
          className={`mt-1 shrink-0 text-sm text-[var(--muted)] transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? (
        <div className="space-y-4 border-t border-[var(--line)] px-5 py-5 sm:px-6">
          {children}
        </div>
      ) : null}
    </div>
  );
}

const SECTION_SAVE_LABEL: Record<CmsSectionId, string> = {
  "portal-nav": "保存门户导航",
  "portal-home-order": "保存首页顺序",
  "portal-contact": "保存联系我们",
  "portal-company": "保存公司介绍",
  "portal-person": "保存个人介绍",
  "studio-nav": "保存后台导航",
  "order-form": "保存下单采集",
  "ui-copy": "保存文案配置",
};

export function CmsPanel({ initial }: Props) {
  const router = useRouter();
  const [uiCopy, setUiCopy] = useState(() => ({
    compose: {
      ...DEFAULT_UI_COPY.compose,
      ...(initial.uiCopy?.compose || {}),
    },
  }));
  const [orderForm, setOrderForm] = useState(() => ({
    ...DEFAULT_ORDER_FORM,
    ...(initial.orderForm || {}),
    fields: initial.orderForm?.fields || [],
  }));
  const [studioNav, setStudioNav] = useState<StudioNavConfig>(() => ({
    topBase: initial.studioNav?.topBase?.length
      ? initial.studioNav.topBase
      : DEFAULT_STUDIO_NAV.topBase,
    topAdmin: initial.studioNav?.topAdmin?.length
      ? initial.studioNav.topAdmin
      : DEFAULT_STUDIO_NAV.topAdmin,
    courses: initial.studioNav?.courses?.length
      ? initial.studioNav.courses
      : DEFAULT_STUDIO_NAV.courses,
  }));
  const [portal, setPortal] = useState<PortalConfig>(() => ({
    ...DEFAULT_PORTAL,
    ...(initial.portal || {}),
    nav: initial.portal?.nav?.length ? initial.portal.nav : DEFAULT_PORTAL.nav,
    company: { ...DEFAULT_PORTAL.company, ...(initial.portal?.company || {}) },
    person: { ...DEFAULT_PORTAL.person, ...(initial.portal?.person || {}) },
    contact: {
      ...DEFAULT_PORTAL_CONTACT,
      ...(initial.portal?.contact || {}),
    },
    homeSectionOrder: normalizeHomeSectionOrder(
      initial.portal?.homeSectionOrder?.length
        ? initial.portal.homeSectionOrder
        : DEFAULT_HOME_SECTION_ORDER,
    ),
  }));
  // 默认全部收起；可同时展开多块，互不自动关闭
  const [openSections, setOpenSections] = useState<Set<CmsSectionId>>(
    () => new Set(),
  );
  const [savingAll, setSavingAll] = useState(false);
  const [savingSection, setSavingSection] = useState<CmsSectionId | null>(null);
  /** 各分区按钮旁提示；全部保存用 allFeedback */
  const [sectionFeedback, setSectionFeedback] = useState<
    Partial<Record<CmsSectionId, SaveStatus>>
  >({});
  const [allFeedback, setAllFeedback] = useState<SaveStatus>(null);

  function setSectionStatus(section: CmsSectionId, status: SaveStatus) {
    setSectionFeedback((prev) => ({ ...prev, [section]: status }));
  }

  function toggleSection(id: CmsSectionId) {
    setOpenSections((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setComposeCopy<K extends keyof ComposeUiCopy>(
    key: K,
    value: ComposeUiCopy[K],
  ) {
    setUiCopy((prev) => ({
      compose: { ...prev.compose, [key]: value },
    }));
  }

  function applyServerPayload(data: {
    uiCopy?: typeof uiCopy;
    orderForm?: OrderFormConfig;
    studioNav?: StudioNavConfig;
    portal?: PortalConfig;
  }) {
    if (data.uiCopy) setUiCopy(data.uiCopy);
    if (data.orderForm) setOrderForm(data.orderForm);
    if (data.studioNav) setStudioNav(data.studioNav);
    if (data.portal) setPortal(data.portal);
  }

  /** 按分区拼 PATCH body；门户三项各自只带对应字段，服务端与库内配置合并 */
  function bodyForSection(section: CmsSectionId): Record<string, unknown> {
    switch (section) {
      case "portal-nav":
        return { portal: { nav: portal.nav } };
      case "portal-home-order":
        return { portal: { homeSectionOrder: portal.homeSectionOrder } };
      case "portal-contact":
        return { portal: { contact: portal.contact } };
      case "portal-company":
        return { portal: { company: portal.company } };
      case "portal-person":
        return { portal: { person: portal.person } };
      case "studio-nav":
        return { studioNav };
      case "order-form":
        return { orderForm };
      case "ui-copy":
        return { uiCopy };
      default: {
        const _exhaustive: never = section;
        return _exhaustive;
      }
    }
  }

  async function patchCms(
    body: Record<string, unknown>,
  ): Promise<{ ok: boolean; error: string; data: Record<string, unknown> }> {
    return postSave("/api/studio/cms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function saveSection(section: CmsSectionId) {
    setSavingSection(section);
    setSectionStatus(section, null);
    setAllFeedback(null);
    const result = await patchCms(bodyForSection(section));
    setSavingSection(null);
    if (!result.ok) {
      setSectionStatus(section, {
        kind: "error",
        text: result.error || "保存失败",
      });
      return;
    }
    applyServerPayload(result.data as Parameters<typeof applyServerPayload>[0]);
    setSectionStatus(section, {
      kind: "ok",
      text: `${SECTION_SAVE_LABEL[section]}成功`,
    });
    router.refresh();
  }

  async function saveAll(e: React.FormEvent) {
    e.preventDefault();
    setSavingAll(true);
    setAllFeedback(null);
    setSectionFeedback({});
    const result = await patchCms({ uiCopy, orderForm, studioNav, portal });
    setSavingAll(false);
    if (!result.ok) {
      setAllFeedback({ kind: "error", text: result.error || "保存失败" });
      return;
    }
    applyServerPayload(result.data as Parameters<typeof applyServerPayload>[0]);
    setAllFeedback({ kind: "ok", text: "内容配置已全部保存" });
    router.refresh();
  }

  const busy = savingAll || savingSection !== null;
  const navEnabledCount = portal.nav.filter((n) => n.enabled !== false).length;
  const homeOrder = normalizeHomeSectionOrder(
    portal.homeSectionOrder?.length
      ? portal.homeSectionOrder
      : DEFAULT_HOME_SECTION_ORDER,
  );
  const homeOrderSummary = homeOrder
    .map((id) => HOME_SECTION_LABELS[id])
    .join(" → ");

  function SectionSaveButton({ section }: { section: CmsSectionId }) {
    return (
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          className="btn btn-primary min-h-11"
          disabled={busy}
          onClick={() => void saveSection(section)}
        >
          {savingSection === section
            ? "保存中…"
            : SECTION_SAVE_LABEL[section]}
        </button>
        <SaveFeedback status={sectionFeedback[section] ?? null} />
      </div>
    );
  }

  return (
    <form onSubmit={saveAll} className="space-y-3">
      <p className="mb-2 text-sm text-[var(--muted)]">
        点击下方菜单展开对应配置；可只保存当前分区，也可点底部「保存全部内容配置」。
      </p>

      <CmsSection
        id="portal-nav"
        title="门户导航"
        summary={`已启用 ${navEnabledCount} / ${portal.nav.length} 项 · 支持拖拽排序`}
        open={openSections.has("portal-nav")}
        onToggle={toggleSection}
      >
        <PortalNavSettings value={portal} onChange={setPortal} />
        <SectionSaveButton section="portal-nav" />
      </CmsSection>

      <CmsSection
        id="portal-home-order"
        title="首页区块顺序"
        summary={`拖拽排序 · ${homeOrderSummary}`}
        open={openSections.has("portal-home-order")}
        onToggle={toggleSection}
      >
        <HomeSectionOrderEditor value={portal} onChange={setPortal} />
        <SectionSaveButton section="portal-home-order" />
      </CmsSection>

      <CmsSection
        id="portal-contact"
        title="联系我们"
        summary={
          portal.contact?.enabled === false
            ? "前台已隐藏"
            : [
                portal.contact?.phone && "电话",
                portal.contact?.wechat && "微信",
                portal.contact?.qq && "QQ",
                portal.contact?.wechatMp && "公众号",
                portal.contact?.xiaohongshu && "小红书",
                portal.contact?.douyin && "抖音",
                portal.contact?.bilibili && "B站",
              ]
                .filter(Boolean)
                .join(" · ") || "首页直接展开 · 可填多渠道 · 位置见「首页区块顺序」"
        }
        open={openSections.has("portal-contact")}
        onToggle={toggleSection}
      >
        <ContactEditor
          value={portal.contact || DEFAULT_PORTAL_CONTACT}
          onChange={(contact) => setPortal((p) => ({ ...p, contact }))}
        />
        <SectionSaveButton section="portal-contact" />
      </CmsSection>

      <CmsSection
        id="portal-company"
        title="公司介绍"
        summary={portal.company?.title || "前台「公司介绍」页文案"}
        open={openSections.has("portal-company")}
        onToggle={toggleSection}
      >
        <AboutEditor
          value={portal.company || DEFAULT_PORTAL.company}
          onChange={(company) => setPortal((p) => ({ ...p, company }))}
        />
        <SectionSaveButton section="portal-company" />
      </CmsSection>

      <CmsSection
        id="portal-person"
        title="个人介绍"
        summary={portal.person?.title || "前台「个人介绍」页文案"}
        open={openSections.has("portal-person")}
        onToggle={toggleSection}
      >
        <AboutEditor
          value={portal.person || DEFAULT_PORTAL.person}
          onChange={(person) => setPortal((p) => ({ ...p, person }))}
        />
        <SectionSaveButton section="portal-person" />
      </CmsSection>

      <CmsSection
        id="studio-nav"
        title="后台导航菜单"
        summary="工作室后台顶部导航与课程中心子菜单"
        open={openSections.has("studio-nav")}
        onToggle={toggleSection}
      >
        <StudioNavSettings
          value={studioNav}
          onChange={setStudioNav}
          embedded
        />
        <SectionSaveButton section="studio-nav" />
      </CmsSection>

      <CmsSection
        id="order-form"
        title="下单信息采集"
        summary={
          orderForm.enabled && orderForm.fields.length > 0
            ? `已启用 · ${orderForm.fields.length} 个字段`
            : orderForm.fields.length > 0
              ? `未启用 · ${orderForm.fields.length} 个字段`
              : "未配置字段"
        }
        open={openSections.has("order-form")}
        onToggle={toggleSection}
      >
        <OrderFormSettings
          value={orderForm}
          onChange={setOrderForm}
          embedded
        />
        <SectionSaveButton section="order-form" />
      </CmsSection>

      <CmsSection
        id="ui-copy"
        title="文案配置"
        summary="后台表单提示文字（非店铺视觉装修）"
        open={openSections.has("ui-copy")}
        onToggle={toggleSection}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["priceLabel", "售价字段标签"],
              ["pricePlaceholder", "售价输入框提示"],
              ["priceHint", "售价下方说明"],
              ["titleLabel", "标题标签"],
              ["titlePlaceholderCourse", "单课标题提示"],
              ["titlePlaceholderColumn", "专栏标题提示"],
              ["subtitleLabel", "卖点标签"],
              ["subtitlePlaceholder", "卖点提示"],
              ["descriptionLabel", "介绍标签"],
              ["descriptionPlaceholder", "介绍提示"],
              ["step2Title", "第二步标题"],
              ["courseTypeLabel", "单课按钮文字"],
              ["columnTypeLabel", "专栏按钮文字"],
              ["groupByCategoryLabel", "自动分章文案"],
              ["publishLabel", "立即上架文案"],
              ["submitLabelCourse", "生成课程按钮"],
              ["submitLabelColumn", "生成专栏按钮"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                className={inputClass}
                value={uiCopy.compose[key]}
                onChange={(e) => setComposeCopy(key, e.target.value)}
              />
            </Field>
          ))}
        </div>
        <SectionSaveButton section="ui-copy" />
      </CmsSection>

      <div className="flex flex-wrap items-center gap-3 pt-3">
        <button
          type="submit"
          className="btn btn-primary min-h-11"
          disabled={busy}
        >
          {savingAll ? "保存中…" : "保存全部内容配置"}
        </button>
        <SaveFeedback status={allFeedback} />
      </div>
    </form>
  );
}

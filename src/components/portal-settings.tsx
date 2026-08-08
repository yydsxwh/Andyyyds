"use client";

import { useState } from "react";
import type {
  PortalAboutPage,
  PortalConfig,
  PortalContact,
  PortalNavLink,
} from "@/lib/portal";
import {
  DEFAULT_HOME_SECTION_ORDER,
  DEFAULT_PORTAL,
  DEFAULT_PORTAL_CONTACT,
  HOME_SECTION_LABELS,
  normalizeHomeSectionOrder,
} from "@/lib/portal";

type Props = {
  value: PortalConfig;
  onChange: (next: PortalConfig) => void;
};

const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";

const NAV_DND_MIME = "application/x-portal-nav-index";
const HOME_SECTION_DND_MIME = "application/x-portal-home-section-index";

export function AboutEditor({
  title,
  value,
  onChange,
}: {
  title?: string;
  value: PortalAboutPage;
  onChange: (next: PortalAboutPage) => void;
}) {
  return (
    <div className="space-y-3">
      {title ? <h3 className="font-medium">{title}</h3> : null}
      <label className="block text-sm">
        <span className="text-[var(--muted)]">标题</span>
        <input
          className={`${inputClass} mt-1`}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">副标题</span>
        <input
          className={`${inputClass} mt-1`}
          value={value.subtitle}
          onChange={(e) => onChange({ ...value, subtitle: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">正文（空行分段）</span>
        <textarea
          className={`${inputClass} mt-1 min-h-40`}
          value={value.body}
          onChange={(e) => onChange({ ...value, body: e.target.value })}
        />
      </label>
      <div className="space-y-2">
        <div className="text-sm text-[var(--muted)]">要点（最多 8 条）</div>
        {value.highlights.map((item, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-2">
            <input
              className={inputClass}
              placeholder="标签"
              value={item.label}
              onChange={(e) => {
                const highlights = value.highlights.slice();
                highlights[index] = { ...item, label: e.target.value };
                onChange({ ...value, highlights });
              }}
            />
            <input
              className={inputClass}
              placeholder="说明"
              value={item.text}
              onChange={(e) => {
                const highlights = value.highlights.slice();
                highlights[index] = { ...item, text: e.target.value };
                onChange({ ...value, highlights });
              }}
            />
          </div>
        ))}
        {value.highlights.length < 8 ? (
          <button
            type="button"
            className="btn btn-secondary px-3 py-2 text-sm"
            onClick={() =>
              onChange({
                ...value,
                highlights: [...value.highlights, { label: "", text: "" }],
              })
            }
          >
            添加要点
          </button>
        ) : null}
      </div>
    </div>
  );
}

const PORTAL_NAV_MAX = 20;

/** 门户顶栏导航：站长可增删；拖拽排序 + 显示开关（顺序即前台渲染顺序） */
export function PortalNavSettings({ value, onChange }: Props) {
  const nav = value.nav?.length ? value.nav : DEFAULT_PORTAL.nav;
  // 拖拽悬停高亮目标行，便于看出将插入的位置
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function updateNav(index: number, patch: Partial<PortalNavLink>) {
    const next = nav.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange({ ...value, nav: next });
  }

  /** 数组下标即前台顶栏顺序；保存后 site-header 按此顺序渲染 */
  function moveNav(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= nav.length || to >= nav.length) {
      return;
    }
    const next = nav.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange({ ...value, nav: next });
  }

  function addNav() {
    if (nav.length >= PORTAL_NAV_MAX) return;
    const key = `custom-${Date.now().toString(36)}`;
    const next: PortalNavLink = {
      key,
      label: "",
      href: "",
      enabled: true,
    };
    onChange({ ...value, nav: [...nav, next] });
  }

  function removeNav(index: number) {
    // 至少保留一项，避免顶栏被清空后难恢复
    if (nav.length <= 1) return;
    onChange({
      ...value,
      nav: nav.filter((_, i) => i !== index),
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted)]">
        可自行添加导航项（最多 {PORTAL_NAV_MAX} 个）。拖拽左侧手柄调顺序；勾选「显示」控制是否出现在顶栏。链接请填站内路径（如{" "}
        <code className="rounded bg-black/5 px-1">/courses</code>
        ）或完整网址。
      </p>
      {nav.map((item, index) => (
        <div
          key={item.key}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDragOverIndex(index);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDragOverIndex((current) => (current === index ? null : current));
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverIndex(null);
            const raw = e.dataTransfer.getData(NAV_DND_MIME);
            const from = Number.parseInt(raw, 10);
            if (Number.isFinite(from)) moveNav(from, index);
          }}
          className={`grid gap-2 rounded-2xl border bg-white/50 p-3 sm:grid-cols-[auto_1fr_1.2fr_auto_auto_auto] ${
            dragOverIndex === index
              ? "border-[var(--brand)] ring-1 ring-[var(--brand)]"
              : "border-[var(--line)]"
          }`}
        >
          {/* 仅手柄可拖：避免改文案/路径时误触发排序 */}
          <button
            type="button"
            draggable
            className="flex h-10 w-10 cursor-grab items-center justify-center self-center rounded-xl border border-[var(--line)] bg-white/80 text-[var(--muted)] active:cursor-grabbing"
            aria-label={`拖拽调整「${item.label || "导航项"}」顺序`}
            title="按住拖动调整顺序"
            onDragStart={(e) => {
              e.dataTransfer.setData(NAV_DND_MIME, String(index));
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => setDragOverIndex(null)}
          >
            <span aria-hidden className="select-none text-base leading-none">
              ⋮⋮
            </span>
          </button>
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block text-xs text-[var(--muted)]">
              显示名称
            </span>
            <input
              className={inputClass}
              value={item.label}
              onChange={(e) => updateNav(index, { label: e.target.value })}
              placeholder="例如：首页、公司介绍"
            />
          </label>
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block text-xs text-[var(--muted)]">
              链接地址（必填）
            </span>
            <input
              className={inputClass}
              value={item.href}
              onChange={(e) => updateNav(index, { href: e.target.value })}
              placeholder="在此填写链接，如 /courses 或 https://…"
              inputMode="url"
              autoComplete="off"
            />
          </label>
          <div className="flex items-center gap-1 self-end sm:self-center sm:pt-5">
            <button
              type="button"
              className="btn btn-secondary min-h-10 px-2.5 py-2 text-sm disabled:opacity-40"
              disabled={index === 0}
              aria-label={`上移「${item.label || "导航项"}」`}
              title="上移"
              onClick={() => moveNav(index, index - 1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-10 px-2.5 py-2 text-sm disabled:opacity-40"
              disabled={index === nav.length - 1}
              aria-label={`下移「${item.label || "导航项"}」`}
              title="下移"
              onClick={() => moveNav(index, index + 1)}
            >
              ↓
            </button>
          </div>
          <div className="flex flex-col gap-2 self-end text-sm text-[var(--muted)] sm:self-center sm:pt-5">
            <label className="flex min-h-10 items-center gap-2">
              <input
                type="checkbox"
                checked={item.enabled !== false}
                onChange={(e) => updateNav(index, { enabled: e.target.checked })}
              />
              显示
            </label>
            <label
              className="flex min-h-10 items-center gap-2"
              title="仅影响首页「门户入口」卡片；顶栏导航仍同页打开"
            >
              <input
                type="checkbox"
                checked={Boolean(item.openInNewTab)}
                onChange={(e) =>
                  updateNav(index, { openInNewTab: e.target.checked })
                }
              />
              首页新标签
            </label>
          </div>
          <button
            type="button"
            className="btn btn-secondary min-h-10 self-end px-2.5 py-2 text-sm text-[var(--fire)] sm:self-center sm:pt-0"
            disabled={nav.length <= 1}
            aria-label={`删除「${item.label || "导航项"}」`}
            title={nav.length <= 1 ? "至少保留一项" : "删除此项"}
            onClick={() => removeNav(index)}
          >
            删除
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary min-h-11 w-full sm:w-auto"
        disabled={nav.length >= PORTAL_NAV_MAX}
        onClick={addNav}
      >
        {nav.length >= PORTAL_NAV_MAX
          ? `已达上限 ${PORTAL_NAV_MAX} 项`
          : "+ 添加导航项"}
      </button>
    </div>
  );
}

/**
 * 首页区块顺序 + 显隐：拖拽/箭头改位次，右侧按钮切换前台是否渲染（触控可用，不依赖 hover）。
 * 显隐与顺序一并保存；隐藏只影响前台，后台列表仍保留该项以便再打开。
 */
export function HomeSectionOrderEditor({ value, onChange }: Props) {
  const order = normalizeHomeSectionOrder(
    value.homeSectionOrder?.length
      ? value.homeSectionOrder
      : DEFAULT_HOME_SECTION_ORDER,
  );
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function moveSection(from: number, to: number) {
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= order.length ||
      to >= order.length
    ) {
      return;
    }
    const next = order.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange({ ...value, homeSectionOrder: next });
  }

  /** 点按钮切换 visible；与排序同一字段，点「保存首页顺序」一并写入 */
  function toggleSectionVisible(index: number) {
    const next = order.map((entry, i) =>
      i === index ? { ...entry, visible: !entry.visible } : entry,
    );
    onChange({ ...value, homeSectionOrder: next });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">
        拖拽左侧手柄或点上下箭头调整顺序；点「显示/隐藏」控制该区块是否出现在前台（手机微信内同样可点）。保存后立即生效。更多横幅仅在配置了多张横幅时出现。
      </p>
      {order.map((entry, index) => {
        const sectionId = entry.id;
        const label = HOME_SECTION_LABELS[sectionId];
        const isVisible = entry.visible !== false;
        return (
          <div
            key={sectionId}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverIndex(index);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverIndex((current) =>
                  current === index ? null : current,
                );
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverIndex(null);
              const raw = e.dataTransfer.getData(HOME_SECTION_DND_MIME);
              const from = Number.parseInt(raw, 10);
              if (Number.isFinite(from)) moveSection(from, index);
            }}
            className={`flex flex-wrap items-center gap-2 rounded-2xl border bg-white/50 p-3 sm:flex-nowrap ${
              dragOverIndex === index
                ? "border-[var(--brand)] ring-1 ring-[var(--brand)]"
                : "border-[var(--line)]"
            } ${isVisible ? "" : "opacity-60"}`}
          >
            <button
              type="button"
              draggable
              className="flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-xl border border-[var(--line)] bg-white/80 text-[var(--muted)] touch-manipulation active:cursor-grabbing"
              aria-label={`拖拽调整「${label}」顺序`}
              title="按住拖动调整顺序"
              onDragStart={(e) => {
                e.dataTransfer.setData(HOME_SECTION_DND_MIME, String(index));
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDragOverIndex(null)}
            >
              <span aria-hidden className="select-none text-base leading-none">
                ⋮⋮
              </span>
            </button>
            <div className="min-w-0 flex-1 basis-[min(100%,12rem)]">
              <div className="font-medium text-[var(--ink)]">{label}</div>
              <div className="text-xs text-[var(--muted)]">
                {sectionId === "contact"
                  ? "内容在下方「联系我们」分区编辑"
                  : sectionId === "banners"
                    ? "网站装扮里配置多张横幅后显示"
                    : "经典首页区块"}
                {!isVisible ? " · 前台已隐藏" : ""}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              {/* 明显可点的显隐按钮：aria-pressed 表示当前是否显示，微信内触控区域 ≥44px */}
              <button
                type="button"
                className={`btn min-h-11 touch-manipulation px-3 py-2 text-sm ${
                  isVisible
                    ? "btn-primary"
                    : "btn-secondary text-[var(--muted)]"
                }`}
                aria-pressed={isVisible}
                aria-label={
                  isVisible ? `隐藏「${label}」（当前显示中）` : `显示「${label}」（当前已隐藏）`
                }
                title={isVisible ? "点击后前台隐藏该区块" : "点击后前台显示该区块"}
                onClick={() => toggleSectionVisible(index)}
              >
                {isVisible ? "显示" : "隐藏"}
              </button>
              <button
                type="button"
                className="btn btn-secondary min-h-11 min-w-11 touch-manipulation px-2.5 py-2 text-sm disabled:opacity-40"
                disabled={index === 0}
                aria-label={`上移「${label}」`}
                title="上移"
                onClick={() => moveSection(index, index - 1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-secondary min-h-11 min-w-11 touch-manipulation px-2.5 py-2 text-sm disabled:opacity-40"
                disabled={index === order.length - 1}
                aria-label={`下移「${label}」`}
                title="下移"
                onClick={() => moveSection(index, index + 1)}
              >
                ↓
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 联系我们：字段编辑；页面位置由「首页区块顺序」拖拽决定 */
export function ContactEditor({
  value,
  onChange,
}: {
  value: PortalContact;
  onChange: (next: PortalContact) => void;
}) {
  const contact = { ...DEFAULT_PORTAL_CONTACT, ...value };

  function patch(partial: Partial<PortalContact>) {
    onChange({ ...contact, ...partial });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">
        填写后会在首页按「首页区块顺序」展开显示（无需点击）。留空的字段不会出现在前台。
      </p>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={contact.enabled !== false}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        在前台显示「联系我们」
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">标题</span>
        <input
          className={`${inputClass} mt-1`}
          value={contact.title}
          onChange={(e) =>
            patch({ title: e.target.value, linkLabel: e.target.value })
          }
          placeholder="联系我们"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">电话</span>
        <input
          className={`${inputClass} mt-1`}
          value={contact.phone}
          onChange={(e) => patch({ phone: e.target.value })}
          placeholder="例如 400-000-0000"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">微信</span>
        <input
          className={`${inputClass} mt-1`}
          value={contact.wechat}
          onChange={(e) => patch({ wechat: e.target.value })}
          placeholder="微信号"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">QQ</span>
        <input
          className={`${inputClass} mt-1`}
          value={contact.qq}
          onChange={(e) => patch({ qq: e.target.value })}
          placeholder="QQ 号"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">公众号</span>
        <input
          className={`${inputClass} mt-1`}
          value={contact.wechatMp}
          onChange={(e) => patch({ wechatMp: e.target.value })}
          placeholder="微信公众号名称"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">小红书号</span>
        <input
          className={`${inputClass} mt-1`}
          value={contact.xiaohongshu}
          onChange={(e) => patch({ xiaohongshu: e.target.value })}
          placeholder="小红书号或昵称"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">抖音号</span>
        <input
          className={`${inputClass} mt-1`}
          value={contact.douyin}
          onChange={(e) => patch({ douyin: e.target.value })}
          placeholder="抖音号"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">B站</span>
        <input
          className={`${inputClass} mt-1`}
          value={contact.bilibili}
          onChange={(e) => patch({ bilibili: e.target.value })}
          placeholder="B 站账号或 UID"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">邮箱</span>
        <input
          className={`${inputClass} mt-1`}
          type="email"
          value={contact.email}
          onChange={(e) => patch({ email: e.target.value })}
          placeholder="hello@example.com"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">地址</span>
        <input
          className={`${inputClass} mt-1`}
          value={contact.address}
          onChange={(e) => patch({ address: e.target.value })}
          placeholder="公司地址"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">服务时间</span>
        <input
          className={`${inputClass} mt-1`}
          value={contact.hours}
          onChange={(e) => patch({ hours: e.target.value })}
          placeholder="工作日 9:00–18:00"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">补充说明</span>
        <textarea
          className={`${inputClass} mt-1 min-h-28`}
          value={contact.note}
          onChange={(e) => patch({ note: e.target.value })}
          placeholder="欢迎留言，我们会尽快回复"
        />
      </label>
    </div>
  );
}

/** 兼容旧入口：导航 + 公司/个人介绍合在一页（新 CMS 已拆成可折叠分区） */
export function PortalSettings({ value, onChange }: Props) {
  return (
    <div className="surface space-y-5 rounded-[28px] p-6">
      <div>
        <h2 className="text-lg font-semibold">门户导航与介绍页</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          控制前台顶部菜单显示与顺序、首页区块顺序与显隐，以及「公司介绍」「个人介绍」文案。拖拽左侧手柄可调整排版顺序；保存后立即生效。
        </p>
      </div>
      <PortalNavSettings value={value} onChange={onChange} />
      <HomeSectionOrderEditor value={value} onChange={onChange} />
      <ContactEditor
        value={value.contact || DEFAULT_PORTAL_CONTACT}
        onChange={(contact) => onChange({ ...value, contact })}
      />
      <AboutEditor
        title="公司介绍页"
        value={value.company || DEFAULT_PORTAL.company}
        onChange={(company) => onChange({ ...value, company })}
      />
      <AboutEditor
        title="个人介绍页"
        value={value.person || DEFAULT_PORTAL.person}
        onChange={(person) => onChange({ ...value, person })}
      />
    </div>
  );
}

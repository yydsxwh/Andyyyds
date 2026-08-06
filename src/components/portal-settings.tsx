"use client";

import type { PortalAboutPage, PortalConfig, PortalNavLink } from "@/lib/portal";
import { DEFAULT_PORTAL } from "@/lib/portal";

type Props = {
  value: PortalConfig;
  onChange: (next: PortalConfig) => void;
};

const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";

function AboutEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: PortalAboutPage;
  onChange: (next: PortalAboutPage) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white/50 p-4">
      <h3 className="font-medium">{title}</h3>
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

export function PortalSettings({ value, onChange }: Props) {
  const nav = value.nav?.length ? value.nav : DEFAULT_PORTAL.nav;

  function updateNav(index: number, patch: Partial<PortalNavLink>) {
    const next = nav.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange({ ...value, nav: next });
  }

  return (
    <div className="surface space-y-5 rounded-[28px] p-6">
      <div>
        <h2 className="text-lg font-semibold">门户导航与介绍页</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          控制前台顶部菜单，以及「公司介绍」「个人介绍」文案。商城 / 论坛 / 游戏可先保留链接，页面暂为即将开放。
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium">门户导航</h3>
        {nav.map((item, index) => (
          <div
            key={item.key + index}
            className="grid gap-2 rounded-2xl border border-[var(--line)] bg-white/50 p-3 sm:grid-cols-[1fr_1.2fr_auto]"
          >
            <input
              className={inputClass}
              value={item.label}
              onChange={(e) => updateNav(index, { label: e.target.value })}
              placeholder="显示名称"
            />
            <input
              className={inputClass}
              value={item.href}
              onChange={(e) => updateNav(index, { href: e.target.value })}
              placeholder="/about/company"
            />
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <input
                type="checkbox"
                checked={item.enabled !== false}
                onChange={(e) => updateNav(index, { enabled: e.target.checked })}
              />
              显示
            </label>
          </div>
        ))}
      </div>

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

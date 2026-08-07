"use client";

import {
  DEFAULT_STUDIO_NAV,
  type StudioNavConfig,
  type StudioNavLink,
} from "@/lib/studio-nav-config";

type Props = {
  value: StudioNavConfig;
  onChange: (next: StudioNavConfig) => void;
  /** 嵌入可折叠分区时去掉外层卡片与总标题，避免与分区头重复 */
  embedded?: boolean;
};

const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";

type SectionKey = keyof StudioNavConfig;

const SECTIONS: { key: SectionKey; title: string; hint: string }[] = [
  {
    key: "topBase",
    title: "创作者中心导航",
    hint: "出现在「创作者中心」顶部 Tab。其中「订单查看」仅站长可见；勿把用户/商家/装修/内容/系统设置放这里。",
  },
  {
    key: "topAdmin",
    title: "站长管理导航",
    hint: "仅站长可见，出现在「站长管理」区域（与创作者中心分离）。可改显示名称、链接与顺序。",
  },
  {
    key: "courses",
    title: "课程与资料子菜单",
    hint: "出现在课程中心内的二级导航，例如「课程与资料 / 我的资料 / 创建课程/资料」。",
  },
];

export function StudioNavSettings({ value, onChange, embedded }: Props) {
  const config: StudioNavConfig = {
    topBase: value.topBase?.length
      ? value.topBase
      : DEFAULT_STUDIO_NAV.topBase,
    topAdmin: value.topAdmin?.length
      ? value.topAdmin
      : DEFAULT_STUDIO_NAV.topAdmin,
    courses: value.courses?.length
      ? value.courses
      : DEFAULT_STUDIO_NAV.courses,
  };

  function patchSection(section: SectionKey, items: StudioNavLink[]) {
    onChange({ ...config, [section]: items });
  }

  function updateItem(
    section: SectionKey,
    key: string,
    partial: Partial<Pick<StudioNavLink, "label" | "href">>,
  ) {
    patchSection(
      section,
      config[section].map((item) =>
        item.key === key ? { ...item, ...partial } : item,
      ),
    );
  }

  function moveItem(section: SectionKey, key: string, dir: -1 | 1) {
    const items = [...config[section]];
    const index = items.findIndex((item) => item.key === key);
    const next = index + dir;
    if (index < 0 || next < 0 || next >= items.length) return;
    const [item] = items.splice(index, 1);
    items.splice(next, 0, item);
    patchSection(section, items);
  }

  function resetDefaults() {
    onChange(structuredClone(DEFAULT_STUDIO_NAV));
  }

  return (
    <div className={embedded ? "space-y-6" : "surface space-y-6 rounded-[28px] p-6"}>
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--muted)]">
            自定义工作室后台顶部导航与课程中心子菜单。留空保存时会回退到默认值。
          </p>
          <button
            type="button"
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            onClick={resetDefaults}
          >
            恢复默认
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">后台导航菜单</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              自定义工作室后台顶部导航与课程中心子菜单的显示名称和跳转链接。留空保存时会回退到默认值。
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            onClick={resetDefaults}
          >
            恢复默认
          </button>
        </div>
      )}

      {SECTIONS.map((section) => (
        <div key={section.key} className="space-y-3">
          <div>
            <h3 className="font-medium">{section.title}</h3>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{section.hint}</p>
          </div>
          <div className="space-y-3">
            {config[section.key].map((item, index) => (
              <div
                key={item.key}
                className="grid gap-3 rounded-2xl bg-white/60 p-3 sm:grid-cols-[1fr_1.4fr_auto]"
              >
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">显示名称</span>
                  <input
                    className={`${inputClass} mt-1`}
                    value={item.label}
                    maxLength={40}
                    onChange={(e) =>
                      updateItem(section.key, item.key, {
                        label: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">链接</span>
                  <input
                    className={`${inputClass} mt-1`}
                    value={item.href}
                    maxLength={300}
                    placeholder="/studio/..."
                    onChange={(e) =>
                      updateItem(section.key, item.key, {
                        href: e.target.value,
                      })
                    }
                  />
                </label>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-[var(--line)] px-3 py-2 text-sm disabled:opacity-40"
                    disabled={index === 0}
                    onClick={() => moveItem(section.key, item.key, -1)}
                    aria-label="上移"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-[var(--line)] px-3 py-2 text-sm disabled:opacity-40"
                    disabled={index === config[section.key].length - 1}
                    onClick={() => moveItem(section.key, item.key, 1)}
                    aria-label="下移"
                  >
                    ↓
                  </button>
                  <span className="pb-2 text-xs text-[var(--muted)]">
                    {item.key}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

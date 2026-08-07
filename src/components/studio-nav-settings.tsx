"use client";

import { useState } from "react";
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

/** 与门户导航 MIME 隔离，避免跨面板误投放 */
const STUDIO_NAV_DND_MIME = "application/x-studio-nav-index";

type SectionKey = keyof StudioNavConfig;

const SECTIONS: { key: SectionKey; title: string; hint: string }[] = [
  {
    key: "topBase",
    title: "创作者中心导航",
    hint: "出现在「创作者中心」顶部 Tab。拖拽左侧手柄或点上下箭头调顺序；「订单查看」仅站长可见；勿把用户/商家/装修/内容/系统设置放这里。",
  },
  {
    key: "topAdmin",
    title: "站长管理导航",
    hint: "仅站长可见，出现在「站长管理」区域（与创作者中心分离）。可改显示名称、链接与顺序。",
  },
  {
    key: "courses",
    title: "产品中心子菜单",
    hint: "出现在产品中心内的二级导航（默认「创建产品 / 我的课程 / 我的约搭 / 我的资料」）。拖拽或箭头调整的顺序会同步到前台子导航。",
  },
];

type DragTarget = { section: SectionKey; index: number };

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

  // 拖拽悬停高亮目标行，便于看出将插入的位置（分区内排序，不跨区）
  const [dragOver, setDragOver] = useState<DragTarget | null>(null);

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

  /** 数组下标即创作者中心 / 站长管理 / 课程子导航的渲染顺序 */
  function moveItem(section: SectionKey, from: number, to: number) {
    const items = config[section];
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= items.length ||
      to >= items.length
    ) {
      return;
    }
    const next = items.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    patchSection(section, next);
  }

  function resetDefaults() {
    onChange(structuredClone(DEFAULT_STUDIO_NAV));
  }

  return (
    <div className={embedded ? "space-y-6" : "surface space-y-6 rounded-[28px] p-6"}>
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--muted)]">
            自定义工作室后台顶部导航与课程中心子菜单。拖拽左侧手柄或点上下箭头调顺序；留空保存时会回退到默认值。
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
              自定义工作室后台顶部导航与课程中心子菜单的显示名称、跳转链接与顺序。拖拽左侧手柄或点上下箭头即可排序。
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
            {config[section.key].map((item, index) => {
              const isDragOver =
                dragOver?.section === section.key && dragOver.index === index;
              return (
                <div
                  key={item.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOver({ section: section.key, index });
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOver((current) =>
                        current?.section === section.key &&
                        current.index === index
                          ? null
                          : current,
                      );
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(null);
                    const raw = e.dataTransfer.getData(STUDIO_NAV_DND_MIME);
                    // 载荷含分区，防止把创作者项拖进站长管理或反之
                    const [fromSection, fromRaw] = raw.split(":");
                    if (fromSection !== section.key) return;
                    const from = Number.parseInt(fromRaw, 10);
                    if (Number.isFinite(from)) {
                      moveItem(section.key, from, index);
                    }
                  }}
                  className={`grid gap-3 rounded-2xl border bg-white/60 p-3 sm:grid-cols-[auto_1fr_1.4fr_auto] ${
                    isDragOver
                      ? "border-[var(--brand)] ring-1 ring-[var(--brand)]"
                      : "border-[var(--line)]"
                  }`}
                >
                  {/* 仅手柄可拖：避免改文案/链接时误触发排序；touch-manipulation 便于微信内触控 */}
                  <button
                    type="button"
                    draggable
                    className="flex h-11 w-11 shrink-0 cursor-grab items-center justify-center self-center rounded-xl border border-[var(--line)] bg-white/80 text-[var(--muted)] touch-manipulation active:cursor-grabbing"
                    aria-label={`拖拽调整「${item.label || item.key}」顺序`}
                    title="按住拖动调整顺序"
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        STUDIO_NAV_DND_MIME,
                        `${section.key}:${index}`,
                      );
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDragOver(null)}
                  >
                    <span aria-hidden className="select-none text-base leading-none">
                      ⋮⋮
                    </span>
                  </button>
                  <label className="block min-w-0 text-sm">
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
                  <label className="block min-w-0 text-sm">
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
                  <div className="flex flex-wrap items-end gap-2 sm:self-end">
                    <button
                      type="button"
                      className="btn btn-secondary min-h-11 min-w-11 touch-manipulation px-2.5 py-2 text-sm disabled:opacity-40"
                      disabled={index === 0}
                      onClick={() => moveItem(section.key, index, index - 1)}
                      aria-label={`上移「${item.label || item.key}」`}
                      title="上移"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary min-h-11 min-w-11 touch-manipulation px-2.5 py-2 text-sm disabled:opacity-40"
                      disabled={index === config[section.key].length - 1}
                      onClick={() => moveItem(section.key, index, index + 1)}
                      aria-label={`下移「${item.label || item.key}」`}
                      title="下移"
                    >
                      ↓
                    </button>
                    <span className="pb-2 text-xs text-[var(--muted)]">
                      {item.key}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

/**
 * 页面模板 DIY 编辑器：手机预览 + 属性面板 + 底部模块库。
 * 支持复制模板、上下/左右移动、绝对自由定位（触控拖拽）。
 * 保存写入 pageTemplatesJson，不改动 decorateJson。
 */

import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { CoverImagePicker } from "@/components/cover-image-picker";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";
import {
  PAGE_MODULE_LIBRARY,
  PAGE_SLOT_LABEL,
  PAGE_TEMPLATE_TYPE_LABEL,
  createModule,
  defaultModuleLayout,
  moduleLabel,
  publicTemplatePath,
  resolveModuleLayout,
  type AnimationModuleProps,
  type AudioModuleProps,
  type BannerModuleProps,
  type BannerSlide,
  type BlankCardModuleProps,
  type ButtonModuleProps,
  type CouponModuleProps,
  type CoursesModuleProps,
  type CountdownModuleProps,
  type DividerModuleProps,
  type DualColumnModuleProps,
  type EmbedModuleProps,
  type FaqModuleProps,
  type GalleryModuleProps,
  type HeadingModuleProps,
  type IconRowModuleProps,
  type ImageModuleProps,
  type LinkCardModuleProps,
  type MarqueeModuleProps,
  type NoticeModuleProps,
  type PageModule,
  type PageModuleLayout,
  type PageModuleType,
  type PageSlotId,
  type PageSlotModuleProps,
  type PageTemplate,
  type RichtextModuleProps,
  type SearchModuleProps,
  type SocialLinksModuleProps,
  type SpacerModuleProps,
  type StatsModuleProps,
  type TeachersModuleProps,
  type TestimonialModuleProps,
  type VideoModuleProps,
} from "@/lib/page-templates";

type Props = {
  initial: PageTemplate;
};

const inputClass =
  "w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";

function flowShellStyle(layout: PageModuleLayout): CSSProperties {
  if (layout.column === "left" || layout.column === "right") {
    return { width: "50%", boxSizing: "border-box" };
  }
  return { width: "100%" };
}

function absoluteShellStyle(layout: PageModuleLayout): CSSProperties {
  return {
    position: "absolute",
    left: `${layout.x}%`,
    top: `${layout.y}px`,
    width: `${layout.width}%`,
    zIndex: layout.zIndex,
    boxSizing: "border-box",
  };
}

function PreviewBody({ module }: { module: PageModule }) {
  switch (module.type) {
    case "search":
      return (
        <div className="px-2 py-2">
          <div className="rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-xs text-[var(--muted)]">
            {(module.props as SearchModuleProps).placeholder}
          </div>
        </div>
      );
    case "banner":
      return (
        <div className="px-2 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              (module.props as BannerModuleProps).slides[0]?.url ||
              "/covers/hero-seminar.jpg"
            }
            alt=""
            className="w-full rounded-xl object-cover"
            style={{
              height: (module.props as BannerModuleProps).height || 140,
            }}
          />
        </div>
      );
    case "image":
      return (
        <div className="px-2 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={(module.props as ImageModuleProps).url || "/covers/team-collab.jpg"}
            alt=""
            className="w-full object-cover"
            style={{
              borderRadius: (module.props as ImageModuleProps).radius,
            }}
          />
        </div>
      );
    case "courses":
      return (
        <div className="px-2 py-3">
          <div className="text-sm font-semibold">
            {(module.props as CoursesModuleProps).title}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="rounded-xl bg-[var(--bg-deep)] px-2 py-6 text-center text-[10px] text-[var(--muted)]"
              >
                课程卡片
              </div>
            ))}
          </div>
        </div>
      );
    case "categories":
      return (
        <div className="flex flex-wrap gap-1.5 px-2 py-3">
          {["分类A", "分类B", "分类C"].map((label) => (
            <span
              key={label}
              className="rounded-full border border-[var(--line)] px-2 py-1 text-[10px]"
            >
              {label}
            </span>
          ))}
        </div>
      );
    case "teachers":
      return (
        <div className="px-2 py-3">
          <div className="text-sm font-semibold">
            {(module.props as TeachersModuleProps).title}
          </div>
          <div className="mt-2 flex gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 w-10 rounded-full bg-[var(--bg-deep)]" />
            ))}
          </div>
        </div>
      );
    case "spacer":
      return (
        <div
          className="mx-2 my-1 rounded border border-dashed border-[var(--line)] bg-[var(--bg)]/60"
          style={{ height: (module.props as SpacerModuleProps).height }}
        />
      );
    case "richtext":
      return (
        <div
          className="px-3 py-2 text-xs leading-5 text-[var(--muted)]"
          dangerouslySetInnerHTML={{
            __html: (module.props as RichtextModuleProps).html || "富文本",
          }}
        />
      );
    case "pageSlot":
      return (
        <div className="mx-2 my-2 rounded-xl border border-dashed border-[var(--brand)]/40 bg-[var(--brand-soft)] px-3 py-4 text-center text-xs text-[var(--brand)]">
          功能区 ·{" "}
          {PAGE_SLOT_LABEL[
            (module.props as PageSlotModuleProps).slot as PageSlotId
          ] || (module.props as PageSlotModuleProps).slot}
        </div>
      );
    case "video": {
      const p = module.props as VideoModuleProps;
      return (
        <div className="px-2 py-2">
          <div className="relative overflow-hidden rounded-xl bg-black/80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.poster || "/covers/hero-seminar.jpg"}
              alt=""
              className="aspect-video w-full object-cover opacity-80"
            />
            <span className="absolute inset-0 flex items-center justify-center text-white">
              ▶ {p.title || "视频"}
            </span>
          </div>
        </div>
      );
    }
    case "animation": {
      const p = module.props as AnimationModuleProps;
      return (
        <div
          className="mx-2 my-2 flex animate-pulse items-center justify-center rounded-xl bg-[var(--brand-soft)] text-xs text-[var(--brand)]"
          style={{ height: p.height }}
        >
          {p.title || "动画"} · {p.kind}
        </div>
      );
    }
    case "button": {
      const p = module.props as ButtonModuleProps;
      return (
        <div className="px-2 py-3 text-center">
          <span className="inline-flex rounded-xl bg-[var(--brand)] px-4 py-2 text-xs text-white">
            {p.text}
          </span>
        </div>
      );
    }
    case "dualColumn":
      return (
        <div className="grid grid-cols-2 gap-1 px-2 py-2 text-[10px]">
          <div className="rounded-lg bg-[var(--bg-deep)] p-2">
            {(module.props as DualColumnModuleProps).leftTitle}
          </div>
          <div className="rounded-lg bg-[var(--bg-deep)] p-2 text-center">图</div>
        </div>
      );
    case "divider":
      return <hr className="mx-3 my-3 border-[var(--line)]" />;
    case "heading":
      return (
        <div className="px-3 py-2 text-sm font-semibold">
          {(module.props as HeadingModuleProps).text}
        </div>
      );
    case "notice":
      return (
        <div className="mx-2 my-2 rounded-lg bg-sky-50 px-2 py-2 text-[10px] text-sky-900">
          {(module.props as NoticeModuleProps).text}
        </div>
      );
    case "countdown":
      return (
        <div className="px-2 py-3 text-center text-xs">
          {(module.props as CountdownModuleProps).title} · 倒计时
        </div>
      );
    case "linkCard":
      return (
        <div className="mx-2 my-2 flex gap-2 rounded-xl border border-[var(--line)] p-2 text-[10px]">
          <div className="h-12 w-12 rounded bg-[var(--bg-deep)]" />
          <div>{(module.props as LinkCardModuleProps).title}</div>
        </div>
      );
    case "audio":
      return (
        <div className="px-2 py-3 text-xs text-[var(--muted)]">
          🎵 {(module.props as AudioModuleProps).title}
        </div>
      );
    case "iconRow":
      return (
        <div className="grid grid-cols-4 gap-1 px-2 py-2 text-center text-[10px]">
          {(module.props as IconRowModuleProps).items.slice(0, 4).map((it) => (
            <div key={it.id}>
              <div>{it.icon}</div>
              <div>{it.label}</div>
            </div>
          ))}
        </div>
      );
    case "faq":
      return (
        <div className="px-2 py-2 text-xs">
          {(module.props as FaqModuleProps).title} ·{" "}
          {(module.props as FaqModuleProps).items.length} 问
        </div>
      );
    case "testimonial":
      return (
        <div className="px-2 py-2 text-xs text-[var(--muted)]">
          “{(module.props as TestimonialModuleProps).items[0]?.quote || "证言"}”
        </div>
      );
    case "coupon":
      return (
        <div className="mx-2 my-2 rounded-xl border border-dashed border-[var(--brand)] bg-[var(--brand-soft)] px-2 py-3 text-center text-xs text-[var(--brand)]">
          {(module.props as CouponModuleProps).title}
        </div>
      );
    case "gallery":
      return (
        <div className="grid grid-cols-2 gap-1 px-2 py-2">
          {(module.props as GalleryModuleProps).images.slice(0, 2).map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.id}
              src={img.url}
              alt=""
              className="aspect-square rounded object-cover"
            />
          ))}
        </div>
      );
    case "embed":
      return (
        <div className="mx-2 my-2 rounded-xl border border-dashed border-[var(--line)] px-2 py-6 text-center text-[10px] text-[var(--muted)]">
          iframe · {(module.props as EmbedModuleProps).title}
        </div>
      );
    case "marquee":
      return (
        <div className="overflow-hidden bg-[var(--bg-deep)] py-2 text-[10px]">
          <div className="whitespace-nowrap px-2">
            {(module.props as MarqueeModuleProps).text}
          </div>
        </div>
      );
    case "socialLinks":
      return (
        <div className="flex flex-wrap gap-1 px-2 py-2">
          {(module.props as SocialLinksModuleProps).items.map((it) => (
            <span
              key={it.id}
              className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px]"
            >
              {it.label}
            </span>
          ))}
        </div>
      );
    case "stats":
      return (
        <div className="grid grid-cols-3 gap-1 px-2 py-2 text-center text-[10px]">
          {(module.props as StatsModuleProps).items.map((it) => (
            <div key={it.id} className="rounded-lg bg-[var(--bg-deep)] py-2">
              <div className="font-semibold text-[var(--brand)]">{it.value}</div>
              <div>{it.label}</div>
            </div>
          ))}
        </div>
      );
    case "blankCard":
      return (
        <div className="mx-2 my-2 rounded-xl border border-[var(--line)] px-2 py-3 text-xs">
          {(module.props as BlankCardModuleProps).title}
        </div>
      );
    default:
      return (
        <div className="px-2 py-3 text-xs text-[var(--muted)]">
          {moduleLabel(module.type)}
        </div>
      );
  }
}

function PreviewModule({
  module,
  selected,
  onSelect,
  onDragAbsolute,
  canvasRef,
}: {
  module: PageModule;
  selected: boolean;
  onSelect: () => void;
  onDragAbsolute: (id: string, x: number, y: number) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}) {
  const layout = resolveModuleLayout(module.layout);
  const ring = selected
    ? "ring-2 ring-[var(--brand)] ring-offset-1"
    : "ring-1 ring-transparent";
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    onSelect();
    if (layout.mode !== "absolute") return;
    // 自由定位：pointer 事件同时覆盖鼠标与触控（微信后台）
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: layout.x,
      origY: layout.y,
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragRef.current || layout.mode !== "absolute") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const nextX = Math.min(
      90,
      Math.max(0, dragRef.current.origX + (dx / Math.max(rect.width, 1)) * 100),
    );
    const nextY = Math.min(
      2000,
      Math.max(0, dragRef.current.origY + dy),
    );
    onDragAbsolute(module.id, Math.round(nextX), Math.round(nextY));
  }

  function onPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    if (dragRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    dragRef.current = null;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`relative touch-none text-left ${ring} rounded-lg ${
        layout.mode === "absolute" ? "cursor-move" : "w-full"
      }`}
      style={
        layout.mode === "absolute"
          ? absoluteShellStyle(layout)
          : flowShellStyle(layout)
      }
    >
      <span className="absolute right-1 top-1 z-10 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
        {moduleLabel(module.type)}
        {layout.mode === "absolute" ? " · 拖" : ""}
        {layout.mode === "flow" && layout.column !== "full"
          ? ` · ${layout.column === "left" ? "左" : "右"}`
          : ""}
      </span>
      <PreviewBody module={module} />
    </button>
  );
}

function PropsEditor({
  module,
  onChange,
}: {
  module: PageModule;
  onChange: (next: PageModule) => void;
}) {
  function patchProps(partial: Record<string, unknown>) {
    onChange({
      ...module,
      props: { ...module.props, ...partial } as PageModule["props"],
    });
  }

  if (module.type === "search") {
    const p = module.props as SearchModuleProps;
    return (
      <label className="block text-sm">
        <span className="text-[var(--muted)]">占位文案</span>
        <input
          className={`${inputClass} mt-1`}
          value={p.placeholder}
          onChange={(e) => patchProps({ placeholder: e.target.value })}
        />
      </label>
    );
  }

  if (module.type === "banner") {
    const p = module.props as BannerModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">高度 (px)</span>
          <input
            type="number"
            className={`${inputClass} mt-1`}
            value={p.height}
            min={80}
            max={420}
            onChange={(e) => patchProps({ height: Number(e.target.value) || 160 })}
          />
        </label>
        {p.slides.map((slide, index) => (
          <div
            key={slide.id}
            className="space-y-2 rounded-xl border border-[var(--line)] p-3"
          >
            <div className="text-xs font-medium">幻灯 {index + 1}</div>
            <input
              className={inputClass}
              placeholder="图片 URL"
              value={slide.url}
              onChange={(e) => {
                const slides = [...p.slides];
                slides[index] = { ...slide, url: e.target.value };
                patchProps({ slides });
              }}
            />
            <CoverImagePicker
              value={slide.url}
              title="选用封面图"
              onChange={(url) => {
                const slides = [...p.slides];
                slides[index] = { ...slide, url };
                patchProps({ slides });
              }}
            />
            <input
              className={inputClass}
              placeholder="跳转链接（可选）"
              value={slide.href}
              onChange={(e) => {
                const slides = [...p.slides];
                slides[index] = { ...slide, href: e.target.value };
                patchProps({ slides });
              }}
            />
            <button
              type="button"
              className="text-xs text-[var(--fire)]"
              onClick={() =>
                patchProps({
                  slides: p.slides.filter((s) => s.id !== slide.id),
                })
              }
            >
              删除此张
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn min-h-10 border border-[var(--line)] bg-white text-sm"
          onClick={() => {
            const slide: BannerSlide = {
              id: `slide_${Date.now().toString(36)}`,
              url: "/covers/hero-seminar.jpg",
              alt: "",
              href: "",
            };
            patchProps({ slides: [...p.slides, slide] });
          }}
        >
          + 添加幻灯
        </button>
      </div>
    );
  }

  if (module.type === "image") {
    const p = module.props as ImageModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">图片 URL</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.url}
            onChange={(e) => patchProps({ url: e.target.value })}
          />
        </label>
        <CoverImagePicker value={p.url} onChange={(url) => patchProps({ url })} />
        <label className="block text-sm">
          <span className="text-[var(--muted)]">跳转链接</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.href}
            onChange={(e) => patchProps({ href: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">圆角</span>
          <input
            type="number"
            className={`${inputClass} mt-1`}
            value={p.radius}
            min={0}
            max={40}
            onChange={(e) => patchProps({ radius: Number(e.target.value) || 0 })}
          />
        </label>
      </div>
    );
  }

  if (module.type === "courses") {
    const p = module.props as CoursesModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">标题</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.title}
            onChange={(e) => patchProps({ title: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">副标题</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.subtitle}
            onChange={(e) => patchProps({ subtitle: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">数量</span>
          <input
            type="number"
            className={`${inputClass} mt-1`}
            value={p.limit}
            min={1}
            max={24}
            onChange={(e) => patchProps({ limit: Number(e.target.value) || 6 })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">分类 slug（空=全部）</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.categorySlug}
            onChange={(e) => patchProps({ categorySlug: e.target.value })}
            placeholder="如 programming"
          />
        </label>
      </div>
    );
  }

  if (module.type === "categories") {
    return (
      <label className="block text-sm">
        <span className="text-[var(--muted)]">标题</span>
        <input
          className={`${inputClass} mt-1`}
          value={(module.props as { title: string }).title}
          onChange={(e) => patchProps({ title: e.target.value })}
        />
      </label>
    );
  }

  if (module.type === "teachers") {
    const p = module.props as TeachersModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">标题</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.title}
            onChange={(e) => patchProps({ title: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">数量</span>
          <input
            type="number"
            className={`${inputClass} mt-1`}
            value={p.limit}
            min={1}
            max={24}
            onChange={(e) => patchProps({ limit: Number(e.target.value) || 6 })}
          />
        </label>
      </div>
    );
  }

  if (module.type === "spacer") {
    const p = module.props as SpacerModuleProps;
    return (
      <label className="block text-sm">
        <span className="text-[var(--muted)]">高度 (px)</span>
        <input
          type="number"
          className={`${inputClass} mt-1`}
          value={p.height}
          min={8}
          max={200}
          onChange={(e) => patchProps({ height: Number(e.target.value) || 24 })}
        />
      </label>
    );
  }

  if (module.type === "richtext") {
    const p = module.props as RichtextModuleProps;
    return (
      <label className="block text-sm">
        <span className="text-[var(--muted)]">内容（支持简单 HTML）</span>
        <textarea
          className={`${inputClass} mt-1 min-h-40 font-mono text-xs`}
          value={p.html}
          onChange={(e) => patchProps({ html: e.target.value })}
        />
      </label>
    );
  }

  if (module.type === "pageSlot") {
    const p = module.props as PageSlotModuleProps;
    return (
      <label className="block text-sm">
        <span className="text-[var(--muted)]">嵌入哪块业务内容</span>
        <select
          className={`${inputClass} mt-1`}
          value={p.slot}
          onChange={(e) => patchProps({ slot: e.target.value as PageSlotId })}
        >
          {(Object.keys(PAGE_SLOT_LABEL) as PageSlotId[]).map((slot) => (
            <option key={slot} value={slot}>
              {PAGE_SLOT_LABEL[slot]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--muted)]">
          前台对应页面会把该区域渲染为真实业务（广场、介绍、个人中心等）。
        </p>
      </label>
    );
  }

  if (module.type === "video") {
    const p = module.props as VideoModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">标题</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.title}
            onChange={(e) => patchProps({ title: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">视频 URL（mp4 等直链）</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.url}
            onChange={(e) => patchProps({ url: e.target.value })}
            placeholder="https://..."
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">封面图 URL</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.poster}
            onChange={(e) => patchProps({ poster: e.target.value })}
          />
        </label>
        <CoverImagePicker
          value={p.poster}
          onChange={(url) => patchProps({ poster: url })}
        />
      </div>
    );
  }

  if (module.type === "animation") {
    const p = module.props as AnimationModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">标题</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.title}
            onChange={(e) => patchProps({ title: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">类型</span>
          <select
            className={`${inputClass} mt-1`}
            value={p.kind}
            onChange={(e) =>
              patchProps({ kind: e.target.value as AnimationModuleProps["kind"] })
            }
          >
            <option value="css">CSS 动效</option>
            <option value="gif">GIF / 动图</option>
            <option value="lottie">Lottie 图源</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">动效预设</span>
          <select
            className={`${inputClass} mt-1`}
            value={p.cssPreset}
            onChange={(e) =>
              patchProps({
                cssPreset: e.target.value as AnimationModuleProps["cssPreset"],
              })
            }
          >
            <option value="float">浮动</option>
            <option value="pulse">脉冲</option>
            <option value="fade">淡入淡出</option>
            <option value="shine">闪烁</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">资源 URL（GIF/Lottie 可选）</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.src}
            onChange={(e) => patchProps({ src: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">高度</span>
          <input
            type="number"
            className={`${inputClass} mt-1`}
            value={p.height}
            min={60}
            max={400}
            onChange={(e) => patchProps({ height: Number(e.target.value) || 120 })}
          />
        </label>
      </div>
    );
  }

  if (module.type === "button") {
    const p = module.props as ButtonModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">按钮文案</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.text}
            onChange={(e) => patchProps({ text: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">链接</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.href}
            onChange={(e) => patchProps({ href: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">对齐</span>
          <select
            className={`${inputClass} mt-1`}
            value={p.align}
            onChange={(e) => patchProps({ align: e.target.value })}
          >
            <option value="left">左</option>
            <option value="center">中</option>
            <option value="right">右</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">样式</span>
          <select
            className={`${inputClass} mt-1`}
            value={p.variant}
            onChange={(e) => patchProps({ variant: e.target.value })}
          >
            <option value="primary">主色</option>
            <option value="outline">描边</option>
            <option value="soft">浅色</option>
          </select>
        </label>
      </div>
    );
  }

  if (module.type === "dualColumn") {
    const p = module.props as DualColumnModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">左侧标题</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.leftTitle}
            onChange={(e) => patchProps({ leftTitle: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">左侧 HTML</span>
          <textarea
            className={`${inputClass} mt-1 min-h-24 font-mono text-xs`}
            value={p.leftHtml}
            onChange={(e) => patchProps({ leftHtml: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">右侧图片</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.rightImage}
            onChange={(e) => patchProps({ rightImage: e.target.value })}
          />
        </label>
        <CoverImagePicker
          value={p.rightImage}
          onChange={(url) => patchProps({ rightImage: url })}
        />
        <label className="block text-sm">
          <span className="text-[var(--muted)]">右侧链接</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.rightHref}
            onChange={(e) => patchProps({ rightHref: e.target.value })}
          />
        </label>
      </div>
    );
  }

  if (module.type === "divider") {
    const p = module.props as DividerModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">样式</span>
          <select
            className={`${inputClass} mt-1`}
            value={p.style}
            onChange={(e) => patchProps({ style: e.target.value })}
          >
            <option value="solid">实线</option>
            <option value="dashed">虚线</option>
            <option value="dotted">点线</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">颜色</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.color}
            onChange={(e) => patchProps({ color: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">粗细</span>
          <input
            type="number"
            className={`${inputClass} mt-1`}
            value={p.thickness}
            min={1}
            max={8}
            onChange={(e) =>
              patchProps({ thickness: Number(e.target.value) || 1 })
            }
          />
        </label>
      </div>
    );
  }

  if (module.type === "heading") {
    const p = module.props as HeadingModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">标题文字</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.text}
            onChange={(e) => patchProps({ text: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">级别</span>
          <select
            className={`${inputClass} mt-1`}
            value={p.level}
            onChange={(e) => patchProps({ level: Number(e.target.value) })}
          >
            <option value={1}>H1</option>
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">对齐</span>
          <select
            className={`${inputClass} mt-1`}
            value={p.align}
            onChange={(e) => patchProps({ align: e.target.value })}
          >
            <option value="left">左</option>
            <option value="center">中</option>
            <option value="right">右</option>
          </select>
        </label>
      </div>
    );
  }

  if (module.type === "notice") {
    const p = module.props as NoticeModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">公告内容</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.text}
            onChange={(e) => patchProps({ text: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">语气</span>
          <select
            className={`${inputClass} mt-1`}
            value={p.tone}
            onChange={(e) => patchProps({ tone: e.target.value })}
          >
            <option value="info">提示</option>
            <option value="warn">警告</option>
            <option value="success">成功</option>
          </select>
        </label>
      </div>
    );
  }

  if (module.type === "countdown") {
    const p = module.props as CountdownModuleProps;
    const localValue = p.targetAt
      ? new Date(p.targetAt).toISOString().slice(0, 16)
      : "";
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">标题</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.title}
            onChange={(e) => patchProps({ title: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">截止时间</span>
          <input
            type="datetime-local"
            className={`${inputClass} mt-1 min-h-12 px-3 py-3 text-lg`}
            value={localValue}
            onChange={(e) => {
              const d = new Date(e.target.value);
              patchProps({
                targetAt: Number.isNaN(d.getTime())
                  ? p.targetAt
                  : d.toISOString(),
              });
            }}
          />
        </label>
      </div>
    );
  }

  if (module.type === "linkCard") {
    const p = module.props as LinkCardModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">标题</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.title}
            onChange={(e) => patchProps({ title: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">描述</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.description}
            onChange={(e) => patchProps({ description: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">链接</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.href}
            onChange={(e) => patchProps({ href: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">图片</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.imageUrl}
            onChange={(e) => patchProps({ imageUrl: e.target.value })}
          />
        </label>
        <CoverImagePicker
          value={p.imageUrl}
          onChange={(url) => patchProps({ imageUrl: url })}
        />
      </div>
    );
  }

  if (module.type === "audio") {
    const p = module.props as AudioModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">标题</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.title}
            onChange={(e) => patchProps({ title: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">音频 URL</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.url}
            onChange={(e) => patchProps({ url: e.target.value })}
          />
        </label>
      </div>
    );
  }

  if (module.type === "iconRow") {
    const p = module.props as IconRowModuleProps;
    return (
      <div className="space-y-3">
        {p.items.map((item, index) => (
          <div
            key={item.id}
            className="space-y-2 rounded-xl border border-[var(--line)] p-3"
          >
            <input
              className={inputClass}
              placeholder="图标（emoji）"
              value={item.icon}
              onChange={(e) => {
                const items = [...p.items];
                items[index] = { ...item, icon: e.target.value };
                patchProps({ items });
              }}
            />
            <input
              className={inputClass}
              placeholder="文案"
              value={item.label}
              onChange={(e) => {
                const items = [...p.items];
                items[index] = { ...item, label: e.target.value };
                patchProps({ items });
              }}
            />
            <input
              className={inputClass}
              placeholder="链接"
              value={item.href}
              onChange={(e) => {
                const items = [...p.items];
                items[index] = { ...item, href: e.target.value };
                patchProps({ items });
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (module.type === "faq") {
    const p = module.props as FaqModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">标题</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.title}
            onChange={(e) => patchProps({ title: e.target.value })}
          />
        </label>
        {p.items.map((item, index) => (
          <div
            key={item.id}
            className="space-y-2 rounded-xl border border-[var(--line)] p-3"
          >
            <input
              className={inputClass}
              placeholder="问题"
              value={item.question}
              onChange={(e) => {
                const items = [...p.items];
                items[index] = { ...item, question: e.target.value };
                patchProps({ items });
              }}
            />
            <textarea
              className={`${inputClass} min-h-16`}
              placeholder="回答"
              value={item.answer}
              onChange={(e) => {
                const items = [...p.items];
                items[index] = { ...item, answer: e.target.value };
                patchProps({ items });
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="btn min-h-10 border border-[var(--line)] bg-white text-sm"
          onClick={() =>
            patchProps({
              items: [
                ...p.items,
                {
                  id: `faq_${Date.now().toString(36)}`,
                  question: "新问题",
                  answer: "",
                },
              ],
            })
          }
        >
          + 添加问题
        </button>
      </div>
    );
  }

  if (module.type === "testimonial") {
    const p = module.props as TestimonialModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">标题</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.title}
            onChange={(e) => patchProps({ title: e.target.value })}
          />
        </label>
        {p.items.map((item, index) => (
          <div
            key={item.id}
            className="space-y-2 rounded-xl border border-[var(--line)] p-3"
          >
            <input
              className={inputClass}
              placeholder="姓名"
              value={item.name}
              onChange={(e) => {
                const items = [...p.items];
                items[index] = { ...item, name: e.target.value };
                patchProps({ items });
              }}
            />
            <textarea
              className={`${inputClass} min-h-16`}
              placeholder="评价"
              value={item.quote}
              onChange={(e) => {
                const items = [...p.items];
                items[index] = { ...item, quote: e.target.value };
                patchProps({ items });
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (module.type === "coupon") {
    const p = module.props as CouponModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">标题</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.title}
            onChange={(e) => patchProps({ title: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">副标题</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.subtitle}
            onChange={(e) => patchProps({ subtitle: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">跳转链接</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.href}
            onChange={(e) => patchProps({ href: e.target.value })}
          />
        </label>
      </div>
    );
  }

  if (module.type === "gallery") {
    const p = module.props as GalleryModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">列数</span>
          <select
            className={`${inputClass} mt-1`}
            value={p.columns}
            onChange={(e) => patchProps({ columns: Number(e.target.value) })}
          >
            <option value={2}>2 列</option>
            <option value={3}>3 列</option>
          </select>
        </label>
        {p.images.map((img, index) => (
          <div key={img.id} className="space-y-2">
            <input
              className={inputClass}
              value={img.url}
              onChange={(e) => {
                const images = [...p.images];
                images[index] = { ...img, url: e.target.value };
                patchProps({ images });
              }}
            />
            <CoverImagePicker
              value={img.url}
              onChange={(url) => {
                const images = [...p.images];
                images[index] = { ...img, url };
                patchProps({ images });
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="btn min-h-10 border border-[var(--line)] bg-white text-sm"
          onClick={() =>
            patchProps({
              images: [
                ...p.images,
                {
                  id: `gal_${Date.now().toString(36)}`,
                  url: "/covers/team-collab.jpg",
                  alt: "",
                },
              ],
            })
          }
        >
          + 添加图片
        </button>
      </div>
    );
  }

  if (module.type === "embed") {
    const p = module.props as EmbedModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">标题</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.title}
            onChange={(e) => patchProps({ title: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">https 地址</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.url}
            onChange={(e) => patchProps({ url: e.target.value })}
            placeholder="https://..."
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">高度</span>
          <input
            type="number"
            className={`${inputClass} mt-1`}
            value={p.height}
            min={100}
            max={800}
            onChange={(e) => patchProps({ height: Number(e.target.value) || 220 })}
          />
        </label>
      </div>
    );
  }

  if (module.type === "marquee") {
    const p = module.props as MarqueeModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">滚动文案</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.text}
            onChange={(e) => patchProps({ text: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">速度 (10–100)</span>
          <input
            type="number"
            className={`${inputClass} mt-1`}
            value={p.speed}
            min={10}
            max={100}
            onChange={(e) => patchProps({ speed: Number(e.target.value) || 40 })}
          />
        </label>
      </div>
    );
  }

  if (module.type === "socialLinks") {
    const p = module.props as SocialLinksModuleProps;
    return (
      <div className="space-y-3">
        {p.items.map((item, index) => (
          <div
            key={item.id}
            className="space-y-2 rounded-xl border border-[var(--line)] p-3"
          >
            <input
              className={inputClass}
              placeholder="名称"
              value={item.label}
              onChange={(e) => {
                const items = [...p.items];
                items[index] = { ...item, label: e.target.value };
                patchProps({ items });
              }}
            />
            <input
              className={inputClass}
              placeholder="链接"
              value={item.href}
              onChange={(e) => {
                const items = [...p.items];
                items[index] = { ...item, href: e.target.value };
                patchProps({ items });
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (module.type === "stats") {
    const p = module.props as StatsModuleProps;
    return (
      <div className="space-y-3">
        {p.items.map((item, index) => (
          <div
            key={item.id}
            className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--line)] p-3"
          >
            <input
              className={inputClass}
              placeholder="数值"
              value={item.value}
              onChange={(e) => {
                const items = [...p.items];
                items[index] = { ...item, value: e.target.value };
                patchProps({ items });
              }}
            />
            <input
              className={inputClass}
              placeholder="标签"
              value={item.label}
              onChange={(e) => {
                const items = [...p.items];
                items[index] = { ...item, label: e.target.value };
                patchProps({ items });
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (module.type === "blankCard") {
    const p = module.props as BlankCardModuleProps;
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">标题</span>
          <input
            className={`${inputClass} mt-1`}
            value={p.title}
            onChange={(e) => patchProps({ title: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">正文</span>
          <textarea
            className={`${inputClass} mt-1 min-h-20`}
            value={p.body}
            onChange={(e) => patchProps({ body: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">最小高度</span>
          <input
            type="number"
            className={`${inputClass} mt-1`}
            value={p.minHeight}
            min={40}
            max={400}
            onChange={(e) =>
              patchProps({ minHeight: Number(e.target.value) || 80 })
            }
          />
        </label>
      </div>
    );
  }

  return <p className="text-sm text-[var(--muted)]">该模块无可编辑属性</p>;
}

export function PageTemplateEditor({ initial }: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [template, setTemplate] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.modules[0]?.id || null,
  );
  const [libraryQuery, setLibraryQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [feedback, setFeedback] = useState<SaveStatus>(null);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);

  const selected = useMemo(
    () => template.modules.find((m) => m.id === selectedId) || null,
    [template.modules, selectedId],
  );

  const selectedLayout = selected
    ? resolveModuleLayout(selected.layout)
    : defaultModuleLayout();

  const library = useMemo(() => {
    const q = libraryQuery.trim();
    if (!q) return PAGE_MODULE_LIBRARY;
    return PAGE_MODULE_LIBRARY.filter(
      (m) => m.label.includes(q) || m.hint.includes(q),
    );
  }, [libraryQuery]);

  const flowModules = template.modules.filter(
    (m) => resolveModuleLayout(m.layout).mode !== "absolute",
  );
  const absoluteModules = template.modules.filter(
    (m) => resolveModuleLayout(m.layout).mode === "absolute",
  );
  const absMaxY = absoluteModules.reduce((max, m) => {
    const L = resolveModuleLayout(m.layout);
    return Math.max(max, L.y + 140);
  }, 420);

  function updateModules(modules: PageModule[]) {
    setTemplate((cur) => ({ ...cur, modules }));
  }

  function patchModuleLayout(
    id: string,
    patch: Partial<PageModuleLayout>,
  ) {
    updateModules(
      template.modules.map((m) => {
        if (m.id !== id) return m;
        const cur = resolveModuleLayout(m.layout);
        return { ...m, layout: { ...cur, ...patch } };
      }),
    );
  }

  function moveModule(id: string, dir: -1 | 1) {
    const index = template.modules.findIndex((m) => m.id === id);
    if (index < 0) return;
    const next = [...template.modules];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    updateModules(next);
  }

  /** 文档流左右列；绝对模式则微调 x */
  function shiftHorizontal(id: string, dir: -1 | 1) {
    const mod = template.modules.find((m) => m.id === id);
    if (!mod) return;
    const layout = resolveModuleLayout(mod.layout);
    if (layout.mode === "absolute") {
      const nextX = Math.min(90, Math.max(0, layout.x + dir * 5));
      patchModuleLayout(id, { x: nextX });
      return;
    }
    const order: Array<PageModuleLayout["column"]> = ["full", "left", "right"];
    const idx = order.indexOf(layout.column);
    const next = order[Math.min(order.length - 1, Math.max(0, idx + dir))];
    patchModuleLayout(id, { column: next || "full" });
  }

  function toggleAbsolute(id: string) {
    const mod = template.modules.find((m) => m.id === id);
    if (!mod) return;
    const layout = resolveModuleLayout(mod.layout);
    if (layout.mode === "absolute") {
      patchModuleLayout(id, {
        mode: "flow",
        column: "full",
        x: 0,
        y: 0,
        width: 100,
      });
      return;
    }
    // 切入自由定位：给一个可拖默认位置
    const index = template.modules.findIndex((m) => m.id === id);
    patchModuleLayout(id, {
      mode: "absolute",
      x: 5,
      y: Math.min(800, 40 + index * 80),
      width: 90,
      zIndex: 10,
      column: "full",
    });
  }

  function removeModule(id: string) {
    const next = template.modules.filter((m) => m.id !== id);
    updateModules(next);
    if (selectedId === id) setSelectedId(next[0]?.id || null);
  }

  function addModule(type: PageModuleType) {
    const mod = createModule(type);
    updateModules([...template.modules, mod]);
    setSelectedId(mod.id);
  }

  async function save() {
    setSaving(true);
    setFeedback(null);
    const result = await postSave("/api/studio/page-templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: template.id,
        name: template.name,
        slug: template.slug,
        isDefault: template.isDefault,
        coverUrl: template.coverUrl,
        backgroundUrl: template.backgroundUrl,
        modules: template.modules,
      }),
    });
    setSaving(false);
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "保存失败" });
      return;
    }
    if (result.data.template) {
      setTemplate(result.data.template as PageTemplate);
    }
    setFeedback({ kind: "ok", text: "模板已保存成功" });
    router.refresh();
  }

  async function duplicateTemplate() {
    setDuplicating(true);
    setFeedback(null);
    const result = await postSave("/api/studio/page-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate", id: template.id }),
    });
    setDuplicating(false);
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "复制失败" });
      return;
    }
    const copy = result.data.template as PageTemplate | undefined;
    setFeedback({ kind: "ok", text: "已复制为可编辑模板" });
    if (copy?.id) {
      router.push(`/studio/templates/${copy.id}/edit`);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/studio/templates"
            className="text-sm text-[var(--brand)]"
          >
            ← 返回模板列表
          </Link>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
            编辑页面模板
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {PAGE_TEMPLATE_TYPE_LABEL[template.type]}
            {template.type === "custom"
              ? ` · ${publicTemplatePath(template)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn min-h-11 border border-[var(--line)] bg-white"
            onClick={() => {
              setShowCoverPicker((v) => !v);
              setShowBgPicker(false);
            }}
          >
            设置封面图
          </button>
          <button
            type="button"
            className="btn min-h-11 border border-[var(--line)] bg-white"
            onClick={() => {
              setShowBgPicker((v) => !v);
              setShowCoverPicker(false);
            }}
          >
            设置背景图
          </button>
          <button
            type="button"
            className="btn min-h-11 border border-[var(--brand)]/40 bg-[var(--brand-soft)] text-[var(--brand)]"
            disabled={duplicating}
            onClick={() => void duplicateTemplate()}
          >
            {duplicating ? "复制中…" : "复制模板"}
          </button>
          <button
            type="button"
            className="btn btn-primary min-h-11"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "保存中…" : "保存模板"}
          </button>
          <SaveFeedback status={feedback} />
        </div>
      </div>

      {showCoverPicker || showBgPicker ? (
        <div className="surface rounded-[24px] p-4 sm:p-5">
          <div className="mb-2 text-sm font-medium">
            {showCoverPicker ? "模板封面（列表预览）" : "页面背景图"}
          </div>
          <input
            className={`${inputClass} mb-3`}
            placeholder="图片 URL 或从下方选用"
            value={showCoverPicker ? template.coverUrl : template.backgroundUrl}
            onChange={(e) =>
              setTemplate((cur) =>
                showCoverPicker
                  ? { ...cur, coverUrl: e.target.value }
                  : { ...cur, backgroundUrl: e.target.value },
              )
            }
          />
          <CoverImagePicker
            value={showCoverPicker ? template.coverUrl : template.backgroundUrl}
            onChange={(url) =>
              setTemplate((cur) =>
                showCoverPicker
                  ? { ...cur, coverUrl: url }
                  : { ...cur, backgroundUrl: url },
              )
            }
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <div className="surface rounded-[28px] p-4">
          <div className="mb-3 text-sm font-medium text-[var(--muted)]">
            手机预览（点选编辑；自由定位可拖动）
          </div>
          <div className="mx-auto w-full max-w-[320px] rounded-[32px] border-[10px] border-slate-800 bg-white shadow-xl">
            <div className="mx-auto mt-2 h-1.5 w-20 rounded-full bg-slate-300" />
            <div
              ref={canvasRef}
              className="relative max-h-[560px] overflow-y-auto overscroll-contain py-2"
              style={{
                minHeight: Math.max(420, absMaxY),
                ...(template.backgroundUrl
                  ? {
                      backgroundImage: `url(${template.backgroundUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center top",
                    }
                  : {}),
              }}
            >
              <div
                className={
                  template.backgroundUrl
                    ? "relative min-h-full bg-white/80"
                    : "relative"
                }
              >
                {template.modules.length === 0 ? (
                  <p className="px-4 py-16 text-center text-sm text-[var(--muted)]">
                    从下方模块库添加内容
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap">
                      {flowModules.map((mod) => (
                        <PreviewModule
                          key={mod.id}
                          module={mod}
                          selected={mod.id === selectedId}
                          onSelect={() => setSelectedId(mod.id)}
                          canvasRef={canvasRef}
                          onDragAbsolute={(id, x, y) =>
                            patchModuleLayout(id, { x, y })
                          }
                        />
                      ))}
                    </div>
                    {absoluteModules.map((mod) => (
                      <PreviewModule
                        key={mod.id}
                        module={mod}
                        selected={mod.id === selectedId}
                        onSelect={() => setSelectedId(mod.id)}
                        canvasRef={canvasRef}
                        onDragAbsolute={(id, x, y) =>
                          patchModuleLayout(id, { x, y })
                        }
                      />
                    ))}
                  </>
                )}
              </div>
            </div>
            <div className="mx-auto my-2 h-1 w-24 rounded-full bg-slate-300" />
          </div>
        </div>

        <div className="surface space-y-4 rounded-[28px] p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-semibold">模板属性</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="text-[var(--muted)]">模板名称</span>
                <input
                  className={`${inputClass} mt-1`}
                  value={template.name}
                  onChange={(e) =>
                    setTemplate((cur) => ({ ...cur, name: e.target.value }))
                  }
                />
              </label>
              {template.type === "custom" ? (
                <label className="block text-sm sm:col-span-2">
                  <span className="text-[var(--muted)]">页面短链 slug</span>
                  <input
                    className={`${inputClass} mt-1`}
                    value={template.slug}
                    onChange={(e) =>
                      setTemplate((cur) => ({
                        ...cur,
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, "-"),
                      }))
                    }
                  />
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    访问路径：/p/{template.slug || "…"}
                  </span>
                </label>
              ) : null}
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={template.isDefault}
                  onChange={(e) =>
                    setTemplate((cur) => ({
                      ...cur,
                      isDefault: e.target.checked,
                    }))
                  }
                />
                设为默认
                {PAGE_TEMPLATE_TYPE_LABEL[template.type]}模板
              </label>
            </div>
          </div>

          <div className="border-t border-[var(--line)] pt-4">
            <h2 className="text-lg font-semibold">
              {selected
                ? `模块：${moduleLabel(selected.type)}`
                : "选择预览中的模块"}
            </h2>
            {selected ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn min-h-10 border border-[var(--line)] bg-white text-sm"
                    onClick={() => moveModule(selected.id, -1)}
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    className="btn min-h-10 border border-[var(--line)] bg-white text-sm"
                    onClick={() => moveModule(selected.id, 1)}
                  >
                    下移
                  </button>
                  <button
                    type="button"
                    className="btn min-h-10 border border-[var(--line)] bg-white text-sm"
                    onClick={() => shiftHorizontal(selected.id, -1)}
                  >
                    左移
                  </button>
                  <button
                    type="button"
                    className="btn min-h-10 border border-[var(--line)] bg-white text-sm"
                    onClick={() => shiftHorizontal(selected.id, 1)}
                  >
                    右移
                  </button>
                  <button
                    type="button"
                    className="btn min-h-10 border border-[var(--brand)]/30 bg-[var(--brand-soft)] text-sm text-[var(--brand)]"
                    onClick={() => toggleAbsolute(selected.id)}
                  >
                    {selectedLayout.mode === "absolute"
                      ? "恢复文档流"
                      : "自由定位"}
                  </button>
                  <button
                    type="button"
                    className="btn min-h-10 border border-[var(--fire)]/30 bg-[var(--fire-soft)] text-sm text-[var(--fire-strong)]"
                    onClick={() => removeModule(selected.id)}
                  >
                    删除模块
                  </button>
                </div>
                {selectedLayout.mode === "absolute" ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="block text-xs">
                      <span className="text-[var(--muted)]">X%</span>
                      <input
                        type="number"
                        className={`${inputClass} mt-1`}
                        value={selectedLayout.x}
                        min={0}
                        max={100}
                        onChange={(e) =>
                          patchModuleLayout(selected.id, {
                            x: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="text-[var(--muted)]">Y px</span>
                      <input
                        type="number"
                        className={`${inputClass} mt-1`}
                        value={selectedLayout.y}
                        min={0}
                        max={4000}
                        onChange={(e) =>
                          patchModuleLayout(selected.id, {
                            y: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="text-[var(--muted)]">宽%</span>
                      <input
                        type="number"
                        className={`${inputClass} mt-1`}
                        value={selectedLayout.width}
                        min={10}
                        max={100}
                        onChange={(e) =>
                          patchModuleLayout(selected.id, {
                            width: Number(e.target.value) || 100,
                          })
                        }
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="text-[var(--muted)]">层级</span>
                      <input
                        type="number"
                        className={`${inputClass} mt-1`}
                        value={selectedLayout.zIndex}
                        min={0}
                        max={100}
                        onChange={(e) =>
                          patchModuleLayout(selected.id, {
                            zIndex: Number(e.target.value) || 1,
                          })
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">
                    文档流：左移/右移切换「全宽 / 左列 / 右列」并排；也可点「自由定位」拖到任意位置。
                  </p>
                )}
                <PropsEditor
                  module={selected}
                  onChange={(next) => {
                    updateModules(
                      template.modules.map((m) =>
                        m.id === next.id ? next : m,
                      ),
                    );
                  }}
                />
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">
                点击左侧预览中的模块，或从下方添加新模块。
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="surface rounded-[28px] p-4 sm:p-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">
            模块库
            <span className="ml-2 text-sm font-normal text-[var(--muted)]">
              {PAGE_MODULE_LIBRARY.length} 种
            </span>
          </h2>
          <input
            className={`${inputClass} sm:max-w-xs`}
            placeholder="搜索模块"
            value={libraryQuery}
            onChange={(e) => setLibraryQuery(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {library.map((item) => (
            <button
              key={item.type}
              type="button"
              className="min-h-[72px] rounded-2xl border border-[var(--line)] bg-white/80 px-2 py-3 text-center transition hover:border-[var(--brand)] active:scale-[0.98]"
              onClick={() => addModule(item.type)}
            >
              <div className="text-sm font-medium">{item.label}</div>
              <div className="mt-1 text-[10px] leading-4 text-[var(--muted)]">
                {item.hint}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

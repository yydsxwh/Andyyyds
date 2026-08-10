"use client";

import { useId, useState, type ReactNode } from "react";

type Props = {
  /** 默认展示（站长场景一般为中文） */
  primary: string;
  /** 悬浮才展示（一般为英文）；空则不启用 */
  secondary?: string;
  className?: string;
  as?: "span" | "div" | "h1" | "h2" | "h3" | "p";
  children?: ReactNode;
};

/**
 * 站长双语：默认只显示主语言，英文在悬浮层（不占导航/卡片宽度）。
 * 同时写 title，手机长按也能看到英文（非仅桌面 hover）。
 */
export function BilingualHover({
  primary,
  secondary,
  className,
  as: Tag = "span",
  children,
}: Props) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const tip = (secondary || "").trim();
  const showTip = Boolean(tip && tip !== primary);

  if (!showTip) {
    return <Tag className={className}>{children ?? primary}</Tag>;
  }

  return (
    <Tag
      className={`relative inline-block max-w-full ${className || ""}`}
      title={tip}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? tipId : undefined}
    >
      <span className="block truncate">{children ?? primary}</span>
      {open ? (
        <span
          id={tipId}
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-50 mt-1 max-w-[min(20rem,80vw)] rounded-xl border border-[var(--line)] bg-white/95 px-2.5 py-1.5 text-left text-xs font-normal leading-snug text-[var(--ink)] shadow-md backdrop-blur-sm"
        >
          {tip}
        </span>
      ) : null}
    </Tag>
  );
}

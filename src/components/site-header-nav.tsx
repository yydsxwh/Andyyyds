"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BilingualHover } from "@/components/i18n/bilingual-hover";
import { useLocale } from "@/components/i18n/locale-provider";
import { typoRoleClass, typoRoleStyle } from "@/lib/site-typography";

export type HeaderNavLink = {
  label: string;
  /** 站长双语：悬浮显示的英文等，不占位 */
  labelSecondary?: string;
  /** 普通链接；有子菜单时可省略 */
  href?: string;
  /** 下拉子级，如「站长管理 → 内容管理」 */
  children?: { href: string; label: string; labelSecondary?: string }[];
};

function NavLabel({
  label,
  secondary,
}: {
  label: string;
  secondary?: string;
}) {
  if (!secondary) return <>{label}</>;
  return <BilingualHover primary={label} secondary={secondary} />;
}

type Props = {
  links: HeaderNavLink[];
  /** desktop=中间列居中菜单；mobile=汉堡（仅窄屏显示） */
  variant?: "desktop" | "mobile";
};

/** 门户默认入口 key：文案走 i18n，避免汉堡菜单空壳 */
const FALLBACK_MOBILE_HREFS = [
  { href: "/", key: "nav.home" },
  { href: "/about/company", key: "nav.company" },
  { href: "/about/person", key: "nav.person" },
  { href: "/courses", key: "nav.courses" },
  { href: "/meetup", key: "nav.meetup" },
  { href: "/shop", key: "nav.shop" },
  { href: "/products", key: "nav.products" },
  { href: "/forum", key: "nav.forum" },
  { href: "/games", key: "nav.games" },
] as const;

function DesktopDropdown({
  label,
  labelSecondary,
  href,
  children,
}: {
  label: string;
  labelSecondary?: string;
  /** 有 href 时标题本身可点进总览（如站长管理 → /studio/admin） */
  href?: string;
  children: { href: string; label: string; labelSecondary?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const titleClass =
    "inline-flex items-center gap-1 whitespace-nowrap hover:text-[var(--ink)]";

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {href ? (
        <Link
          href={href}
          className={titleClass}
          aria-expanded={open}
          onClick={() => setOpen(false)}
        >
          <NavLabel label={label} secondary={labelSecondary} />
          <span
            className="text-xs opacity-70"
            aria-hidden
            onClick={(e) => {
              // 触控/窄屏无 hover：点箭头展开子菜单，不跟标题一起跳转
              e.preventDefault();
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            ▾
          </span>
        </Link>
      ) : (
        <button
          type="button"
          className={titleClass}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <NavLabel label={label} secondary={labelSecondary} />
          <span className="text-xs opacity-70" aria-hidden>
            ▾
          </span>
        </button>
      )}
      {open ? (
        <div className="absolute left-0 top-full z-50 min-w-[9.5rem] pt-2">
          <div className="glass-panel rounded-[var(--control-radius)] py-1.5">
            {children.map((child) => (
              <Link
                key={child.href + child.label}
                href={child.href}
                className="block min-h-11 whitespace-nowrap px-3.5 py-2.5 text-[var(--ink)] active:bg-[var(--bg-deep)]/60"
                onClick={() => setOpen(false)}
              >
                <NavLabel
                  label={child.label}
                  secondary={child.labelSecondary}
                />
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DesktopNav({ links }: { links: HeaderNavLink[] }) {
  return (
    <nav
      className={`flex max-w-full items-center justify-center overflow-x-auto text-[var(--muted)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${typoRoleClass("nav")}`}
      aria-label="主导航"
      style={typoRoleStyle("nav")}
    >
      {/* 单行横向滚动，避免换行溢出盖住页面主按钮 */}
      <div className="flex flex-nowrap items-center justify-center gap-x-5 xl:gap-x-7">
        {links.map((link) =>
          link.children?.length ? (
            <DesktopDropdown
              key={`dd-${link.label}`}
              label={link.label}
              labelSecondary={link.labelSecondary}
              href={link.href}
              children={link.children}
            />
          ) : link.href ? (
            <Link
              key={link.href + link.label}
              href={link.href}
              className="whitespace-nowrap hover:text-[var(--ink)]"
            >
              <NavLabel
                label={link.label}
                secondary={link.labelSecondary}
              />
            </Link>
          ) : null,
        )}
      </div>
    </nav>
  );
}

/**
 * 手机/微信汉堡菜单：挂到 body 的全屏抽屉。
 * 不用 CSS min()/复杂 inset 组合——部分微信 X5 会解析失败导致面板塌成一条「导航菜单」空壳。
 */
function MobileNav({ links }: { links: HeaderNavLink[] }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileOpenKey, setMobileOpenKey] = useState<string | null>(null);
  const panelId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const fallbackLinks: HeaderNavLink[] = FALLBACK_MOBILE_HREFS.map((item) => ({
    href: item.href,
    label: t(item.key),
  }));
  const menuLinks =
    links.filter((l) => l.href || (l.children && l.children.length > 0))
      .length > 0
      ? links
      : fallbackLinks;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    closeBtnRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const drawer =
    open && mounted
      ? createPortal(
          <div
            className="site-mobile-nav-root"
            role="presentation"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 10060,
            }}
          >
            <button
              type="button"
              aria-label="关闭菜单遮罩"
              onClick={() => setOpen(false)}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                border: 0,
                margin: 0,
                padding: 0,
                background: "rgba(0,0,0,0.45)",
              }}
            />
            <aside
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label="站点导航"
              className="glass-drawer"
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                width: "85%",
                maxWidth: "20rem",
                display: "flex",
                flexDirection: "column",
                /* 定位/安全区保持 inline：部分微信 X5 对复杂 CSS inset 组合不稳 */
                paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
                paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
                paddingRight: "max(0.5rem, env(safe-area-inset-right, 0px))",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  padding: "0 0.75rem 0.75rem",
                  borderBottom: "1px solid var(--line)",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--muted)",
                  }}
                >
                  门户入口
                </span>
                <button
                  ref={closeBtnRef}
                  type="button"
                  aria-label="关闭菜单"
                  onClick={() => setOpen(false)}
                  className="btn btn-secondary btn-compact !h-11 !w-11 !rounded-full !px-0"
                  style={{
                    fontSize: "1.25rem",
                  }}
                >
                  ×
                </button>
              </div>
              <nav
                aria-label="门户导航"
                className={typoRoleClass("nav")}
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  WebkitOverflowScrolling: "touch",
                  padding: "0.5rem",
                  color: "var(--ink)",
                  ...typoRoleStyle("nav"),
                }}
              >
                {menuLinks.map((link) => {
                  if (link.children?.length) {
                    const key = `m-${link.label}`;
                    const expanded = mobileOpenKey === key;
                    return (
                      <div key={key}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "stretch",
                            gap: "0.25rem",
                          }}
                        >
                          {link.href ? (
                            <Link
                              href={link.href}
                              onClick={() => setOpen(false)}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                borderRadius: "0.75rem",
                                padding: "0.85rem 0.75rem",
                                color: "var(--ink)",
                                fontWeight: 600,
                              }}
                            >
                              <NavLabel
                                label={link.label}
                                secondary={link.labelSecondary}
                              />
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setMobileOpenKey(expanded ? null : key)
                              }
                              style={{
                                flex: 1,
                                minWidth: 0,
                                border: 0,
                                background: "transparent",
                                borderRadius: "0.75rem",
                                padding: "0.85rem 0.75rem",
                                textAlign: "left",
                                color: "var(--ink)",
                                fontWeight: 600,
                                font: "inherit",
                              }}
                            >
                              <NavLabel
                                label={link.label}
                                secondary={link.labelSecondary}
                              />
                            </button>
                          )}
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-label={
                              expanded
                                ? `收起${link.label}`
                                : `展开${link.label}`
                            }
                            onClick={() =>
                              setMobileOpenKey(expanded ? null : key)
                            }
                            style={{
                              flexShrink: 0,
                              border: 0,
                              background: "transparent",
                              borderRadius: "0.75rem",
                              padding: "0.85rem 0.75rem",
                              color: "var(--muted)",
                              font: "inherit",
                            }}
                          >
                            {expanded ? "▴" : "▾"}
                          </button>
                        </div>
                        {expanded ? (
                          <div
                            style={{
                              margin: "0 0 0.25rem 0.75rem",
                              paddingLeft: "0.5rem",
                              borderLeft: "1px solid var(--line)",
                              display: "flex",
                              flexDirection: "column",
                            }}
                          >
                            {link.children.map((child) => (
                              <Link
                                key={child.href + child.label}
                                href={child.href}
                                onClick={() => setOpen(false)}
                                style={{
                                  borderRadius: "0.75rem",
                                  padding: "0.7rem 0.75rem",
                                  color: "var(--ink)",
                                }}
                              >
                                <NavLabel
                                  label={child.label}
                                  secondary={child.labelSecondary}
                                />
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  }
                  if (!link.href) return null;
                  return (
                    <Link
                      key={link.href + link.label}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      style={{
                        display: "block",
                        borderRadius: "0.75rem",
                        padding: "0.85rem 0.75rem",
                        color: "var(--ink)",
                        fontWeight: 600,
                      }}
                    >
                      <NavLabel
                        label={link.label}
                        secondary={link.labelSecondary}
                      />
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="btn btn-secondary btn-compact inline-flex h-11 w-11 shrink-0 items-center justify-center !rounded-full !px-0 text-[var(--ink)]"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "关闭菜单" : "打开菜单"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sr-only">{open ? "关闭菜单" : "打开菜单"}</span>
        <span className="flex flex-col gap-1.5" aria-hidden>
          <span
            className={`block h-0.5 w-4 origin-center bg-current transition ${
              open ? "translate-y-2 rotate-45" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-4 bg-current transition ${
              open ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-4 origin-center bg-current transition ${
              open ? "-translate-y-2 -rotate-45" : ""
            }`}
          />
        </span>
      </button>
      {drawer}
    </div>
  );
}

export function SiteHeaderNav({ links, variant = "desktop" }: Props) {
  if (variant === "mobile") {
    return <MobileNav links={links} />;
  }
  return <DesktopNav links={links} />;
}

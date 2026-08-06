"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type HeaderNavLink = {
  label: string;
  /** 普通链接；有子菜单时可省略 */
  href?: string;
  /** 下拉子级，如「站长管理 → 内容管理」 */
  children?: { href: string; label: string }[];
};

type Props = {
  links: HeaderNavLink[];
};

function DesktopDropdown({
  label,
  href,
  children,
}: {
  label: string;
  /** 有 href 时标题本身可点进总览（如站长管理 → /studio/admin） */
  href?: string;
  children: { href: string; label: string }[];
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
          {label}
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
          {label}
          <span className="text-xs opacity-70" aria-hidden>
            ▾
          </span>
        </button>
      )}
      {open ? (
        <div className="absolute left-0 top-full z-50 min-w-[9.5rem] pt-2">
          <div className="rounded-2xl border border-[var(--line)] bg-white/98 py-1.5 shadow-lg backdrop-blur-md">
            {children.map((child) => (
              <Link
                key={child.href + child.label}
                href={child.href}
                className="block whitespace-nowrap px-3.5 py-2.5 text-[var(--ink)] hover:bg-[var(--bg-deep)]/50"
                onClick={() => setOpen(false)}
              >
                {child.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SiteHeaderNav({ links }: Props) {
  const [open, setOpen] = useState(false);
  const [mobileOpenKey, setMobileOpenKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/*
        相对顶栏整条水平居中：pointer-events 仅落在链接上，避免挡住左右品牌/账号点击。
        字号读 --fs-nav（站长可在网站装扮里调）。
      */}
      <nav
        className="pointer-events-none absolute inset-x-0 top-1/2 z-0 hidden -translate-y-1/2 justify-center lg:flex"
        aria-label="主导航"
      >
        <div
          className="pointer-events-auto flex max-w-[min(100%,56rem)] flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[var(--muted)] xl:gap-x-7"
          style={{ fontSize: "var(--fs-nav)" }}
        >
          {links.map((link) =>
            link.children?.length ? (
              <DesktopDropdown
                key={`dd-${link.label}`}
                label={link.label}
                href={link.href}
                children={link.children}
              />
            ) : link.href ? (
              <Link
                key={link.href + link.label}
                href={link.href}
                className="whitespace-nowrap hover:text-[var(--ink)]"
              >
                {link.label}
              </Link>
            ) : null,
          )}
        </div>
      </nav>

      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white/70 text-[var(--ink)] lg:hidden"
        aria-expanded={open}
        aria-label={open ? "关闭菜单" : "打开菜单"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sr-only">{open ? "关闭菜单" : "打开菜单"}</span>
        <span className="flex flex-col gap-1.5" aria-hidden>
          <span
            className={`block h-0.5 w-4 bg-current transition ${open ? "translate-y-2 rotate-45" : ""}`}
          />
          <span className={`block h-0.5 w-4 bg-current transition ${open ? "opacity-0" : ""}`} />
          <span
            className={`block h-0.5 w-4 bg-current transition ${open ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </span>
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full z-50 border-b border-[var(--line)] bg-white/97 px-3 py-3 shadow-lg backdrop-blur-md lg:hidden">
          <nav
            className="flex flex-col gap-1"
            style={{ fontSize: "var(--fs-nav)" }}
          >
            {links.map((link) => {
              if (link.children?.length) {
                const key = `m-${link.label}`;
                const expanded = mobileOpenKey === key;
                return (
                  <div key={key}>
                    <div className="flex items-stretch gap-1">
                      {link.href ? (
                        <Link
                          href={link.href}
                          className="min-w-0 flex-1 rounded-xl px-3 py-3 text-[var(--ink)] hover:bg-white/70"
                          onClick={() => setOpen(false)}
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="min-w-0 flex-1 rounded-xl px-3 py-3 text-left text-[var(--ink)] hover:bg-white/70"
                          onClick={() => setMobileOpenKey(expanded ? null : key)}
                        >
                          {link.label}
                        </button>
                      )}
                      <button
                        type="button"
                        className="shrink-0 rounded-xl px-3 py-3 text-[var(--muted)] hover:bg-white/70"
                        style={{ fontSize: "0.875em" }}
                        aria-expanded={expanded}
                        aria-label={expanded ? `收起${link.label}` : `展开${link.label}`}
                        onClick={() => setMobileOpenKey(expanded ? null : key)}
                      >
                        {expanded ? "▴" : "▾"}
                      </button>
                    </div>
                    {expanded ? (
                      <div className="mb-1 ml-3 flex flex-col border-l border-[var(--line)] pl-2">
                        {link.children.map((child) => (
                          <Link
                            key={child.href + child.label}
                            href={child.href}
                            className="rounded-xl px-3 py-2.5 text-[var(--ink)] hover:bg-white/70"
                            onClick={() => setOpen(false)}
                          >
                            {child.label}
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
                  className="rounded-xl px-3 py-3 text-[var(--ink)] hover:bg-white/70"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </>
  );
}

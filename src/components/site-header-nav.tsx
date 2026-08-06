"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type HeaderNavLink = {
  href: string;
  label: string;
};

type Props = {
  links: HeaderNavLink[];
};

export function SiteHeaderNav({ links }: Props) {
  const [open, setOpen] = useState(false);

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
      <nav className="hidden items-center gap-6 text-sm text-[var(--muted)] md:flex">
        {links.map((link) => (
          <Link key={link.href + link.label} href={link.href} className="hover:text-[var(--ink)]">
            {link.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-white/70 text-[var(--ink)] md:hidden"
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
        <div className="absolute inset-x-0 top-16 z-50 border-b border-[var(--line)] bg-[rgba(247,243,235,0.97)] px-4 py-3 shadow-lg backdrop-blur-md md:hidden">
          <nav className="container flex flex-col gap-1 text-sm">
            {links.map((link) => (
              <Link
                key={link.href + link.label}
                href={link.href}
                className="rounded-xl px-3 py-3 text-[var(--ink)] hover:bg-white/70"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </>
  );
}

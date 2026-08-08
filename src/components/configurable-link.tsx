import Link from "next/link";

/**
 * 站长可配跳转外壳：有 href 才可点；无链接时原样渲染子节点（兼容旧配置）。
 * 新标签必须带 rel，避免微信/浏览器 opener 风险。
 */

export function normalizeLinkHref(href: string | null | undefined): string {
  return (href || "").trim();
}

export function isExternalHref(href: string): boolean {
  return /^(https?:)?\/\//i.test(href) || /^(mailto|tel):/i.test(href);
}

type Props = {
  href?: string | null;
  /** true 时新标签打开；false/未传则同页（外链仍用 <a>） */
  openInNewTab?: boolean;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
};

export function ConfigurableLink({
  href,
  openInNewTab = false,
  className,
  children,
  ariaLabel,
}: Props) {
  const trimmed = normalizeLinkHref(href);
  if (!trimmed) {
    // 无链接时仍挂上 className，避免主图圆角/surface 等外壳样式丢失
    if (className) {
      return <div className={className}>{children}</div>;
    }
    return <>{children}</>;
  }

  if (openInNewTab) {
    return (
      <a
        href={trimmed}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </a>
    );
  }

  if (isExternalHref(trimmed)) {
    return (
      <a href={trimmed} className={className} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }

  return (
    <Link href={trimmed} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}

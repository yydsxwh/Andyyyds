"use client";

import Link from "next/link";

type Props = {
  imageUrl: string;
  href: string;
  alt: string;
};

/** 高校分区页顶栏广告；无图时仍留出广告位，方便运营投放 */
export function ForumAdBanner({ imageUrl, href, alt }: Props) {
  const inner = imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={alt || "广告"}
      className="h-28 w-full rounded-[24px] object-cover sm:h-36"
    />
  ) : (
    <div className="flex h-24 w-full items-center justify-center rounded-[24px] border border-dashed border-[var(--line)] bg-[var(--brand)]/5 text-sm text-[var(--muted)] sm:h-28">
      广告栏
    </div>
  );

  if (href) {
    const external = href.startsWith("http");
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="block min-h-11"
        >
          {inner}
        </a>
      );
    }
    return (
      <Link href={href} className="block min-h-11">
        {inner}
      </Link>
    );
  }
  return inner;
}

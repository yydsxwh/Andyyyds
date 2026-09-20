"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { nextFromCurrentLocation } from "@andyyyds/shared/safe-next-path";

type Props = {
  loginLabel: string;
  registerLabel: string;
  loginClassName: string;
  registerClassName: string;
  loginStyle?: CSSProperties;
  registerStyle?: CSSProperties;
};

/**
 * 顶栏登录/注册带上当前页 next，登录成功后回到原页面，而不是固定个人中心。
 */
export function AuthEntryLinks({
  loginLabel,
  registerLabel,
  loginClassName,
  registerClassName,
  loginStyle,
  registerStyle,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const next = nextFromCurrentLocation(
    pathname,
    searchParams.toString() ? `?${searchParams.toString()}` : "",
  );
  const suffix = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <>
      <Link href={`/login${suffix}`} className={loginClassName} style={loginStyle}>
        {loginLabel}
      </Link>
      <Link
        href={`/register${suffix}`}
        className={registerClassName}
        style={registerStyle}
      >
        {registerLabel}
      </Link>
    </>
  );
}

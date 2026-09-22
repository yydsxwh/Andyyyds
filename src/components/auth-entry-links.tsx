"use client";

import type { CSSProperties } from "react";
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
  const loginParams = new URLSearchParams({ mode: "login", next });
  const registerParams = new URLSearchParams({ mode: "register", next });

  return (
    <>
      {/*
       * Authentication is a top-level cross-origin OIDC navigation. Use a
       * native anchor instead of a Next client transition so iOS Safari does
       * not have to complete /login hydration before following the redirect.
       */}
      <a
        href={`/api/auth/account/start?${loginParams.toString()}`}
        className={loginClassName}
        style={loginStyle}
      >
        {loginLabel}
      </a>
      <a
        href={`/api/auth/account/start?${registerParams.toString()}`}
        className={registerClassName}
        style={registerStyle}
      >
        {registerLabel}
      </a>
    </>
  );
}

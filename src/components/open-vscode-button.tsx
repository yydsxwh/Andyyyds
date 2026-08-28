"use client";

/**
 * 产品页「打开 VS Code」：有桌面客户端则走 vscode://，否则再打开网页版。
 */

import { openVsCodeApp } from "@/lib/mathcode-open";

export function OpenVsCodeButton({
  className,
  children = "打开 VS Code",
}: {
  className: string;
  children?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        void openVsCodeApp();
      }}
    >
      {children}
    </button>
  );
}

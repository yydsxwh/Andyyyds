"use client";

import { useEffect } from "react";

const RETRY_KEY = "yyds-global-error-retry";

/**
 * 根布局出错时的整页提示。
 * 安卓弱网下 RSC 流被截断会落到这里，文案是 “This page couldn’t load”。
 * 同一标签页 15 秒内只自动刷新一次，避免确定性错误死循环。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      const last = Number(sessionStorage.getItem(RETRY_KEY) || 0);
      if (!last || Date.now() - last > 15_000) {
        sessionStorage.setItem(RETRY_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      /* 隐私模式读不到 sessionStorage 时，留给下面的按钮 */
    }
  }, []);

  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: 'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
          background: "#fff",
          color: "#171717",
        }}
      >
        <div style={{ maxWidth: 360, padding: "32px 28px" }}>
          <h1 style={{ fontSize: 24, fontWeight: 500, margin: "0 0 12px" }}>
            页面没有打开
          </h1>
          <p style={{ fontSize: 14, lineHeight: "21px", margin: "0 0 20px" }}>
            可以再试一次。如果仍停在这里，换个网络后再打开。
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                height: 32,
                padding: "0 12px",
                borderRadius: 6,
                border: "none",
                background: "#171717",
                color: "#fff",
                fontSize: 14,
              }}
            >
              重新加载
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) window.history.back();
                else window.location.href = "/";
              }}
              style={{
                height: 32,
                padding: "0 12px",
                borderRadius: 6,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "transparent",
                color: "#171717",
                fontSize: 14,
              }}
            >
              返回
            </button>
          </div>
          {error.digest ? (
            <p
              style={{
                marginTop: 24,
                fontFamily: "ui-monospace,monospace",
                fontSize: 12,
                color: "#666",
              }}
            >
              {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}

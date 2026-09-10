"use client";

import { useEffect } from "react";

/**
 * 按需注入站长选中的字体 CSS（CDN link），不打进 JS bundle。
 * 同一 href 只插一次，避免试穿反复挂载。
 */
export function SiteFontLoader({ urls }: { urls: string[] }) {
  const key = urls.join("|");
  useEffect(() => {
    for (const href of urls) {
      if (!href) continue;
      const nodes = document.querySelectorAll<HTMLLinkElement>(
        'link[data-site-font="1"]',
      );
      let exists = false;
      nodes.forEach((node) => {
        if (node.href === href || node.getAttribute("href") === href) {
          exists = true;
        }
      });
      if (exists) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.setAttribute("data-site-font", "1");
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }
  }, [key, urls]);

  return null;
}

/** SSR：预挂 link，首屏即可开始拉字体 */
export function SiteFontLinks({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <>
      {urls.map((href) => (
        <link
          key={href}
          rel="stylesheet"
          href={href}
          crossOrigin="anonymous"
          data-site-font="1"
        />
      ))}
    </>
  );
}

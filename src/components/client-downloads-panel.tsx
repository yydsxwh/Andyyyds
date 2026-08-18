/**
 * 首页「客户端下载」入口：放在联系我们右侧偏中上。
 * Android 已有 APK；Windows / iOS / Mac / 鸿蒙先占位，避免以后改布局。
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";

type ClientSlot = {
  id: string;
  label: string;
  hint: string;
  href?: string;
  available: boolean;
};

function androidApkReady() {
  try {
    return existsSync(path.join(process.cwd(), "public", "app", "yyds.apk"));
  } catch {
    return false;
  }
}

function buildSlots(): ClientSlot[] {
  const apkOk = androidApkReady();
  return [
    {
      id: "android",
      label: "安卓",
      hint: apkOk ? "手机 App" : "准备中",
      href: apkOk ? "/app" : undefined,
      available: apkOk,
    },
    {
      id: "windows",
      label: "Windows",
      hint: "电脑客户端 · 即将推出",
      available: false,
    },
    {
      id: "ios",
      label: "苹果手机",
      hint: "即将推出",
      available: false,
    },
    {
      id: "mac",
      label: "Mac",
      hint: "即将推出",
      available: false,
    },
    {
      id: "harmony",
      label: "鸿蒙",
      hint: "即将推出",
      available: false,
    },
  ];
}

export function ClientDownloadsPanel() {
  const slots = buildSlots();

  return (
    <aside
      aria-label="客户端下载"
      className="surface w-full max-w-md space-y-3 rounded-[24px] p-4 sm:max-w-sm sm:p-5"
    >
      <div>
        <h2 className="text-base font-semibold text-[var(--ink)] sm:text-lg">
          客户端下载
        </h2>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          手机与电脑端入口；未上线平台已预留位置。
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {slots.map((slot) => {
          const className =
            "flex min-h-14 flex-col items-start justify-center rounded-2xl border border-[var(--line)] px-3 py-2 text-left transition";
          if (slot.available && slot.href) {
            return (
              <li key={slot.id}>
                <Link
                  href={slot.href}
                  className={`${className} bg-white/50 text-[var(--ink)] hover:border-[var(--brand)] hover:text-[var(--brand)]`}
                >
                  <span className="text-sm font-semibold">{slot.label}</span>
                  <span className="text-[11px] text-[var(--muted)]">
                    {slot.hint}
                  </span>
                </Link>
              </li>
            );
          }
          return (
            <li key={slot.id}>
              <div
                className={`${className} cursor-not-allowed bg-[var(--bg-deep)]/40 text-[var(--muted)] opacity-80`}
                aria-disabled="true"
              >
                <span className="text-sm font-medium">{slot.label}</span>
                <span className="text-[11px]">{slot.hint}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

/** 联系我们 + 客户端下载：大屏左右并排，贴近页顶中部 */
export function HomeContactAndDownloads({
  contactPanel,
}: {
  contactPanel: ReactNode;
}) {
  return (
    <div className="flex w-full max-w-6xl flex-col gap-4 px-3 sm:px-5 lg:flex-row lg:items-start lg:justify-between lg:gap-6 lg:px-8">
      <div className="min-w-0 shrink-0 lg:max-w-sm">{contactPanel}</div>
      <div className="min-w-0 lg:ml-auto">
        <ClientDownloadsPanel />
      </div>
    </div>
  );
}

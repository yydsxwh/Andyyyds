/**
 * 安装包下载兼容适配层。
 *
 * 现状是安装包文件名写死在代码里（yyds.apk / yyds-windows-setup.exe），
 * 发新版要回来改代码。切到 platform Releases 后，版本与文件名由发版流程登记，
 * 站点只问「这个端的最新稳定版下载地址是什么」。
 *
 * 旧的按文件名下载入口保留：把文件名映射到端与架构，URL 不变，
 * 用户收藏的链接与安卓端内的更新逻辑都不受影响。
 */

import type { ProductPlatform } from "@yydsxwh/shared/contracts/catalog";
import { PlatformApiError } from "@yydsxwh/shared/platform-client/index";

import { getPlatformClient } from "./platform-storage";

/** 主站自有客户端在 Releases 里的产品键 */
export const SITE_APP_RELEASE_PRODUCT_KEY =
  process.env.PLATFORM_SITE_APP_PRODUCT_KEY?.trim() || "yyds-app";

/** 历史安装包文件名 → 端；仅用于兼容旧下载入口 */
const LEGACY_INSTALLER_PLATFORM: Record<string, ProductPlatform> = {
  "yyds.apk": "ANDROID",
  "yyds-windows-setup.exe": "WINDOWS",
  "yyds-windows.exe": "WINDOWS",
  "yyds-windows.zip": "WINDOWS",
};

export function platformReleasesEnabled(): boolean {
  if (process.env.PLATFORM_RELEASES_ENABLED !== "true") return false;
  return getPlatformClient() !== null;
}

export function legacyInstallerPlatform(fileName: string): ProductPlatform | null {
  return LEGACY_INSTALLER_PLATFORM[fileName] ?? null;
}

/**
 * 取某端最新稳定版的下载地址。
 * 未启用、没有已发布版本或 platform 不可达时返回 null，调用方回落到原有逻辑。
 */
export async function getLatestReleaseDownloadUrl(input: {
  platform: ProductPlatform;
  productKey?: string;
}): Promise<string | null> {
  if (!platformReleasesEnabled()) return null;
  const client = getPlatformClient();
  if (!client) return null;
  try {
    const result = await client.releases.createDownload({
      productKey: input.productKey || SITE_APP_RELEASE_PRODUCT_KEY,
      platform: input.platform,
      version: "latest",
    });
    return result.url;
  } catch (error) {
    // 还没发过版属正常情况，不值得报错刷屏
    if (error instanceof PlatformApiError && error.code === "NOT_FOUND") return null;
    console.error(
      `[platform-releases] 取下载地址失败：${(error as Error)?.message}`,
    );
    return null;
  }
}

/** 旧下载入口：按文件名找对应端的最新稳定版 */
export async function getLegacyInstallerDownloadUrl(
  fileName: string,
): Promise<string | null> {
  const target = legacyInstallerPlatform(fileName);
  if (!target) return null;
  return getLatestReleaseDownloadUrl({ platform: target });
}

/** 某端是否已有可下载的稳定版，用于前台决定露不露下载入口 */
export async function hasPublishedRelease(
  platform: ProductPlatform,
  productKey?: string,
): Promise<boolean> {
  if (!platformReleasesEnabled()) return false;
  const client = getPlatformClient();
  if (!client) return false;
  try {
    const release = await client.releases.getLatest(
      productKey || SITE_APP_RELEASE_PRODUCT_KEY,
      { platform },
    );
    return release !== null;
  } catch {
    return false;
  }
}

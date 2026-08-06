import { prisma } from "./db";
import { parseDecorate, type DecorateConfig } from "./decorate";
import { parseOrderForm, type OrderFormConfig } from "./order-form";
import { parseStudioNav, type StudioNavConfig } from "./studio-nav-config";
import { parseUiCopy, type UiCopy } from "./ui-copy";

export type StorageProvider = "LOCAL" | "ALIYUN_OSS";
export type VideoStorageProvider = "LOCAL" | "ALIYUN_VOD";
export type PaymentModeSetting = "auto" | "mock" | "wechat" | "alipay" | "both";

export type SiteSettingsRow = {
  id: string;
  siteUrl: string;
  paymentMode: string;
  wechatEnabled: boolean;
  alipayEnabled: boolean;
  wechatAppId: string;
  wechatMchId: string;
  wechatApiV3Key: string;
  wechatMchSerialNo: string;
  wechatMchPrivateKey: string;
  alipayAppId: string;
  alipayPrivateKey: string;
  alipayPublicKey: string;
  alipayGateway: string;
  storageProvider: string;
  ossRegion: string;
  ossBucket: string;
  ossAccessKeyId: string;
  ossAccessKeySecret: string;
  ossEndpoint: string;
  ossPublicBaseUrl: string;
  ossPrefix: string;
  videoStorageProvider: string;
  vodRegionId: string;
  vodAccessKeyId: string;
  vodAccessKeySecret: string;
  vodTemplateGroupId: string;
  vodPlayDomain: string;
  uiCopyJson: string;
  orderFormJson: string;
  decorateJson: string;
  studioNavJson: string;
  updatedAt: Date;
};

let cache: { at: number; row: SiteSettingsRow } | null = null;
const CACHE_MS = 5000;

export function invalidateSiteSettingsCache() {
  cache = null;
}

export async function getSiteSettings(): Promise<SiteSettingsRow> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.row;
  }
  const row = await prisma.siteSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  cache = { at: Date.now(), row };
  return row;
}

export async function getUiCopy(): Promise<UiCopy> {
  const row = await getSiteSettings();
  return parseUiCopy(row.uiCopyJson);
}

export async function getOrderFormConfig(): Promise<OrderFormConfig> {
  const row = await getSiteSettings();
  return parseOrderForm(row.orderFormJson);
}

export async function getDecorateConfig(): Promise<DecorateConfig> {
  const row = await getSiteSettings();
  return parseDecorate(row.decorateJson);
}

export async function getStudioNavConfig(): Promise<StudioNavConfig> {
  const row = await getSiteSettings();
  return parseStudioNav(row.studioNavJson);
}

export function maskSecret(value: string, keep = 4) {
  if (!value) return "";
  if (value.length <= keep) return "*".repeat(value.length);
  return `${"*".repeat(Math.min(12, value.length - keep))}${value.slice(-keep)}`;
}

export function isMaskedPlaceholder(value: string | undefined) {
  if (!value) return true;
  return /^\*+[^*]{0,8}$/.test(value) || value === "(unchanged)";
}

export function publicSiteSettings(row: SiteSettingsRow) {
  return {
    siteUrl: row.siteUrl,
    paymentMode: row.paymentMode,
    wechatEnabled: row.wechatEnabled,
    alipayEnabled: row.alipayEnabled,
    wechatAppId: row.wechatAppId,
    wechatMchId: row.wechatMchId,
    wechatApiV3Key: maskSecret(row.wechatApiV3Key),
    wechatMchSerialNo: row.wechatMchSerialNo,
    wechatMchPrivateKey: row.wechatMchPrivateKey ? maskSecret(row.wechatMchPrivateKey, 8) : "",
    wechatConfigured: Boolean(
      row.wechatAppId &&
        row.wechatMchId &&
        row.wechatApiV3Key &&
        row.wechatMchSerialNo &&
        row.wechatMchPrivateKey,
    ),
    alipayAppId: row.alipayAppId,
    alipayPrivateKey: row.alipayPrivateKey ? maskSecret(row.alipayPrivateKey, 8) : "",
    alipayPublicKey: row.alipayPublicKey ? maskSecret(row.alipayPublicKey, 8) : "",
    alipayGateway: row.alipayGateway || "production",
    alipayConfigured: Boolean(
      row.alipayAppId && row.alipayPrivateKey && row.alipayPublicKey,
    ),
    storageProvider: (row.storageProvider || "LOCAL") as StorageProvider,
    ossRegion: row.ossRegion,
    ossBucket: row.ossBucket,
    ossAccessKeyId: row.ossAccessKeyId,
    ossAccessKeySecret: row.ossAccessKeySecret
      ? maskSecret(row.ossAccessKeySecret)
      : "",
    ossEndpoint: row.ossEndpoint,
    ossPublicBaseUrl: row.ossPublicBaseUrl,
    ossPrefix: row.ossPrefix || "uploads",
    ossConfigured: Boolean(
      row.ossRegion &&
        row.ossBucket &&
        row.ossAccessKeyId &&
        row.ossAccessKeySecret,
    ),
    videoStorageProvider: (row.videoStorageProvider ||
      "LOCAL") as VideoStorageProvider,
    vodRegionId: row.vodRegionId || "cn-shanghai",
    vodAccessKeyId: row.vodAccessKeyId,
    vodAccessKeySecret: row.vodAccessKeySecret
      ? maskSecret(row.vodAccessKeySecret)
      : "",
    vodTemplateGroupId: row.vodTemplateGroupId || "VOD_NO_TRANSCODE",
    vodPlayDomain: row.vodPlayDomain || "",
    vodConfigured: Boolean(
      row.vodAccessKeyId?.trim() && row.vodAccessKeySecret?.trim(),
    ),
    uiCopy: parseUiCopy(row.uiCopyJson),
    orderForm: parseOrderForm(row.orderFormJson),
    decorate: parseDecorate(row.decorateJson),
    studioNav: parseStudioNav(row.studioNavJson),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function pickSecretUpdate(
  incoming: string | undefined,
  current: string,
): string | undefined {
  if (incoming === undefined) return undefined;
  const trimmed = incoming.trim();
  if (!trimmed || isMaskedPlaceholder(trimmed)) return undefined;
  return trimmed.replace(/\\n/g, "\n");
}

/**
 * 站点级配置读写（系统设置 / 支付 / OSS / VOD / CMS 导航等）
 *
 * 敏感字段对外展示时会 maskSecret 打码；保存接口若收到打码占位符应视为「不修改」。
 * 支付相关字段被 payments.ts / wechat-pay.ts / alipay.ts 读取。
 */

import { prisma } from "./db";
import { parseDecorate, type DecorateConfig } from "./decorate";
import {
  parseEnabledLocalesJson,
  type AppLocale,
} from "./i18n/locales";
import { parseOrderForm, type OrderFormConfig } from "./order-form";
import {
  parsePageTemplates,
  type PageTemplatesConfig,
} from "./page-templates";
import { parsePortal, type PortalConfig } from "./portal";
import { parseStudioNav, type StudioNavConfig } from "./studio-nav-config";
import { parseUiCopy, type UiCopy } from "./ui-copy";
import {
  activeBgMusicTracks,
  parseBgMusic,
  type BgMusicConfig,
} from "./bg-music";

function parseEnabledLocalesJsonSafe(raw: string | null | undefined): AppLocale[] {
  return parseEnabledLocalesJson(raw);
}

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
  wechatAppSecret: string;
  wechatWebAppId: string;
  wechatWebAppSecret: string;
  /** 开放平台「移动应用」AppID（Android Capacitor 微信快捷登录） */
  wechatMobileAppId: string;
  wechatMobileAppSecret: string;
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
  pageTemplatesJson: string;
  studioNavJson: string;
  portalJson: string;
  merchantPlatformCutPercent: number;
  agentShareOfPlatformCutPercent: number;
  agentBuyerOrderPercent: number;
  teacherDistributionPercent: number;
  userDistributionPercent: number;
  hideAllPrices: boolean;
  hideSocialChat: boolean;
  defaultLocale: string;
  enabledLocalesJson: string;
  translateApiBaseUrl: string;
  translateApiKey: string;
  translateApiModel: string;
  smsEnabled: boolean;
  smsProvider: string;
  smsAccessKeyId: string;
  smsAccessKeySecret: string;
  smsSignName: string;
  smsTemplateCode: string;
  smsTestMode: boolean;
  smsTestFixedCode: string;
  bgMusicJson: string;
  jamendoClientId: string;
  forumJson: string;
  personSocialJson: string;
  amapWebKey: string;
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
  // 兼容迁移前后旧进程：缺字段时补默认，避免读配置崩溃
  const normalized = {
    ...row,
    wechatMobileAppId:
      (row as { wechatMobileAppId?: string }).wechatMobileAppId || "",
    wechatMobileAppSecret:
      (row as { wechatMobileAppSecret?: string }).wechatMobileAppSecret || "",
    defaultLocale:
      (row as { defaultLocale?: string }).defaultLocale || "zh-Hans",
    enabledLocalesJson:
      (row as { enabledLocalesJson?: string }).enabledLocalesJson || "",
    translateApiBaseUrl:
      (row as { translateApiBaseUrl?: string }).translateApiBaseUrl || "",
    translateApiKey:
      (row as { translateApiKey?: string }).translateApiKey || "",
    translateApiModel:
      (row as { translateApiModel?: string }).translateApiModel ||
      "gpt-4o-mini",
    bgMusicJson: (row as { bgMusicJson?: string }).bgMusicJson || "",
    jamendoClientId:
      (row as { jamendoClientId?: string }).jamendoClientId || "",
    forumJson: (row as { forumJson?: string }).forumJson || "",
    personSocialJson:
      (row as { personSocialJson?: string }).personSocialJson || "",
    amapWebKey: (row as { amapWebKey?: string }).amapWebKey || "",
  } as SiteSettingsRow;
  cache = { at: Date.now(), row: normalized };
  return normalized;
}

/** 全站藏价开关；仅服务端调用（勿从客户端组件 import 本模块） */
export async function getHideAllPricesFlag(): Promise<boolean> {
  const row = await getSiteSettings();
  return Boolean(row.hideAllPrices);
}

/** 隐藏社交私聊/群聊前台；产品咨询私信不受影响 */
export async function getHideSocialChatFlag(): Promise<boolean> {
  const row = await getSiteSettings();
  return Boolean(row.hideSocialChat);
}

/** 全站背景音乐配置（含未启用曲目，供后台编辑） */
export async function getBgMusicConfig(): Promise<BgMusicConfig> {
  const row = await getSiteSettings();
  return parseBgMusic(row.bgMusicJson);
}

/** 前台播放器用：仅启用曲目；未开总开关则空列表 */
export async function getPublicBgMusicPayload() {
  const row = await getSiteSettings();
  const config = parseBgMusic(row.bgMusicJson);
  return {
    enabled: config.enabled,
    loopPlaylist: config.loopPlaylist,
    defaultOpen: config.defaultOpen,
    autoplay: config.autoplay,
    tracks: activeBgMusicTracks(config).map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      kind: t.kind,
      src: t.src,
      coverUrl: t.coverUrl || "",
      credit: t.credit || "",
    })),
  };
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
  const config = parseDecorate(row.decorateJson);
  // 装修图若在私有 OSS，SSR 时签发临时读链，避免 <img> 直链 403
  const { resolveStoredAccessUrl } = await import("./storage");
  const [logoUrl, heroImageUrl, ...bannerUrls] = await Promise.all([
    resolveStoredAccessUrl(config.logoUrl),
    resolveStoredAccessUrl(config.heroImageUrl),
    ...config.banners.map((b) => resolveStoredAccessUrl(b.url)),
  ]);
  return {
    ...config,
    logoUrl,
    heroImageUrl,
    banners: config.banners.map((b, i) => ({
      ...b,
      url: bannerUrls[i] || b.url,
    })),
  };
}

export async function getStudioNavConfig(): Promise<StudioNavConfig> {
  const row = await getSiteSettings();
  return parseStudioNav(row.studioNavJson);
}

export async function getPortalConfig(): Promise<PortalConfig> {
  const row = await getSiteSettings();
  return parsePortal(row.portalJson);
}

export async function getPageTemplatesConfig(): Promise<PageTemplatesConfig> {
  const row = await getSiteSettings();
  return parsePageTemplates(row.pageTemplatesJson);
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
    wechatAppSecret: row.wechatAppSecret
      ? maskSecret(row.wechatAppSecret)
      : "",
    wechatWebAppId: row.wechatWebAppId,
    wechatWebAppSecret: row.wechatWebAppSecret
      ? maskSecret(row.wechatWebAppSecret)
      : "",
    wechatMobileAppId: row.wechatMobileAppId || "",
    wechatMobileAppSecret: row.wechatMobileAppSecret
      ? maskSecret(row.wechatMobileAppSecret)
      : "",
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
    wechatOauthConfigured: Boolean(
      row.wechatAppId &&
        (row.wechatAppSecret || process.env.WECHAT_APP_SECRET),
    ),
    // 开放平台网站应用扫码登录（PC/站外浏览器）是否已配齐
    wechatWebOauthConfigured: Boolean(
      (row.wechatWebAppId || process.env.WECHAT_WEB_APP_ID) &&
        (row.wechatWebAppSecret || process.env.WECHAT_WEB_APP_SECRET),
    ),
    // 开放平台移动应用（Android App 微信 SDK 登录）是否已配齐
    wechatMobileOauthConfigured: Boolean(
      (row.wechatMobileAppId || process.env.WECHAT_MOBILE_APP_ID) &&
        (row.wechatMobileAppSecret || process.env.WECHAT_MOBILE_APP_SECRET),
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
    pageTemplates: parsePageTemplates(row.pageTemplatesJson),
    studioNav: parseStudioNav(row.studioNavJson),
    portal: parsePortal(row.portalJson),
    merchantPlatformCutPercent: row.merchantPlatformCutPercent ?? 10,
    agentShareOfPlatformCutPercent: row.agentShareOfPlatformCutPercent ?? 30,
    agentBuyerOrderPercent: row.agentBuyerOrderPercent ?? 10,
    teacherDistributionPercent: row.teacherDistributionPercent ?? 8,
    userDistributionPercent: row.userDistributionPercent ?? 5,
    hideAllPrices: Boolean(row.hideAllPrices),
    hideSocialChat: Boolean(row.hideSocialChat),
    defaultLocale: row.defaultLocale || "zh-Hans",
    enabledLocalesJson: row.enabledLocalesJson || "",
    enabledLocales: parseEnabledLocalesJsonSafe(row.enabledLocalesJson),
    translateApiBaseUrl: row.translateApiBaseUrl || "",
    translateApiKey: row.translateApiKey
      ? maskSecret(row.translateApiKey)
      : "",
    translateApiModel: row.translateApiModel || "gpt-4o-mini",
    translateConfigured: Boolean(row.translateApiKey?.trim()),
    smsEnabled: Boolean(row.smsEnabled),
    smsProvider: row.smsProvider || "test",
    smsAccessKeyId: row.smsAccessKeyId || "",
    smsAccessKeySecret: row.smsAccessKeySecret
      ? maskSecret(row.smsAccessKeySecret)
      : "",
    smsSignName: row.smsSignName || "",
    smsTemplateCode: row.smsTemplateCode || "",
    smsTestMode: row.smsTestMode !== false,
    smsTestFixedCode: row.smsTestFixedCode || "",
    // 登录页是否展示手机号入口：启用且（测试模式或阿里云参数齐全）
    smsLoginReady: Boolean(
      row.smsEnabled &&
        (row.smsTestMode ||
          row.smsProvider === "test" ||
          (row.smsAccessKeyId &&
            row.smsAccessKeySecret &&
            row.smsSignName &&
            row.smsTemplateCode)),
    ),
    bgMusic: parseBgMusic(row.bgMusicJson),
    jamendoClientId: row.jamendoClientId || "",
    jamendoConfigured: Boolean(row.jamendoClientId?.trim()),
    amapWebKey: row.amapWebKey ? maskSecret(row.amapWebKey) : "",
    amapConfigured: Boolean(
      row.amapWebKey?.trim() || process.env.AMAP_WEB_KEY?.trim(),
    ),
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

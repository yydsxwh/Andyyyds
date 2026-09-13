"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";
import {
  AI_PROVIDER_PRESETS,
  findProviderPreset,
  REGION_LABEL,
} from "@andyyyds/shared/ai-providers";

export type PublicSettings = {
  siteUrl: string;
  paymentMode: string;
  wechatEnabled: boolean;
  alipayEnabled: boolean;
  wechatAppId: string;
  wechatAppSecret: string;
  wechatWebAppId: string;
  wechatWebAppSecret: string;
  wechatMobileAppId: string;
  wechatMobileAppSecret: string;
  wechatMchId: string;
  wechatApiV3Key: string;
  wechatMchSerialNo: string;
  wechatMchPrivateKey: string;
  wechatConfigured: boolean;
  wechatOauthConfigured?: boolean;
  wechatWebOauthConfigured?: boolean;
  wechatMobileOauthConfigured?: boolean;
  alipayAppId: string;
  alipayPrivateKey: string;
  alipayPublicKey: string;
  alipayGateway: string;
  alipayConfigured: boolean;
  storageProvider: "LOCAL" | "ALIYUN_OSS";
  ossRegion: string;
  ossBucket: string;
  ossAccessKeyId: string;
  ossAccessKeySecret: string;
  ossEndpoint: string;
  ossPublicBaseUrl: string;
  ossPrefix: string;
  ossConfigured: boolean;
  videoStorageProvider: "LOCAL" | "ALIYUN_VOD";
  vodRegionId: string;
  vodAccessKeyId: string;
  vodAccessKeySecret: string;
  vodTemplateGroupId: string;
  vodPlayDomain: string;
  vodConfigured: boolean;
  merchantPlatformCutPercent: number;
  agentShareOfPlatformCutPercent: number;
  agentBuyerOrderPercent: number;
  teacherDistributionPercent: number;
  userDistributionPercent: number;
  hideAllPrices: boolean;
  hideSocialChat: boolean;
  defaultLocale: string;
  enabledLocales: string[];
  translateApiBaseUrl: string;
  translateApiKey: string;
  translateApiModel: string;
  translateConfigured?: boolean;
  smsEnabled: boolean;
  smsProvider: string;
  smsAccessKeyId: string;
  smsAccessKeySecret: string;
  smsSignName: string;
  smsTemplateCode: string;
  smsTestMode: boolean;
  smsTestFixedCode: string;
  smsLoginReady?: boolean;
  amapWebKey?: string;
  amapConfigured?: boolean;
};

type Props = { initial: PublicSettings };

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";

type SettingsSectionId =
  | "site"
  | "ai"
  | "i18n"
  | "commission"
  | "wechat-mp"
  | "wechat-web"
  | "wechat-mobile"
  | "wechat"
  | "sms"
  | "alipay"
  | "vod"
  | "oss"
  | "geo";

/** 系统设置分区：点击标题展开/收起；可同时展开多块 */
function SettingsSection({
  id,
  title,
  summary,
  open,
  onToggle,
  headerRight,
  children,
}: {
  id: SettingsSectionId;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: (id: SettingsSectionId) => void;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="surface overflow-hidden rounded-[28px]">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left hover:bg-white/40 sm:px-6 sm:py-5"
        onClick={() => onToggle(id)}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            {headerRight ? (
              <div
                className="flex items-center"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {headerRight}
              </div>
            ) : null}
          </div>
          {summary ? (
            <p className="mt-1 text-sm text-[var(--muted)]">{summary}</p>
          ) : null}
        </div>
        <span
          className={`mt-1 shrink-0 text-sm text-[var(--muted)] transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? (
        <div className="space-y-4 border-t border-[var(--line)] px-5 py-5 sm:px-6">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function SiteSettingsPanel({ initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(() => ({
    ...initial,
    wechatAppSecret: initial.wechatAppSecret || "",
    wechatWebAppId: initial.wechatWebAppId || "",
    wechatWebAppSecret: initial.wechatWebAppSecret || "",
    wechatMobileAppId: initial.wechatMobileAppId || "",
    wechatMobileAppSecret: initial.wechatMobileAppSecret || "",
    wechatOauthConfigured: Boolean(initial.wechatOauthConfigured),
    wechatWebOauthConfigured: Boolean(initial.wechatWebOauthConfigured),
    wechatMobileOauthConfigured: Boolean(initial.wechatMobileOauthConfigured),
    ossRegion: initial.ossRegion || "oss-cn-hongkong",
    ossBucket: initial.ossBucket || "yydsxwh-course-media",
    ossPrefix: initial.ossPrefix || "uploads",
    videoStorageProvider: initial.videoStorageProvider || "LOCAL",
    vodRegionId: initial.vodRegionId || "cn-shanghai",
    vodTemplateGroupId: initial.vodTemplateGroupId || "VOD_NO_TRANSCODE",
    merchantPlatformCutPercent: initial.merchantPlatformCutPercent ?? 10,
    agentShareOfPlatformCutPercent:
      initial.agentShareOfPlatformCutPercent ?? 30,
    agentBuyerOrderPercent: initial.agentBuyerOrderPercent ?? 10,
    teacherDistributionPercent: initial.teacherDistributionPercent ?? 8,
    userDistributionPercent: initial.userDistributionPercent ?? 5,
    hideAllPrices: Boolean(initial.hideAllPrices),
    hideSocialChat: Boolean(initial.hideSocialChat),
    defaultLocale: initial.defaultLocale || "zh-Hans",
    enabledLocales: Array.isArray(initial.enabledLocales)
      ? initial.enabledLocales
      : [
          "zh-Hans",
          "zh-Hant",
          "en",
          "es",
          "ja",
          "fr",
          "de",
          "vi",
          "fil",
          "pt",
        ],
    translateApiBaseUrl:
      initial.translateApiBaseUrl || "https://api.openai.com/v1",
    translateApiKey: initial.translateApiKey || "",
    translateApiModel: initial.translateApiModel || "gpt-4o-mini",
    translateConfigured: Boolean(initial.translateConfigured),
    smsEnabled: Boolean(initial.smsEnabled),
    smsProvider: initial.smsProvider || "test",
    smsAccessKeyId: initial.smsAccessKeyId || "",
    smsAccessKeySecret: initial.smsAccessKeySecret || "",
    smsSignName: initial.smsSignName || "",
    smsTemplateCode: initial.smsTemplateCode || "",
    smsTestMode: initial.smsTestMode !== false,
    smsTestFixedCode: initial.smsTestFixedCode || "123456",
    smsLoginReady: Boolean(initial.smsLoginReady),
    amapWebKey: initial.amapWebKey || "",
    amapConfigured: Boolean(initial.amapConfigured),
  }));
  // 用集合记录展开项，互不影响，方便对照填写多块配置
  const [openSections, setOpenSections] = useState<Set<SettingsSectionId>>(
    () => new Set<SettingsSectionId>(["site", "ai"]),
  );
  const [savingSection, setSavingSection] = useState<SettingsSectionId | null>(
    null,
  );
  const [sectionFeedback, setSectionFeedback] = useState<
    Partial<Record<SettingsSectionId, SaveStatus>>
  >({});
  const [ossBusy, setOssBusy] = useState(false);
  const [vodBusy, setVodBusy] = useState(false);

  function toggleSection(id: SettingsSectionId) {
    setOpenSections((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setSectionStatus(id: SettingsSectionId, status: SaveStatus) {
    setSectionFeedback((m) => ({ ...m, [id]: status }));
  }

  function set<K extends keyof PublicSettings>(key: K, value: PublicSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function mergeSettingsResponse(settings: Partial<PublicSettings>) {
    setForm((f) => ({
      ...f,
      ...settings,
      ossRegion: settings.ossRegion || f.ossRegion || "oss-cn-hongkong",
      ossBucket: settings.ossBucket || f.ossBucket || "yydsxwh-course-media",
      ossPrefix: settings.ossPrefix || f.ossPrefix || "uploads",
      vodRegionId: settings.vodRegionId || f.vodRegionId || "cn-shanghai",
      vodTemplateGroupId:
        settings.vodTemplateGroupId || f.vodTemplateGroupId || "VOD_NO_TRANSCODE",
    }));
  }

  /** 各区块只提交本块字段，避免误覆盖其它分区未保存的改动 */
  function payloadForSection(id: SettingsSectionId): Record<string, unknown> {
    switch (id) {
      case "site":
        return {
          siteUrl: form.siteUrl,
          paymentMode: form.paymentMode,
          hideAllPrices: form.hideAllPrices,
          hideSocialChat: form.hideSocialChat,
        };
      case "ai":
        // Key 全站共用（翻译 + MathCode），单独栏目保存，避免和语种开关互相覆盖
        return {
          translateApiBaseUrl: form.translateApiBaseUrl,
          translateApiKey: form.translateApiKey,
          translateApiModel: form.translateApiModel,
        };
      case "i18n":
        return {
          defaultLocale: form.defaultLocale,
          enabledLocales: form.enabledLocales,
        };
      case "commission":
        return {
          merchantPlatformCutPercent: Number(form.merchantPlatformCutPercent),
          agentShareOfPlatformCutPercent: Number(
            form.agentShareOfPlatformCutPercent,
          ),
          agentBuyerOrderPercent: Number(form.agentBuyerOrderPercent),
          teacherDistributionPercent: Number(form.teacherDistributionPercent),
          userDistributionPercent: Number(form.userDistributionPercent),
        };
      case "wechat-mp":
        return {
          wechatAppId: form.wechatAppId,
          wechatAppSecret: form.wechatAppSecret,
        };
      case "wechat-web":
        return {
          wechatWebAppId: form.wechatWebAppId,
          wechatWebAppSecret: form.wechatWebAppSecret,
        };
      case "wechat-mobile":
        return {
          wechatMobileAppId: form.wechatMobileAppId,
          wechatMobileAppSecret: form.wechatMobileAppSecret,
        };
      case "wechat":
        return {
          wechatEnabled: form.wechatEnabled,
          wechatMchId: form.wechatMchId,
          wechatApiV3Key: form.wechatApiV3Key,
          wechatMchSerialNo: form.wechatMchSerialNo,
          wechatMchPrivateKey: form.wechatMchPrivateKey,
        };
      case "sms":
        return {
          smsEnabled: form.smsEnabled,
          smsProvider: form.smsProvider,
          smsAccessKeyId: form.smsAccessKeyId,
          smsAccessKeySecret: form.smsAccessKeySecret,
          smsSignName: form.smsSignName,
          smsTemplateCode: form.smsTemplateCode,
          smsTestMode: form.smsTestMode,
          smsTestFixedCode: form.smsTestFixedCode,
        };
      case "alipay":
        return {
          alipayEnabled: form.alipayEnabled,
          alipayAppId: form.alipayAppId,
          alipayPrivateKey: form.alipayPrivateKey,
          alipayPublicKey: form.alipayPublicKey,
          alipayGateway: form.alipayGateway,
        };
      case "vod":
        return {
          videoStorageProvider: form.videoStorageProvider,
          vodRegionId: form.vodRegionId,
          vodAccessKeyId: form.vodAccessKeyId,
          vodAccessKeySecret: form.vodAccessKeySecret,
          vodTemplateGroupId: form.vodTemplateGroupId,
          vodPlayDomain: form.vodPlayDomain,
        };
      case "oss":
        return {
          storageProvider: form.storageProvider,
          ossRegion: form.ossRegion,
          ossBucket: form.ossBucket,
          ossAccessKeyId: form.ossAccessKeyId,
          ossAccessKeySecret: form.ossAccessKeySecret,
          ossEndpoint: form.ossEndpoint,
          ossPublicBaseUrl: form.ossPublicBaseUrl,
          ossPrefix: form.ossPrefix,
        };
      case "geo":
        return { amapWebKey: form.amapWebKey };
      default:
        return {};
    }
  }

  const SECTION_SAVE_OK: Record<SettingsSectionId, string> = {
    site: "站点基础已保存",
    ai: "AI 接口已保存",
    i18n: "语言与翻译已保存",
    commission: "分成与抽成已保存",
    "wechat-mp": "微信公众号接口已保存",
    "wechat-web": "微信扫码登录已保存",
    "wechat-mobile": "微信 App 快捷登录已保存",
    wechat: "微信支付已保存",
    sms: "短信登录已保存",
    alipay: "支付宝支付已保存",
    vod: "点播设置已保存",
    oss: "OSS 设置已保存",
    geo: "地图选点设置已保存",
  };

  async function saveSection(id: SettingsSectionId) {
    if (savingSection) return;
    setSavingSection(id);
    setSectionStatus(id, null);
    const result = await postSave("/api/studio/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadForSection(id)),
    });
    setSavingSection(null);
    if (!result.ok) {
      setSectionStatus(id, {
        kind: "error",
        text: result.error || "保存失败",
      });
      return;
    }
    const settings = result.data.settings as Partial<PublicSettings> | undefined;
    if (settings) mergeSettingsResponse(settings);
    setSectionStatus(id, { kind: "ok", text: SECTION_SAVE_OK[id] });
    router.refresh();
  }

  function sectionSaveBar(id: SettingsSectionId) {
    const busy = savingSection === id;
    const status = sectionFeedback[id] ?? null;
    return (
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-4">
        <button
          type="button"
          className="btn btn-primary min-h-11 px-5"
          disabled={busy || Boolean(savingSection && savingSection !== id)}
          onClick={() => void saveSection(id)}
        >
          {busy ? "保存中…" : "保存本块设置"}
        </button>
        {status ? (
          <SaveFeedback status={status} />
        ) : (
          <span className="text-xs text-[var(--muted)]">
            只写入本分区，不影响其它未保存的改动
          </span>
        )}
      </div>
    );
  }

  async function testVod() {
    setVodBusy(true);
    setSectionStatus("vod", null);
    const result = await postSave("/api/studio/settings/vod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "test",
        vodRegionId: form.vodRegionId || "cn-shanghai",
        vodAccessKeyId: form.vodAccessKeyId,
        vodAccessKeySecret: form.vodAccessKeySecret,
        vodTemplateGroupId: form.vodTemplateGroupId || "VOD_NO_TRANSCODE",
        vodPlayDomain: form.vodPlayDomain,
      }),
    });
    setVodBusy(false);
    if (!result.ok) {
      setSectionStatus("vod", {
        kind: "error",
        text: result.error || "点播连接失败",
      });
      return;
    }
    const settings = result.data.settings as Partial<PublicSettings> | undefined;
    if (settings) mergeSettingsResponse(settings);
    const msg =
      typeof result.data.message === "string"
        ? result.data.message
        : "点播连接成功";
    setSectionStatus("vod", { kind: "ok", text: msg });
    router.refresh();
  }

  async function runOssAction(action: "test" | "upload-test" | "create") {
    setOssBusy(true);
    setSectionStatus("oss", null);
    const result = await postSave("/api/studio/settings/oss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ossRegion: form.ossRegion || "oss-cn-hongkong",
        ossBucket: form.ossBucket,
        ossAccessKeyId: form.ossAccessKeyId,
        ossAccessKeySecret: form.ossAccessKeySecret,
        ossEndpoint: form.ossEndpoint,
        ossPublicBaseUrl: form.ossPublicBaseUrl,
        ossPrefix: form.ossPrefix || "uploads",
        enableAfterCreate: true,
      }),
    });
    setOssBusy(false);
    if (!result.ok) {
      setSectionStatus("oss", {
        kind: "error",
        text: result.error || "OSS 操作失败",
      });
      return;
    }
    const settings = result.data.settings as Partial<PublicSettings> | undefined;
    if (settings) mergeSettingsResponse(settings);
    // upload-test / test 失败时 API 仍可能 200 + ok:false，需把 message 原样展示
    if (result.data.ok === false) {
      setSectionStatus("oss", {
        kind: "error",
        text:
          (typeof result.data.message === "string" && result.data.message) ||
          "OSS 探测失败",
      });
      return;
    }
    const fallback =
      action === "test"
        ? "连接成功"
        : action === "upload-test"
          ? "上传探测成功"
          : "OSS 已就绪";
    setSectionStatus("oss", {
      kind: "ok",
      text:
        (typeof result.data.message === "string" && result.data.message) ||
        fallback,
    });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="mb-2 text-sm text-[var(--muted)]">
        点击下方菜单展开对应设置；每个分区底部有独立的「保存本块设置」，互不影响。
      </p>

      <SettingsSection
        id="site"
        title="站点基础"
        summary="公网地址与支付模式"
        open={openSections.has("site")}
        onToggle={toggleSection}
      >
        <Field
          label="站点公网地址"
          hint="用于支付回调，例如 https://www.yydsxwh.com"
        >
          <input
            className={inputClass}
            value={form.siteUrl}
            onChange={(e) => set("siteUrl", e.target.value)}
            placeholder="https://www.yydsxwh.com"
          />
        </Field>
        <Field label="支付模式">
          <select
            className={inputClass}
            value={form.paymentMode}
            onChange={(e) => set("paymentMode", e.target.value)}
          >
            <option value="auto">自动（按下方开关与是否已配置）</option>
            <option value="mock">仅模拟支付（调试）</option>
            <option value="wechat">仅微信支付</option>
            <option value="alipay">仅支付宝</option>
            <option value="both">微信 + 支付宝</option>
          </select>
        </Field>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-[var(--line)] bg-white/70 px-3 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--brand)]"
            checked={form.hideAllPrices}
            onChange={(e) => set("hideAllPrices", e.target.checked)}
          />
          <span>
            <span className="font-medium text-[var(--ink)]">
              前台隐藏所有产品价格
            </span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              列表、详情等营销面不显示售价；结账与订单仍显示应付金额。单品也可单独隐藏。
            </span>
          </span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-[var(--line)] bg-white/70 px-3 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--brand)]"
            checked={form.hideSocialChat}
            onChange={(e) => set("hideSocialChat", e.target.checked)}
          />
          <span>
            <span className="font-medium text-[var(--ink)]">
              隐藏站内社交私聊与群组
            </span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              关闭首页找人私聊、发起群聊、约搭/班级自动群等前台能力（合规管控用）。
              商品/约搭详情里「私聊咨询商家或发起人」不受影响，仍可保留。
            </span>
          </span>
        </label>
        {sectionSaveBar("site")}
      </SettingsSection>

      <AiApiSection
        form={form}
        set={set}
        open={openSections.has("ai")}
        onToggle={toggleSection}
        sectionSaveBar={sectionSaveBar}
      />

      <LanguageTranslateSection
        form={form}
        set={set}
        open={openSections.has("i18n")}
        onToggle={toggleSection}
        sectionSaveBar={sectionSaveBar}
        mergeSettingsResponse={mergeSettingsResponse}
      />

      <SettingsSection
        id="commission"
        title="分成与抽成"
        summary={`商家抽成 ${form.merchantPlatformCutPercent}% · 用户提成 ${form.userDistributionPercent}%`}
        open={openSections.has("commission")}
        onToggle={toggleSection}
      >
        <p className="text-sm text-[var(--muted)]">
          金额单位与订单一致（分）。成交推荐人只认一位：订单邀请码优先，否则用注册上级；按推荐人角色取对应比例。入驻商家课另算平台抽成；发展该商家的加盟代理按
          Merchant.agentId 从平台抽成再分。以上各项与三级分销可叠加结算，上不封顶。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="入驻商家平台抽成比例（%）"
            hint="商家课程实付金额中，平台抽取的比例。默认 10。"
          >
            <input
              className={inputClass}
              type="number"
              min={0}
              max={100}
              step={1}
              value={form.merchantPlatformCutPercent}
              onChange={(e) =>
                set("merchantPlatformCutPercent", Number(e.target.value))
              }
            />
          </Field>
          <Field
            label="加盟代理：商家抽成再分（%）"
            hint="从「平台抽成」中再分给发展该商家的代理。默认 30。"
          >
            <input
              className={inputClass}
              type="number"
              min={0}
              max={100}
              step={1}
              value={form.agentShareOfPlatformCutPercent}
              onChange={(e) =>
                set("agentShareOfPlatformCutPercent", Number(e.target.value))
              }
            />
          </Field>
          <Field
            label="加盟代理：用户成交分成（%）"
            hint="推荐人是加盟代理时，按其邀请成交实付分成。默认 10。"
          >
            <input
              className={inputClass}
              type="number"
              min={0}
              max={100}
              step={1}
              value={form.agentBuyerOrderPercent}
              onChange={(e) =>
                set("agentBuyerOrderPercent", Number(e.target.value))
              }
            />
          </Field>
          <Field
            label="老师分销分成比例（%）"
            hint="推荐人是老师时的成交分成。默认 8。"
          >
            <input
              className={inputClass}
              type="number"
              min={0}
              max={100}
              step={1}
              value={form.teacherDistributionPercent}
              onChange={(e) =>
                set("teacherDistributionPercent", Number(e.target.value))
              }
            />
          </Field>
          <Field
            label="用户分销提成比例（%）"
            hint="推荐人是普通用户（或商家推荐他人）时的提成。默认 5。"
          >
            <input
              className={inputClass}
              type="number"
              min={0}
              max={100}
              step={1}
              value={form.userDistributionPercent}
              onChange={(e) =>
                set("userDistributionPercent", Number(e.target.value))
              }
            />
          </Field>
        </div>
        {sectionSaveBar("commission")}
      </SettingsSection>

      {/*
        公众号开发者凭证：登录 / JSAPI / 图文同步共用同一 AppID+AppSecret，
        与下方「微信支付」商户参数分开，避免站长找不到「接口」入口。
      */}
      <SettingsSection
        id="wechat-mp"
        title="微信公众号接口"
        summary={
          form.wechatOauthConfigured
            ? "AppID / AppSecret 已配置 · 登录与图文同步可用"
            : form.wechatAppId?.trim()
              ? "已填 AppID · 请补全 AppSecret"
              : "未配置"
        }
        open={openSections.has("wechat-mp")}
        onToggle={toggleSection}
      >
        <p className="rounded-2xl bg-[var(--bg-deep)]/60 px-3 py-2 text-xs leading-5 text-[var(--muted)]">
          填写你自己公众号的开发者凭证（微信公众平台 → 开发 → 基本配置）。用于：微信登录 /
          绑定、微信内 JSAPI
          支付换 openid、公司介绍页「公众号图文」官方接口同步。网页授权域名请填{" "}
          <code className="text-[var(--ink)]">www.yydsxwh.com</code>
          。图文同步还需账号为企业主体已认证并开通「发布」接口。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="公众号 AppID"
            hint="与微信支付、登录使用同一公众号 AppID"
          >
            <input
              className={inputClass}
              value={form.wechatAppId}
              onChange={(e) => set("wechatAppId", e.target.value)}
              placeholder="wx..."
              autoComplete="off"
            />
          </Field>
          <Field
            label="公众号 AppSecret"
            hint="已保存会打码，不改请留原样。勿泄露；重置后需重新填写"
          >
            <input
              className={inputClass}
              value={form.wechatAppSecret}
              onChange={(e) => set("wechatAppSecret", e.target.value)}
              placeholder="填写后可微信登录、JSAPI 支付与图文同步"
              autoComplete="off"
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href="/studio/wechat-mp"
            className="btn btn-secondary min-h-11 px-4 text-sm"
          >
            去同步图文 / 合集
          </a>
          <a
            href="/about/company"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary min-h-11 px-4 text-sm"
          >
            查看公司介绍页
          </a>
        </div>
        {sectionSaveBar("wechat-mp")}
      </SettingsSection>

      {/*
        开放平台网站应用：PC/站外浏览器「微信扫码登录」。
        与公众号 AppID 不同；openid 也分开存，避免污染 JSAPI 用的公众号 openid。
      */}
      <SettingsSection
        id="wechat-web"
        title="微信扫码登录（开放平台）"
        summary={
          form.wechatWebOauthConfigured
            ? "网站应用 AppID / AppSecret 已配置 · 扫码登录可用"
            : form.wechatWebAppId?.trim()
              ? "已填 AppID · 请补全 AppSecret"
              : "未配置"
        }
        open={openSections.has("wechat-web")}
        onToggle={toggleSection}
      >
        <p className="rounded-2xl bg-[var(--bg-deep)]/60 px-3 py-2 text-xs leading-5 text-[var(--muted)]">
          用于电脑与普通手机浏览器的「微信扫码登录」。请到
          <span className="text-[var(--ink)]">微信开放平台</span>
          → 管理中心 → 网站应用，创建应用并完成开发者资质认证后，填写下方凭证。授权回调域填{" "}
          <code className="text-[var(--ink)]">www.yydsxwh.com</code>
          （不要带 https:// 与路径）。建议把本站公众号也绑定到同一开放平台账号，以便拿到
          unionid，扫码与微信内登录自动合并为同一用户。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="网站应用 AppID"
            hint="开放平台「网站应用」的 AppID，不是公众号 AppID"
          >
            <input
              className={inputClass}
              value={form.wechatWebAppId}
              onChange={(e) => set("wechatWebAppId", e.target.value)}
              placeholder="wx..."
              autoComplete="off"
            />
          </Field>
          <Field
            label="网站应用 AppSecret"
            hint="已保存会打码，不改请留原样。勿泄露"
          >
            <input
              className={inputClass}
              value={form.wechatWebAppSecret}
              onChange={(e) => set("wechatWebAppSecret", e.target.value)}
              placeholder="填写后电脑端可微信扫码登录"
              autoComplete="off"
            />
          </Field>
        </div>
        {sectionSaveBar("wechat-web")}
      </SettingsSection>

      {/*
        开放平台移动应用：Android Capacitor App 微信快捷登录。
        包名 / 签名须与开放平台登记一致，否则 SDK 授权失败。
      */}
      <SettingsSection
        id="wechat-mobile"
        title="微信 App 快捷登录（开放平台移动应用）"
        summary={
          form.wechatMobileOauthConfigured
            ? "移动应用 AppID / AppSecret 已配置 · App 快捷登录可用"
            : form.wechatMobileAppId?.trim()
              ? "已填 AppID · 请补全 AppSecret"
              : "未配置"
        }
        open={openSections.has("wechat-mobile")}
        onToggle={toggleSection}
      >
        <p className="rounded-2xl bg-[var(--bg-deep)]/60 px-3 py-2 text-xs leading-5 text-[var(--muted)]">
          用于 Android 安装包内的「微信快捷登录」。请到
          <span className="text-[var(--ink)]">微信开放平台</span>
          → 管理中心 → 移动应用，创建应用并填写：
          <br />
          · 应用包名{" "}
          <code className="text-[var(--ink)]">com.yydsxwh.app</code>
          <br />
          · 应用签名{" "}
          <span className="text-[var(--ink)]">MD5</span>
          （32 位小写、无冒号；debug 包见 android/README.md 取签名说明）
          <br />
          建议与公众号、网站应用绑定同一开放平台账号，以便拿到 unionid
          自动合并用户。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="移动应用 AppID"
            hint="开放平台「移动应用」的 AppID，不是公众号 / 网站应用 AppID"
          >
            <input
              className={inputClass}
              value={form.wechatMobileAppId}
              onChange={(e) => set("wechatMobileAppId", e.target.value)}
              placeholder="wx..."
              autoComplete="off"
            />
          </Field>
          <Field
            label="移动应用 AppSecret"
            hint="已保存会打码，不改请留原样。勿泄露"
          >
            <input
              className={inputClass}
              value={form.wechatMobileAppSecret}
              onChange={(e) => set("wechatMobileAppSecret", e.target.value)}
              placeholder="填写后 Android App 可微信快捷登录"
              autoComplete="off"
            />
          </Field>
        </div>
        {sectionSaveBar("wechat-mobile")}
      </SettingsSection>

      <SettingsSection
        id="wechat"
        title="微信支付"
        summary={
          form.wechatConfigured
            ? form.wechatOauthConfigured
              ? "已配置 · 微信内直接支付就绪"
              : "已配置商户 · 请先在「微信公众号接口」填 AppSecret"
            : "未配置完整"
        }
        open={openSections.has("wechat")}
        onToggle={toggleSection}
        headerRight={
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              checked={form.wechatEnabled}
              onChange={(e) => set("wechatEnabled", e.target.checked)}
            />
            启用
          </label>
        }
      >
        <p className="text-sm text-[var(--muted)]">
          回调 /api/payments/wechat/notify。AppID / AppSecret 请在上方「微信公众号接口」填写。
        </p>
        <p className="rounded-2xl bg-[var(--bg-deep)]/60 px-3 py-2 text-xs leading-5 text-[var(--muted)]">
          电脑端：扫码（Native）。手机浏览器：H5（需商户开通 H5
          支付并配置域名）。微信内：JSAPI（依赖公众号 AppSecret 与网页授权域名{" "}
          <code className="text-[var(--ink)]">www.yydsxwh.com</code>
          ；支付目录与 JSAPI 安全域名按微信商户平台要求配置）。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="商户号 mchid">
            <input
              className={inputClass}
              value={form.wechatMchId}
              onChange={(e) => set("wechatMchId", e.target.value)}
            />
          </Field>
          <Field label="APIv3 密钥（32位）" hint="已保存的密钥会打码，不改请留原样">
            <input
              className={inputClass}
              value={form.wechatApiV3Key}
              onChange={(e) => set("wechatApiV3Key", e.target.value)}
            />
          </Field>
          <Field label="证书序列号">
            <input
              className={inputClass}
              value={form.wechatMchSerialNo}
              onChange={(e) => set("wechatMchSerialNo", e.target.value)}
            />
          </Field>
          <Field label="商户私钥 PEM" hint="粘贴 apiclient_key.pem 全文">
            <textarea
              className={inputClass}
              rows={5}
              value={form.wechatMchPrivateKey}
              onChange={(e) => set("wechatMchPrivateKey", e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----"
            />
          </Field>
        </div>
        {sectionSaveBar("wechat")}
      </SettingsSection>

      <SettingsSection
        id="sms"
        title="短信登录"
        summary={
          form.smsLoginReady || (form.smsEnabled && form.smsTestMode)
            ? form.smsTestMode
              ? "已启用 · 测试模式"
              : "已启用 · 阿里云短信"
            : form.smsEnabled
              ? "已启用 · 请补全阿里云参数或开测试模式"
              : "未启用"
        }
        open={openSections.has("sms")}
        onToggle={toggleSection}
        headerRight={
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              checked={form.smsEnabled}
              onChange={(e) => set("smsEnabled", e.target.checked)}
            />
            启用
          </label>
        }
      >
        <p className="rounded-2xl bg-[var(--bg-deep)]/60 px-3 py-2 text-xs leading-5 text-[var(--muted)]">
          手机号登录 / 注册依赖短信验证码。联调可开「测试模式」（码写入服务器日志，或用固定测试码）。上线请关闭测试模式，并填写阿里云短信 AccessKey、签名与模板（模板变量须含{" "}
          <code className="text-[var(--ink)]">code</code>）。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="服务商">
            <select
              className={inputClass}
              value={form.smsProvider}
              onChange={(e) => set("smsProvider", e.target.value)}
            >
              <option value="test">仅测试（不调运营商）</option>
              <option value="aliyun">阿里云短信</option>
            </select>
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              checked={form.smsTestMode}
              onChange={(e) => set("smsTestMode", e.target.checked)}
            />
            测试模式（日志 / 固定码，不发真短信）
          </label>
          <Field
            label="固定测试码"
            hint="测试模式生效；留空则每次随机并打日志"
          >
            <input
              className={inputClass}
              value={form.smsTestFixedCode}
              onChange={(e) => set("smsTestFixedCode", e.target.value)}
              placeholder="123456"
            />
          </Field>
          <Field label="短信签名">
            <input
              className={inputClass}
              value={form.smsSignName}
              onChange={(e) => set("smsSignName", e.target.value)}
              placeholder="已审核签名"
            />
          </Field>
          <Field label="模板 CODE">
            <input
              className={inputClass}
              value={form.smsTemplateCode}
              onChange={(e) => set("smsTemplateCode", e.target.value)}
              placeholder="SMS_xxxxxxxx"
            />
          </Field>
          <Field label="AccessKey ID">
            <input
              className={inputClass}
              value={form.smsAccessKeyId}
              onChange={(e) => set("smsAccessKeyId", e.target.value)}
            />
          </Field>
          <Field
            label="AccessKey Secret"
            hint="已保存会打码，不改请留原样"
          >
            <input
              className={inputClass}
              value={form.smsAccessKeySecret}
              onChange={(e) => set("smsAccessKeySecret", e.target.value)}
            />
          </Field>
        </div>
        {sectionSaveBar("sms")}
      </SettingsSection>

      <SettingsSection
        id="alipay"
        title="支付宝支付"
        summary={
          form.alipayConfigured
            ? "已配置"
            : "未配置完整 · 回调 /api/payments/alipay/notify"
        }
        open={openSections.has("alipay")}
        onToggle={toggleSection}
        headerRight={
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              checked={form.alipayEnabled}
              onChange={(e) => set("alipayEnabled", e.target.checked)}
            />
            启用
          </label>
        }
      >
        <p className="rounded-2xl bg-[var(--bg-deep)]/60 px-3 py-2 text-xs leading-5 text-[var(--muted)]">
          在{" "}
          <a
            className="text-[var(--brand)] underline"
            href="https://open.alipay.com"
            target="_blank"
            rel="noreferrer"
          >
            open.alipay.com
          </a>{" "}
          创建应用并开通「手机网站支付」「电脑网站支付」。异步通知地址填{" "}
          <code className="text-[var(--ink)]">
            https://www.yydsxwh.com/api/payments/alipay/notify
          </code>
          ；回跳可用{" "}
          <code className="text-[var(--ink)]">
            https://www.yydsxwh.com/checkout/return
          </code>
          。密钥用 RSA2。支付方式建议选「微信 + 支付宝」。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="应用 AppID">
            <input
              className={inputClass}
              value={form.alipayAppId}
              onChange={(e) => set("alipayAppId", e.target.value)}
              placeholder="2021xxxxxxxxxx"
            />
          </Field>
          <Field label="网关环境">
            <select
              className={inputClass}
              value={form.alipayGateway}
              onChange={(e) => set("alipayGateway", e.target.value)}
            >
              <option value="production">正式环境</option>
              <option value="sandbox">沙箱</option>
            </select>
          </Field>
          <Field
            label="应用私钥"
            hint="你自己生成的 RSA2 私钥。已保存会打码，不改请留原样"
          >
            <textarea
              className={inputClass}
              rows={4}
              value={form.alipayPrivateKey}
              onChange={(e) => set("alipayPrivateKey", e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY----- ..."
            />
          </Field>
          <Field
            label="支付宝公钥"
            hint="开放平台「支付宝公钥」，不是应用公钥。已保存会打码，不改请留原样"
          >
            <textarea
              className={inputClass}
              rows={4}
              value={form.alipayPublicKey}
              onChange={(e) => set("alipayPublicKey", e.target.value)}
              placeholder="-----BEGIN PUBLIC KEY----- ..."
            />
          </Field>
        </div>
        {sectionSaveBar("alipay")}
      </SettingsSection>

      <SettingsSection
        id="vod"
        title="课程视频 · 阿里云点播"
        summary={
          form.videoStorageProvider === "ALIYUN_VOD"
            ? form.vodConfigured
              ? "已启用点播 · 密钥已填"
              : "已选点播 · 请填 AccessKey"
            : "当前未走点播"
        }
        open={openSections.has("vod")}
        onToggle={toggleSection}
      >
        <p className="text-sm text-[var(--muted)]">
          素材中心上传的<strong>课程视频</strong>走点播（转码/播放）。可与下方
          OSS 同时开启：视频用点播，图片等其他文件用 OSS。
        </p>
        <Field label="视频存储方式">
          <select
            className={inputClass}
            value={form.videoStorageProvider}
            onChange={(e) =>
              set(
                "videoStorageProvider",
                e.target.value as "LOCAL" | "ALIYUN_VOD",
              )
            }
          >
            <option value="LOCAL">本地磁盘（或回退到下方 OSS）</option>
            <option value="ALIYUN_VOD">阿里云点播（推荐）</option>
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="regionId"
            hint="例：上海 cn-shanghai、北京 cn-beijing、深圳 cn-shenzhen"
          >
            <input
              className={inputClass}
              value={form.vodRegionId}
              onChange={(e) => set("vodRegionId", e.target.value)}
              placeholder="cn-shanghai"
            />
          </Field>
          <Field label="不转码模板组 ID">
            <input
              className={inputClass}
              value={form.vodTemplateGroupId}
              onChange={(e) => set("vodTemplateGroupId", e.target.value)}
              placeholder="VOD_NO_TRANSCODE"
            />
          </Field>
          <Field
            label="AccessKey ID"
            hint="需具备视频点播权限的 RAM AccessKey；可与下方 OSS 用同一对"
          >
            <input
              className={inputClass}
              value={form.vodAccessKeyId}
              onChange={(e) => set("vodAccessKeyId", e.target.value)}
            />
          </Field>
          <Field
            label="AccessKey Secret"
            hint="必须与上方 ID 配对；填错会出现签名校验失败。与 OSS 同 AK 时请填同一 Secret"
          >
            <input
              className={inputClass}
              value={form.vodAccessKeySecret}
              onChange={(e) => set("vodAccessKeySecret", e.target.value)}
            />
          </Field>
          <Field
            label="播放域名（选填）"
            hint="不含 http/https，多域名时指定要用的那个"
          >
            <input
              className={inputClass}
              value={form.vodPlayDomain}
              onChange={(e) => set("vodPlayDomain", e.target.value)}
              placeholder="例如 play.example.com"
            />
          </Field>
          <p className="text-sm text-[var(--muted)] sm:col-span-2">
            当前：
            {form.videoStorageProvider === "ALIYUN_VOD"
              ? "已启用点播"
              : "视频未走点播"}
            {" · "}
            {form.vodConfigured ? "密钥已填" : "请先填写点播 AccessKey"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={vodBusy}
            onClick={() => void testVod()}
          >
            {vodBusy ? "测试中…" : "测试点播连接"}
          </button>
        </div>
        {sectionSaveBar("vod")}
      </SettingsSection>

      <SettingsSection
        id="oss"
        title="其他文件 · 阿里云 OSS"
        summary={
          form.storageProvider === "ALIYUN_OSS"
            ? form.ossConfigured
              ? "已启用 OSS · 密钥已填"
              : "已选 OSS · 请填 AccessKey"
            : "当前本地存储"
        }
        open={openSections.has("oss")}
        onToggle={toggleSection}
      >
        <p className="text-sm text-[var(--muted)]">
          店铺装修图片、封面、附件等走 OSS。服务器在香港时，Region 推荐
          <code className="mx-1">oss-cn-hongkong</code>。
        </p>
        <Field label="其他文件存储方式">
          <select
            className={inputClass}
            value={form.storageProvider}
            onChange={(e) =>
              set("storageProvider", e.target.value as "LOCAL" | "ALIYUN_OSS")
            }
          >
            <option value="LOCAL">本地磁盘（服务器 public/uploads）</option>
            <option value="ALIYUN_OSS">阿里云 OSS</option>
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Region">
            <input
              className={inputClass}
              value={form.ossRegion}
              onChange={(e) => set("ossRegion", e.target.value)}
              placeholder="oss-cn-hongkong"
            />
          </Field>
          <Field label="Bucket 名称（全球唯一）">
            <input
              className={inputClass}
              value={form.ossBucket}
              onChange={(e) => set("ossBucket", e.target.value)}
              placeholder="yydsxwh-course-media"
            />
          </Field>
          <Field
            label="AccessKey ID"
            hint="可与点播共用同一 RAM 用户（需同时开 OSS + 点播权限）"
          >
            <input
              className={inputClass}
              value={form.ossAccessKeyId}
              onChange={(e) => set("ossAccessKeyId", e.target.value)}
            />
          </Field>
          <Field label="AccessKey Secret">
            <input
              className={inputClass}
              value={form.ossAccessKeySecret}
              onChange={(e) => set("ossAccessKeySecret", e.target.value)}
            />
          </Field>
          <Field label="自定义 Endpoint（可选）">
            <input
              className={inputClass}
              value={form.ossEndpoint}
              onChange={(e) => set("ossEndpoint", e.target.value)}
              placeholder="一般留空即可"
            />
          </Field>
          <Field label="公网访问前缀 / CDN（可选）">
            <input
              className={inputClass}
              value={form.ossPublicBaseUrl}
              onChange={(e) => set("ossPublicBaseUrl", e.target.value)}
              placeholder="创建成功后会自动填 Bucket 域名"
            />
          </Field>
          <Field label="对象前缀">
            <input
              className={inputClass}
              value={form.ossPrefix || "uploads"}
              onChange={(e) => set("ossPrefix", e.target.value)}
            />
          </Field>
          <p className="text-sm text-[var(--muted)] sm:col-span-2">
            当前：
            {form.storageProvider === "ALIYUN_OSS" ? "已启用 OSS" : "本地存储"}
            {" · "}
            {form.ossConfigured ? "密钥参数已填" : "请先填写 AccessKey 与 Bucket"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={ossBusy}
            onClick={() => void runOssAction("test")}
          >
            {ossBusy ? "处理中…" : "测试 OSS 连接"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={ossBusy}
            onClick={() => void runOssAction("upload-test")}
          >
            {ossBusy ? "处理中…" : "测试 OSS 上传"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={ossBusy}
            onClick={() => void runOssAction("create")}
          >
            {ossBusy ? "处理中…" : "一键创建 Bucket 并启用 OSS"}
          </button>
        </div>
        <p className="text-xs text-[var(--muted)]">
          视频走点播（VOD），PDF/图片等走 OSS。「测试 OSS 连接」只验 List；「测试 OSS
          上传」会真实 PutObject（不带对象 ACL）。若报 AccessDenied / bucket
          acl，请在阿里云给该 RAM 用户授予本 Bucket 的 PutObject，并确认 AccessKey
          与桶同属一个账号。预览由站点签发临时链接，无需公共读。
        </p>
        {sectionSaveBar("oss")}
      </SettingsSection>

      <SettingsSection
        id="geo"
        title="地图选点 · 高德"
        summary={
          form.amapConfigured ? "已配置高德 Key，可搜国内店名" : "未配置，国内餐厅可能搜不到"
        }
        open={openSections.has("geo")}
        onToggle={toggleSection}
      >
        <p className="text-sm leading-6 text-[var(--muted)]">
          约搭和大学论坛搜地点默认走高德 Web 服务（国内店名比 OpenStreetMap
          全得多）。请到
          <a
            className="mx-1 text-[var(--brand)] underline"
            href="https://console.amap.com/dev/key/app"
            target="_blank"
            rel="noopener noreferrer"
          >
            高德开放平台
          </a>
          创建应用，服务平台选「Web 服务」，把 Key 贴到下面。也可在服务器环境变量
          <code className="mx-1">AMAP_WEB_KEY</code> 里配置。
        </p>
        <Field
          label="高德 Web 服务 Key"
          hint="已保存的显示为打码；留空保存表示不修改。无 Key 时搜索会回退 OSM，广州小店常搜不到。"
        >
          <input
            className={inputClass}
            type="password"
            autoComplete="off"
            value={form.amapWebKey || ""}
            onChange={(e) => set("amapWebKey", e.target.value)}
            placeholder="Web 服务 Key"
          />
        </Field>
        {sectionSaveBar("geo")}
      </SettingsSection>
    </div>
  );
}

const LOCALE_OPTIONS: { id: string; label: string }[] = [
  { id: "zh-Hans", label: "简体中文" },
  { id: "zh-Hant", label: "繁體中文" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "ja", label: "日本語" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
  { id: "vi", label: "Tiếng Việt" },
  { id: "fil", label: "Filipino" },
  { id: "pt", label: "Português" },
];

function AiApiSection({
  form,
  set,
  open,
  onToggle,
  sectionSaveBar,
}: {
  form: PublicSettings;
  set: <K extends keyof PublicSettings>(key: K, value: PublicSettings[K]) => void;
  open: boolean;
  onToggle: (id: SettingsSectionId) => void;
  sectionSaveBar: (id: SettingsSectionId) => ReactNode;
}) {
  // 选中后自动填 Base URL + 默认模型；已保存值按 Base URL 反查预设
  const currentPreset = findProviderPreset({
    baseUrl: form.translateApiBaseUrl,
    model: form.translateApiModel,
  });

  return (
    <SettingsSection
      id="ai"
      title="AI 接口"
      summary={
        form.translateConfigured
          ? `${currentPreset.id === "custom" ? "自定义" : currentPreset.name} · ${form.translateApiModel || "未选模型"}`
          : "尚未配置 Key"
      }
      open={open}
      onToggle={onToggle}
    >
      <p className="text-sm text-[var(--muted)]">
        全站共用：一键翻译和 MathCode 识图转公式都走这里。选预设会自动填
        Base URL 与推荐模型；Key 只保存在本机数据库，不进代码仓库。
      </p>
      <Field
        label="AI 提供商"
        hint="选一个预设即自动填 Base URL 与推荐模型；也可选「自定义」手动填写。"
      >
        <select
          className={inputClass}
          value={currentPreset.id}
          onChange={(e) => {
            const preset = AI_PROVIDER_PRESETS.find(
              (p) => p.id === e.target.value,
            );
            if (!preset) return;
            if (preset.id === "custom") return;
            set("translateApiBaseUrl", preset.baseUrl);
            set("translateApiModel", preset.defaultModel);
          }}
        >
          {AI_PROVIDER_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.id === "custom"
                ? ""
                : ` · ${REGION_LABEL[p.region]}${p.vision ? " · 含视觉" : ""}`}
            </option>
          ))}
        </select>
      </Field>
      {currentPreset.notes || currentPreset.applyUrl ? (
        <p className="text-xs leading-6 text-[var(--muted)]">
          {currentPreset.notes}
          {currentPreset.applyUrl ? (
            <>
              {currentPreset.notes ? "　" : ""}
              <a
                className="text-[var(--brand)] hover:underline"
                href={currentPreset.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                申请 Key →
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Base URL"
          hint="OpenAI 兼容的 /chat/completions 前缀，通常预设已自动填好；改动会切到「自定义」"
        >
          <input
            className={inputClass}
            value={form.translateApiBaseUrl || ""}
            onChange={(e) => set("translateApiBaseUrl", e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </Field>
        <Field
          label="模型名"
          hint={
            currentPreset.models.length
              ? "可直接输入，或从下方推荐列表挑一个"
              : "手动填写模型 ID"
          }
        >
          <input
            className={inputClass}
            value={form.translateApiModel || ""}
            onChange={(e) => set("translateApiModel", e.target.value)}
            placeholder="gpt-4o-mini"
            list={`ai-models-${currentPreset.id}`}
          />
          {currentPreset.models.length ? (
            <datalist id={`ai-models-${currentPreset.id}`}>
              {currentPreset.models.map((m) => (
                <option key={m.id} value={m.id} label={m.label} />
              ))}
            </datalist>
          ) : null}
          {currentPreset.models.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {currentPreset.models.map((m) => {
                const active = form.translateApiModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => set("translateApiModel", m.id)}
                    className={
                      active
                        ? "min-h-11 rounded-full border border-[var(--brand)] bg-[var(--brand)]/12 px-3 py-1.5 text-[var(--brand)]"
                        : "min-h-11 rounded-full border border-[var(--line)] bg-white/60 px-3 py-1.5 text-[var(--muted)] hover:border-[var(--brand)]/60 hover:text-[var(--brand)]"
                    }
                    title={m.label}
                  >
                    {m.id}
                    {m.vision ? " 👁" : ""}
                    {m.recommended ? " ★" : ""}
                  </button>
                );
              })}
            </div>
          ) : null}
        </Field>
        <Field
          label="API Key"
          hint="已保存的密钥显示为打码；留空保存表示不修改"
        >
          <input
            className={inputClass}
            type="password"
            autoComplete="off"
            value={form.translateApiKey || ""}
            onChange={(e) => set("translateApiKey", e.target.value)}
            placeholder="sk-…"
          />
        </Field>
      </div>
      {sectionSaveBar("ai")}
    </SettingsSection>
  );
}

function LanguageTranslateSection({
  form,
  set,
  open,
  onToggle,
  sectionSaveBar,
  mergeSettingsResponse,
}: {
  form: PublicSettings;
  set: <K extends keyof PublicSettings>(key: K, value: PublicSettings[K]) => void;
  open: boolean;
  onToggle: (id: SettingsSectionId) => void;
  sectionSaveBar: (id: SettingsSectionId) => ReactNode;
  mergeSettingsResponse: (settings: Partial<PublicSettings>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [targetLocale, setTargetLocale] = useState("en");
  const [result, setResult] = useState("");
  const [force, setForce] = useState(false);

  async function runTranslate() {
    setBusy(true);
    setResult("");
    try {
      const res = await fetch("/api/studio/i18n/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: targetLocale, force }),
      });
      const data = (await res.json()) as {
        error?: string;
        done?: number;
        skipped?: number;
        failed?: number;
        total?: number;
        errors?: string[];
      };
      if (!res.ok) {
        setResult(data.error || "翻译失败");
        return;
      }
      setResult(
        `完成：成功 ${data.done ?? 0} · 跳过 ${data.skipped ?? 0} · 失败 ${data.failed ?? 0} / 共 ${data.total ?? 0}` +
          (data.errors?.length
            ? `\n${data.errors.slice(0, 5).join("\n")}`
            : ""),
      );
    } catch {
      setResult("网络错误");
    } finally {
      setBusy(false);
    }
  }

  function toggleLocale(id: string, checked: boolean) {
    const cur = form.enabledLocales || [];
    const next = checked
      ? Array.from(new Set([...cur, id]))
      : cur.filter((x) => x !== id);
    // 至少保留简体，避免整站无语言
    if (!next.includes("zh-Hans")) next.unshift("zh-Hans");
    set("enabledLocales", next);
  }

  return (
    <SettingsSection
      id="i18n"
      title="语言与翻译"
      summary={`回退 ${form.defaultLocale || "zh-Hans"} · 启用 ${form.enabledLocales?.length || 0} 种`}
      open={open}
      onToggle={onToggle}
    >
      <p className="text-sm text-[var(--muted)]">
        访客按浏览器语言自动匹配。界面词条与简繁转换免费；课程/约搭等正文一键翻译走「AI
        接口」里的 Key（按量计费），结果落库缓存。站长登录前台时会并排看到中文原文与译文。
      </p>
      <Field label="无匹配时的回退语言">
        <select
          className={inputClass}
          value={form.defaultLocale || "zh-Hans"}
          onChange={(e) => set("defaultLocale", e.target.value)}
        >
          {LOCALE_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="space-y-2">
        <span className="text-sm text-[var(--muted)]">已启用语种</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {LOCALE_OPTIONS.map((o) => (
            <label
              key={o.id}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-[var(--line)] bg-white/70 px-3 text-sm"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--brand)]"
                checked={(form.enabledLocales || []).includes(o.id)}
                onChange={(e) => toggleLocale(o.id, e.target.checked)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>
      {sectionSaveBar("i18n")}
      <div className="mt-4 space-y-3 rounded-2xl border border-[var(--line)] bg-white/50 p-4">
        <p className="text-sm font-medium text-[var(--ink)]">一键翻译正文</p>
        <p className="text-xs text-[var(--muted)]">
          将课程/约搭/分类/装扮/门户可见文案翻译到目标语言并缓存。繁体可走本地转换无需
          API；英语等需先在「AI 接口」保存 Key。
          {form.translateConfigured ? "" : " 当前尚未配置 Key。"}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">目标语言</span>
            <select
              className={`${inputClass} mt-1 min-w-[10rem]`}
              value={targetLocale}
              onChange={(e) => setTargetLocale(e.target.value)}
            >
              {LOCALE_OPTIONS.filter((o) => o.id !== "zh-Hans").map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--brand)]"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
            />
            强制重翻（忽略未过期缓存）
          </label>
          <button
            type="button"
            className="btn btn-primary min-h-11"
            disabled={busy}
            onClick={() => void runTranslate()}
          >
            {busy ? "翻译中…" : "开始一键翻译"}
          </button>
        </div>
        {result ? (
          <pre className="whitespace-pre-wrap text-xs text-[var(--muted)]">
            {result}
          </pre>
        ) : null}
      </div>
      {/* 保存后刷新打码状态 */}
      <button
        type="button"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onClick={() => mergeSettingsResponse({})}
      />
    </SettingsSection>
  );
}

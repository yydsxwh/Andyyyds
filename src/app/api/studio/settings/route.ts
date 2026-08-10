import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  DEFAULT_ORDER_FORM,
  stringifyOrderForm,
  type OrderFormFieldType,
} from "@/lib/order-form";
import { normalizePublicSiteUrl } from "@/lib/payments";
import {
  getSiteSettings,
  invalidateSiteSettingsCache,
  pickSecretUpdate,
  publicSiteSettings,
} from "@/lib/site-settings";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";
import { DEFAULT_UI_COPY, stringifyUiCopy } from "@/lib/ui-copy";

const composeCopySchema = z.object({
  step2Title: z.string().max(80).optional(),
  courseTypeLabel: z.string().max(40).optional(),
  columnTypeLabel: z.string().max(40).optional(),
  titleLabel: z.string().max(40).optional(),
  titlePlaceholderCourse: z.string().max(120).optional(),
  titlePlaceholderColumn: z.string().max(120).optional(),
  subtitleLabel: z.string().max(40).optional(),
  subtitlePlaceholder: z.string().max(120).optional(),
  descriptionLabel: z.string().max(40).optional(),
  descriptionPlaceholder: z.string().max(300).optional(),
  priceLabel: z.string().max(40).optional(),
  pricePlaceholder: z.string().max(40).optional(),
  priceHint: z.string().max(120).optional(),
  groupByCategoryLabel: z.string().max(80).optional(),
  publishLabel: z.string().max(80).optional(),
  submitLabelCourse: z.string().max(80).optional(),
  submitLabelColumn: z.string().max(80).optional(),
});

const patchSchema = z.object({
  siteUrl: z.string().max(300).optional(),
  paymentMode: z.enum(["auto", "mock", "wechat", "alipay", "both"]).optional(),
  wechatEnabled: z.boolean().optional(),
  alipayEnabled: z.boolean().optional(),
  wechatAppId: z.string().max(128).optional(),
  wechatAppSecret: z.string().max(128).optional(),
  wechatWebAppId: z.string().max(128).optional(),
  wechatWebAppSecret: z.string().max(128).optional(),
  wechatMchId: z.string().max(64).optional(),
  wechatApiV3Key: z.string().max(128).optional(),
  wechatMchSerialNo: z.string().max(128).optional(),
  wechatMchPrivateKey: z.string().max(10000).optional(),
  alipayAppId: z.string().max(64).optional(),
  alipayPrivateKey: z.string().max(10000).optional(),
  alipayPublicKey: z.string().max(10000).optional(),
  alipayGateway: z.enum(["production", "sandbox"]).optional(),
  storageProvider: z.enum(["LOCAL", "ALIYUN_OSS"]).optional(),
  ossRegion: z.string().max(64).optional(),
  ossBucket: z.string().max(128).optional(),
  ossAccessKeyId: z.string().max(128).optional(),
  ossAccessKeySecret: z.string().max(128).optional(),
  ossEndpoint: z.string().max(300).optional(),
  ossPublicBaseUrl: z.string().max(300).optional(),
  ossPrefix: z.string().max(120).optional(),
  videoStorageProvider: z.enum(["LOCAL", "ALIYUN_VOD"]).optional(),
  vodRegionId: z.string().max(64).optional(),
  vodAccessKeyId: z.string().max(128).optional(),
  vodAccessKeySecret: z.string().max(128).optional(),
  vodTemplateGroupId: z.string().max(128).optional(),
  vodPlayDomain: z.string().max(300).optional(),
  merchantPlatformCutPercent: z.number().int().min(0).max(100).optional(),
  agentShareOfPlatformCutPercent: z.number().int().min(0).max(100).optional(),
  agentBuyerOrderPercent: z.number().int().min(0).max(100).optional(),
  teacherDistributionPercent: z.number().int().min(0).max(100).optional(),
  userDistributionPercent: z.number().int().min(0).max(100).optional(),
  hideAllPrices: z.boolean().optional(),
  hideSocialChat: z.boolean().optional(),
  defaultLocale: z.string().max(16).optional(),
  enabledLocales: z.array(z.string().max(16)).max(20).optional(),
  translateApiBaseUrl: z.string().max(300).optional(),
  translateApiKey: z.string().max(500).optional(),
  translateApiModel: z.string().max(128).optional(),
  smsEnabled: z.boolean().optional(),
  smsProvider: z.enum(["test", "aliyun"]).optional(),
  smsAccessKeyId: z.string().max(128).optional(),
  smsAccessKeySecret: z.string().max(128).optional(),
  smsSignName: z.string().max(64).optional(),
  smsTemplateCode: z.string().max(64).optional(),
  smsTestMode: z.boolean().optional(),
  smsTestFixedCode: z.string().max(8).optional(),
  uiCopy: z
    .object({
      compose: composeCopySchema.optional(),
    })
    .optional(),
  orderForm: z
    .object({
      enabled: z.boolean().optional(),
      title: z.string().max(40).optional(),
      fields: z
        .array(
          z.object({
            id: z.string().min(1).max(64),
            label: z.string().min(1).max(40),
            placeholder: z.string().max(80).optional(),
            type: z.enum(["text", "textarea", "select", "date"]),
            required: z.boolean(),
            enabled: z.boolean().optional(),
            options: z.array(z.string().max(80)).max(50).optional(),
          }),
        )
        .max(30)
        .optional(),
    })
    .optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const row = await getSiteSettings();
    return NextResponse.json({ settings: publicSiteSettings(row) });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = patchSchema.parse(await req.json());
    const current = await getSiteSettings();

    const data: Record<string, unknown> = {};
    const plainKeys = [
      "siteUrl",
      "paymentMode",
      "wechatEnabled",
      "alipayEnabled",
      "wechatAppId",
      "wechatWebAppId",
      "wechatMchId",
      "wechatMchSerialNo",
      "alipayAppId",
      "alipayGateway",
      "storageProvider",
      "ossRegion",
      "ossBucket",
      "ossAccessKeyId",
      "ossEndpoint",
      "ossPublicBaseUrl",
      "ossPrefix",
      "videoStorageProvider",
      "vodRegionId",
      "vodAccessKeyId",
      "vodTemplateGroupId",
      "vodPlayDomain",
      "merchantPlatformCutPercent",
      "agentShareOfPlatformCutPercent",
      "agentBuyerOrderPercent",
      "teacherDistributionPercent",
      "userDistributionPercent",
      "hideAllPrices",
      "hideSocialChat",
      "defaultLocale",
      "translateApiBaseUrl",
      "translateApiModel",
      "smsEnabled",
      "smsProvider",
      "smsAccessKeyId",
      "smsSignName",
      "smsTemplateCode",
      "smsTestMode",
      "smsTestFixedCode",
    ] as const;

    for (const key of plainKeys) {
      if (body[key] !== undefined) {
        data[key] =
          typeof body[key] === "string" ? String(body[key]).trim() : body[key];
      }
    }

    if (body.enabledLocales) {
      data.enabledLocalesJson = JSON.stringify(body.enabledLocales);
    }

    const secretKeys = [
      ["wechatAppSecret", body.wechatAppSecret],
      ["wechatWebAppSecret", body.wechatWebAppSecret],
      ["wechatApiV3Key", body.wechatApiV3Key],
      ["wechatMchPrivateKey", body.wechatMchPrivateKey],
      ["alipayPrivateKey", body.alipayPrivateKey],
      ["alipayPublicKey", body.alipayPublicKey],
      ["ossAccessKeySecret", body.ossAccessKeySecret],
      ["vodAccessKeySecret", body.vodAccessKeySecret],
      ["smsAccessKeySecret", body.smsAccessKeySecret],
      ["translateApiKey", body.translateApiKey],
    ] as const;

    for (const [key, incoming] of secretKeys) {
      const currentValue = String(
        (current as unknown as Record<string, unknown>)[key] ?? "",
      );
      const next = pickSecretUpdate(incoming, currentValue);
      if (next !== undefined) data[key] = next;
    }

    if (body.uiCopy?.compose) {
      data.uiCopyJson = stringifyUiCopy({
        compose: {
          ...DEFAULT_UI_COPY.compose,
          ...body.uiCopy.compose,
        },
      });
    }

    if (body.orderForm) {
      const fields = (body.orderForm.fields || []).map((f) => ({
        id: f.id,
        label: f.label.trim(),
        placeholder: (f.placeholder || "").trim(),
        type: f.type as OrderFormFieldType,
        required: f.required,
        // 缺省启用：兼容旧设置页未传 enabled 的保存请求
        enabled: f.enabled !== false,
        options: (f.options || []).map((o) => o.trim()).filter(Boolean),
      }));
      data.orderFormJson = stringifyOrderForm({
        enabled:
          body.orderForm.enabled ??
          (fields.length > 0 ? true : DEFAULT_ORDER_FORM.enabled),
        title: (body.orderForm.title || DEFAULT_ORDER_FORM.title).trim(),
        fields,
      });
    }

    if (typeof data.siteUrl === "string") {
      data.siteUrl = normalizePublicSiteUrl(data.siteUrl);
    }

    const row = await prisma.siteSettings.update({
      where: { id: "default" },
      data,
    });
    invalidateSiteSettingsCache();

    return NextResponse.json({ settings: publicSiteSettings(row) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

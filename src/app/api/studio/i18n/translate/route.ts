import { NextResponse } from "next/server";
import { z } from "zod";
import { collectAllTranslateItems } from "@andyyyds/shared/i18n/collect-translate-items";
import { translateItemsToLocale } from "@andyyyds/shared/i18n/content-translate";
import { isAppLocale, SOURCE_LOCALE } from "@andyyyds/shared/i18n/locales";
import { getSiteSettings } from "@andyyyds/shared/site-settings";
import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";

export const dynamic = "force-dynamic";
/** 一键翻译可能较久 */
export const maxDuration = 300;

const bodySchema = z.object({
  /** 目标语言；默认 en */
  locale: z.string().optional(),
  /** 强制重翻（忽略未过期缓存） */
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const localeRaw = (body.locale || "en").trim();
    if (!isAppLocale(localeRaw) || localeRaw === SOURCE_LOCALE) {
      return NextResponse.json(
        { error: "请选择有效的目标语言（非简体中文）" },
        { status: 400 },
      );
    }

    const settings = await getSiteSettings();
    const apiKey = String(
      (settings as { translateApiKey?: string }).translateApiKey || "",
    ).trim();
    const baseUrl = String(
      (settings as { translateApiBaseUrl?: string }).translateApiBaseUrl ||
        "https://api.openai.com/v1",
    ).trim();
    const model = String(
      (settings as { translateApiModel?: string }).translateApiModel ||
        "gpt-4o-mini",
    ).trim();

    if (localeRaw !== "zh-Hant" && !apiKey) {
      return NextResponse.json(
        {
          error:
            "请先在系统设置「语言与翻译」中配置翻译 API Key（OpenAI 兼容接口）",
        },
        { status: 400 },
      );
    }

    const items = await collectAllTranslateItems();
    const progress = await translateItemsToLocale({
      items,
      targetLocale: localeRaw,
      baseUrl,
      apiKey,
      model,
      skipFresh: !body.force,
    });

    return NextResponse.json({
      ok: true,
      locale: localeRaw,
      ...progress,
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

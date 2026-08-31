/**
 * 正文一键翻译：OpenAI 兼容 Chat Completions，结果写入 ContentTranslation。
 * 未配置 API Key 时抛错，由调用方提示站长。
 */
import { prisma } from "@andyyyds/shared/db";
import {
  LOCALE_LABELS,
  SOURCE_LOCALE,
  type AppLocale,
} from "@andyyyds/shared/i18n/locales";
import { hashSourceText } from "@andyyyds/shared/i18n/source-hash";
import { toTraditionalChinese } from "@andyyyds/shared/i18n/opencc";

export type TranslateJobItem = {
  entityType: string;
  entityId: string;
  field: string;
  source: string;
  isHtml?: boolean;
};

export type TranslateProgress = {
  total: number;
  done: number;
  skipped: number;
  failed: number;
  errors: string[];
};

function trimBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function callTranslateApi(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  sourceText: string;
  targetLocale: AppLocale;
  isHtml?: boolean;
}): Promise<string> {
  const targetName = LOCALE_LABELS[input.targetLocale] || input.targetLocale;
  const system = input.isHtml
    ? `You are a professional translator. Translate the user's HTML from Simplified Chinese into natural, accurate ${targetName}. Preserve all HTML tags and attributes exactly; only translate visible text. Return only the translated HTML, no markdown fences.`
    : `You are a professional translator. Translate the user's text from Simplified Chinese into natural, accurate ${targetName}. Return only the translation, no quotes or explanations.`;

  const base = trimBaseUrl(input.baseUrl || "https://api.openai.com/v1");
  const url = `${base}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: input.sourceText },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`翻译 API 失败 ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim() || "";
  if (!text) throw new Error("翻译 API 返回空内容");
  return text;
}

/** 写入或更新一条译文 */
export async function upsertTranslation(input: {
  entityType: string;
  entityId: string;
  field: string;
  locale: AppLocale;
  source: string;
  text: string;
}) {
  const sourceHash = hashSourceText(input.source);
  await prisma.contentTranslation.upsert({
    where: {
      entityType_entityId_field_locale: {
        entityType: input.entityType,
        entityId: input.entityId,
        field: input.field,
        locale: input.locale,
      },
    },
    create: {
      entityType: input.entityType,
      entityId: input.entityId,
      field: input.field,
      locale: input.locale,
      sourceHash,
      text: input.text,
      stale: false,
    },
    update: {
      sourceHash,
      text: input.text,
      stale: false,
    },
  });
}

/**
 * 批量翻译 items 到 targetLocale。
 * zh-Hant 走 OpenCC（免费）；其他语种走 API。
 */
export async function translateItemsToLocale(input: {
  items: TranslateJobItem[];
  targetLocale: AppLocale;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 已有未过期译文则跳过 */
  skipFresh?: boolean;
  onProgress?: (p: TranslateProgress) => void;
}): Promise<TranslateProgress> {
  const progress: TranslateProgress = {
    total: input.items.length,
    done: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  if (input.targetLocale === SOURCE_LOCALE) {
    progress.skipped = input.items.length;
    return progress;
  }

  for (const item of input.items) {
    const source = (item.source || "").trim();
    if (!source) {
      progress.skipped += 1;
      input.onProgress?.(progress);
      continue;
    }
    try {
      const sourceHash = hashSourceText(source);
      if (input.skipFresh !== false) {
        const existing = await prisma.contentTranslation.findUnique({
          where: {
            entityType_entityId_field_locale: {
              entityType: item.entityType,
              entityId: item.entityId,
              field: item.field,
              locale: input.targetLocale,
            },
          },
        });
        if (
          existing &&
          !existing.stale &&
          existing.sourceHash === sourceHash &&
          existing.text
        ) {
          progress.skipped += 1;
          input.onProgress?.(progress);
          continue;
        }
      }

      let text: string;
      if (input.targetLocale === "zh-Hant") {
        text = await toTraditionalChinese(source);
      } else {
        if (!input.apiKey.trim()) {
          throw new Error("未配置翻译 API Key");
        }
        text = await callTranslateApi({
          baseUrl: input.baseUrl,
          apiKey: input.apiKey,
          model: input.model,
          sourceText: source,
          targetLocale: input.targetLocale,
          isHtml: item.isHtml,
        });
      }

      await upsertTranslation({
        entityType: item.entityType,
        entityId: item.entityId,
        field: item.field,
        locale: input.targetLocale,
        source,
        text,
      });
      progress.done += 1;
    } catch (e) {
      progress.failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      progress.errors.push(
        `${item.entityType}:${item.entityId}.${item.field}: ${msg}`,
      );
    }
    input.onProgress?.(progress);
  }

  return progress;
}

/** 源文变更时把各 locale 标为 stale */
export async function markTranslationsStale(input: {
  entityType: string;
  entityId: string;
  field: string;
  source: string;
}) {
  const sourceHash = hashSourceText(input.source);
  await prisma.contentTranslation.updateMany({
    where: {
      entityType: input.entityType,
      entityId: input.entityId,
      field: input.field,
      NOT: { sourceHash },
    },
    data: { stale: true },
  });
}

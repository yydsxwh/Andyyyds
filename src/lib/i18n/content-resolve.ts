import { prisma } from "@/lib/db";
import {
  SOURCE_LOCALE,
  type AppLocale,
} from "@/lib/i18n/locales";
import { toTraditionalChinese } from "@/lib/i18n/opencc";
import { hashSourceText } from "@/lib/i18n/source-hash";

export type ResolvedText = {
  /** 访客看到的文案 */
  text: string;
  /** 简体原文（站长双语用） */
  source: string;
  locale: AppLocale;
  fromCache: boolean;
};

/**
 * 解析业务字段展示文案：
 * zh-Hans → 原文；zh-Hant → 缓存或 OpenCC；其他 → 缓存译文，否则原文。
 */
export async function resolveContentText(input: {
  entityType: string;
  entityId: string;
  field: string;
  source: string;
  locale: AppLocale;
}): Promise<ResolvedText> {
  const source = input.source ?? "";
  if (!source || input.locale === SOURCE_LOCALE) {
    return {
      text: source,
      source,
      locale: input.locale,
      fromCache: false,
    };
  }

  const sourceHash = hashSourceText(source);
  const row = await prisma.contentTranslation.findUnique({
    where: {
      entityType_entityId_field_locale: {
        entityType: input.entityType,
        entityId: input.entityId,
        field: input.field,
        locale: input.locale,
      },
    },
  });

  if (row && !row.stale && row.sourceHash === sourceHash && row.text) {
    return {
      text: row.text,
      source,
      locale: input.locale,
      fromCache: true,
    };
  }

  // 繁体：无缓存时本地转换（免费）
  if (input.locale === "zh-Hant") {
    const text = await toTraditionalChinese(source);
    return { text, source, locale: input.locale, fromCache: false };
  }

  return {
    text: source,
    source,
    locale: input.locale,
    fromCache: false,
  };
}

/** 批量解析同实体多字段 */
export async function resolveContentFields(input: {
  entityType: string;
  entityId: string;
  fields: Record<string, string>;
  locale: AppLocale;
}): Promise<Record<string, ResolvedText>> {
  const out: Record<string, ResolvedText> = {};
  await Promise.all(
    Object.entries(input.fields).map(async ([field, source]) => {
      out[field] = await resolveContentText({
        entityType: input.entityType,
        entityId: input.entityId,
        field,
        source,
        locale: input.locale,
      });
    }),
  );
  return out;
}

/** JSON 配置里扁平字符串字段的解析（decorate / portal 等） */
export async function resolveJsonStringField(input: {
  entityType: string;
  entityId: string;
  field: string;
  source: string;
  locale: AppLocale;
}): Promise<string> {
  const r = await resolveContentText(input);
  return r.text;
}

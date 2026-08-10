import { BilingualHover } from "@/components/i18n/bilingual-hover";
import type { AppLocale } from "@/lib/i18n/locales";

/**
 * 站长前台：默认中文原文，英文悬浮展示；普通访客只看 text。
 * source=中文，text=英文译文（contentLocale 解析结果）。
 */
export function BilingualText({
  source,
  text,
  bilingual,
  locale: _locale,
  className,
  as: Tag = "span",
}: {
  source: string;
  text: string;
  bilingual: boolean;
  locale: AppLocale;
  className?: string;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "div";
}) {
  void _locale;
  if (!bilingual || !source) {
    return <Tag className={className}>{text || source}</Tag>;
  }

  const hasTranslation = Boolean(text && text !== source);
  return (
    <BilingualHover
      as={Tag === "div" ? "div" : Tag}
      className={className}
      primary={source}
      secondary={
        hasTranslation ? text : "No English yet — translate in Studio settings"
      }
    />
  );
}

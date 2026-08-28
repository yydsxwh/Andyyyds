/**
 * MathCode 公式识别：OpenAI 兼容 Chat Completions（Vision）
 *
 * 复用系统设置里「语言与翻译」的 baseUrl/apiKey，避免站长在两处填 Key；
 * 但视觉能力对模型有要求，所以另用一个模型字段（默认 gpt-4o-mini，视觉可用）。
 * 也支持 ENV 覆盖，便于站长单独接入具备视觉能力的 Key/模型：
 *   MATHCODE_API_KEY    覆盖 API Key（不填→回落系统设置里的翻译 Key）
 *   MATHCODE_API_BASE   覆盖 Base URL（不填→回落翻译 Base，再回落 OpenAI 官方）
 *   MATHCODE_MODEL      覆盖模型（不填→gpt-4o-mini）
 */

import { getSiteSettings } from "@/lib/site-settings";
import { sanitizeLatexBody } from "@/lib/mathcode-doc";

export type MathcodeProvider = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_BASE = "https://api.openai.com/v1";

function trimBase(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function resolveMathcodeProvider(): Promise<MathcodeProvider> {
  const envKey = String(process.env.MATHCODE_API_KEY || "").trim();
  const envBase = String(process.env.MATHCODE_API_BASE || "").trim();
  const envModel = String(process.env.MATHCODE_MODEL || "").trim();

  const settings = await getSiteSettings();
  const settingsKey = String(
    (settings as { translateApiKey?: string }).translateApiKey || "",
  ).trim();
  const settingsBase = String(
    (settings as { translateApiBaseUrl?: string }).translateApiBaseUrl || "",
  ).trim();
  const settingsModel = String(
    (settings as { translateApiModel?: string }).translateApiModel || "",
  ).trim();

  const apiKey = envKey || settingsKey;
  const baseUrl = trimBase(envBase || settingsBase || DEFAULT_BASE);
  // 复用系统设置里选好的模型（比如站长把「翻译」选成了 qwen-vl-plus，
  // MathCode 就该用 qwen-vl-plus 而不是硬套 gpt-4o-mini 去请求错的服务商）；
  // 只有站长没选任何模型时才回落到 OpenAI 默认，避免面板留空导致崩。
  const model = envModel || settingsModel || DEFAULT_MODEL;

  return { apiKey, baseUrl, model };
}

const SYSTEM_PROMPT = [
  "You are a lossless full-page OCR engine. Your job is to copy EVERY visible character from the image into LaTeX.",
  "NEVER extract formulas only. NEVER summarize. NEVER skip prose, captions, page numbers, watermarks, stamps, or side notes.",
  "Keep text in the original language: Chinese, English, Japanese, Korean, French, German, Spanish, Russian, Arabic, Thai, Vietnamese, and any other script. Do not translate.",
  "Output rules:",
  "1. Return LaTeX body only. No greetings, no markdown fences, no commentary.",
  "2. Ordinary text (any language) stays as UTF-8 prose outside math mode. Do not wrap whole paragraphs in \\text{...}.",
  "3. Only mathematical / chemical expressions go into math mode: $...$ inline, $$...$$ or equation environment for display.",
  "4. Preserve reading order and structure: titles \\section*{...}, lists itemize/enumerate, paragraphs separated by a blank line.",
  "5. Mixed lines like「已知 $a+b=c$，求 $a$」: keep the words, wrap only the math.",
  "6. Chemistry: \\ce{...}; units: \\pu{...}; visible equation numbers: \\tag{...}.",
  "7. If you cannot read a glyph, write [?] in place — still do not drop the surrounding sentence.",
  "8. Empty image → empty string. Otherwise the output length should roughly match the amount of text in the image.",
].join("\n");

const USER_PROMPT = [
  "请把这张图里的全部可见内容转成 LaTeX，不要只转公式。",
  "要求：图上每一个字都要留下，包括中文、英文及其它任何语言的标题、段落、题号、注释、页眉页脚；公式才进数学模式。",
  "禁止翻译、禁止摘要、禁止只输出方程式。只返回 LaTeX 正文。",
  "Transcribe ALL visible text in every language. Formulas become math mode; everything else stays as plain UTF-8 LaTeX. Return LaTeX only.",
].join("\n");

export async function callMathcodeOcr(input: {
  provider: MathcodeProvider;
  imageDataUrl: string;
}): Promise<string> {
  const { provider, imageDataUrl } = input;
  const url = `${provider.baseUrl}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0,
      // 整页含中文叙述时输出更长，给足额度避免截断正文
      max_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: USER_PROMPT },
            {
              type: "image_url",
              image_url: { url: imageDataUrl },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `MathCode 识别失败 ${res.status}: ${body.slice(0, 400) || res.statusText}`,
    );
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = (data.choices?.[0]?.message?.content || "").trim();
  return sanitizeLatexBody(stripCodeFences(raw));
}

/** 兼容部分模型仍会包 ```latex ... ``` 的情况，剥去外壳后仍是纯 LaTeX */
function stripCodeFences(text: string): string {
  const fence = /^```(?:latex|tex|math)?\s*([\s\S]*?)\s*```$/i;
  const m = text.match(fence);
  return m ? m[1].trim() : text;
}

export { wrapAsLatexDocument } from "@/lib/mathcode-doc";

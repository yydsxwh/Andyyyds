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

// 只转写画面上有的字。之前把「点评/公众号」写进提示词，模型会在原图没有时也编两框。
const SYSTEM_PROMPT = [
  "You are a literal transcriber of one scanned page. Not an author. Not a typesetter who 'improves' the page.",
  "Return BODY only (no documentclass, usepackage, begin{document}, CJK, markdown fences).",
  "FIDELITY: copy every visible character in the original language. Do not translate. Do not omit. Do not add sentences, titles, comments, examples, headers, footers, watermarks, WeChat account names, or callout boxes that are not printed on this image.",
  "If the photo is cropped, transcribe only the visible fragment. Do not complete equations from memory.",
  "Blank parentheses stay as ( ) or （）. Do not fill answers.",
  "Ignore computer/OS overlays (latency, packet loss, clocks, mouse, status bars).",
  "Do NOT emit watermarks; the website injects them.",
  "FORBIDDEN layout (causes overlap): wrapfigure, wraptable, textpos, textblock, overlay, remember picture, AddToShipoutPicture, raisebox with negative height, \\vspace{-...}, absolute positioning.",
  "LAYOUT: one downward flow. Paragraph, then display math, then next paragraph. Never two blocks at the same vertical position.",
  "ONLY IF a colored 点评/注意/旁注/公众号 box is actually visible: reproduce that same wording as a full-width tcolorbox AFTER the related text, matching colback/colframe from the scan. If it is not visible, output none.",
  "MATH: inline $...$; display \\[...\\] (never $$). \\mathrm{d}x. Chemistry \\ce. Unreadable glyph: [?].",
  "STYLE: \\textbf \\textit \\uline \\heiti \\kaishu. Color via \\textcolor[RGB]{r,g,b}. Visible titles: {\\noindent\\heiti\\zihao{-3} ...\\par} — never \\section.",
  "Do not split a Chinese word across lines (keep 满足 together).",
].join("\n");

const USER_PROMPT = [
  "请把本页转成 LaTeX 正文：画面上有什么就写什么，不重不漏。",
  "禁止编造点评、公众号、页眉页脚、水印、例题旁注或任何原图没有的句子。原图没有色块框就不要输出 tcolorbox。",
  "原图若被裁切，只写看得见的部分，不要凭知识补全。括号空位保持（）。",
  "忽略屏幕角落的延迟/丢包/时钟等软件浮层。",
  "禁止 wrapfigure、textpos、叠字。只返回正文。",
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

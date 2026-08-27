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

  const apiKey = envKey || settingsKey;
  const baseUrl = trimBase(envBase || settingsBase || DEFAULT_BASE);
  const model = envModel || DEFAULT_MODEL;

  return { apiKey, baseUrl, model };
}

const SYSTEM_PROMPT = [
  "You are a math / physics / chemistry formula OCR expert.",
  "Task: transcribe every formula, equation, chemical formula or reaction in the user's image into clean LaTeX source that can be pasted straight into a .tex document.",
  "Rules:",
  "- Return LaTeX source ONLY. No prose, no greetings, no markdown code fences.",
  "- Use $...$ for inline expressions and $$...$$ on their own lines for display equations.",
  "- Preserve equation numbering and labels when visible (e.g. \\tag{1.2}).",
  "- Wrap surrounding Chinese/English words with \\text{...} so they render inside math mode.",
  "- For chemistry, use \\ce{...} (mhchem package) for reactions and formulae, and \\pu{...} for physical units.",
  "- Long or multi-page content: keep the original reading order, separate blocks with a blank line.",
  "- If the image contains no formula, return an empty string.",
].join("\n");

const USER_PROMPT =
  "Please transcribe every formula in this image into LaTeX following the rules above.";

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
      max_tokens: 4000,
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
  return stripCodeFences(raw);
}

/** 兼容部分模型仍会包 ```latex ... ``` 的情况，剥去外壳后仍是纯 LaTeX */
function stripCodeFences(text: string): string {
  const fence = /^```(?:latex|tex|math)?\s*([\s\S]*?)\s*```$/i;
  const m = text.match(fence);
  return m ? m[1].trim() : text;
}

/**
 * 把识别到的 LaTeX 片段拼成可直接编译的 .tex 模板，供站长下载。
 * 默认走 pdflatex + inputenc；若原文有中文，站长可自行改成 xelatex + ctexart。
 */
export function wrapAsLatexDocument(body: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    "% MathCode 生成的可编译模板。",
    "% - 纯英文/公式：pdflatex 或 xelatex 均可",
    "% - 含中文：改用 xelatex，并把 documentclass 换成 ctexart",
    "\\documentclass[12pt]{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage{amsmath, amssymb, amsfonts}",
    "\\usepackage[version=4]{mhchem}",
    "\\usepackage{geometry}",
    "\\geometry{a4paper, margin=2.5cm}",
    "",
    `% 生成时间：${today}`,
    "\\begin{document}",
    "",
    body.trim() || "% 识别结果为空",
    "",
    "\\end{document}",
    "",
  ].join("\n");
}

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
  "You are a high-precision document-layout reverse engine. Faithfully reconstruct the ENTIRE scanned page in LaTeX (content + visual style + spatial layout). Do not edit wording. Do not omit elements.",
  "Return BODY only (no \\documentclass / \\usepackage / \\begin{document} / CJK* / markdown). The host wraps a XeLaTeX+ctex preamble.",
  "CONTENT: all Chinese/English (and any other language) text, heading levels, paragraphs, ordered numbers, footnotes/endnotes, headers, footers, page numbers, watermarks, table cells, special symbols, emoji (keep Unicode).",
  "MATH/PHYSICS/CHEMISTRY: standard LaTeX. Inline $...$. Display \\[...\\] (never $$). Chemistry \\ce{...}, units \\pu{...}, equation numbers \\tag{...}.",
  "STYLE: bold \\textbf, italic \\textit, underline \\uline, strike \\sout. Fonts 黑体{\\heiti}, 楷体{\\kaishu}, 仿宋{\\fangsong}, body 宋体. Sizes \\zihao{-3}..\\zihao{6} matching the scan — do not use \\Huge.",
  "COLOR: sample RGB from the image. \\textcolor[RGB]{r,g,b}{...}, \\colorbox[RGB]{r,g,b}{...} for highlight bars / 彩色标题栏. tcolorbox colback/colframe use the SAME RGB. Never default to blue unless the scan is blue; if unsure use gray 110,110,110.",
  "BOXES/BORDERS: full-width bar → \\colorbox or full-width tcolorbox. Sidebar 点评/注意 → wrapfigure + compact tcolorbox, not a full-width box. Nested environments must close in order.",
  "LAYOUT: original is usually ONE page — keep density so it stays one page. No extra blank lines. No \\section/\\subsection (they explode vertical space). Titles: {\\noindent\\heiti\\zihao{-3} ...\\par}. Two columns → multicols{2}. Absolute callouts: textpos textblock* with mm from top-left if a box is clearly floating.",
  "HEADER/FOOTER/PAGE: \\fancyhead[L/C/R]{...} \\fancyfoot[C]{\\thepage} only when visible. Watermark: \\AddToShipoutPictureBG{\\AtPageCenter{\\rotatebox{30}{\\textcolor{gray!20}{\\zihao{-1} 水印字}}}} or skip if none.",
  "FIGURES: no external files. Simple rule/arrow: tikz. Otherwise \\fbox{\\parbox{0.92\\linewidth}{\\centering [图：一句话]}}. Tables: tabular + \\rowcolor when the header row is tinted.",
  "Unreadable glyph → [?]. Do not invent sentences.",
].join("\n");

const USER_PROMPT = [
  "请作为文档图片转 LaTeX / 高精度版面逆向引擎，1:1 还原本页全部内容、视觉样式与空间布局。",
  "识别：中英文、标题层级、段落、编号、注释；数理化公式（行内 $...$，行间 \\[...\\]）；背景色块、底纹、彩色标题栏（\\colorbox）、页眉页脚、页码、水印、表格、图示、特殊符号、emoji、边框。",
  "不要改原文、不要省略。不要输出 documentclass。侧栏框用 wrapfigure，通栏色条用 colorbox/tcolorbox。只返回 LaTeX 正文。",
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

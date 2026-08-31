/**
 * MathCode 可编译文档：XeLaTeX + ctex，前后端都能用。
 * 不要在此文件 import 数据库 / 站点设置。
 */

/** 剥外壳、修断行命令、把 $$ 换成标准行间公式 \[\] */
export function sanitizeLatexBody(text: string): string {
  let s = text.replace(/\r\n/g, "\n").trim();
  const fence = /^```(?:latex|tex|math)?\s*([\s\S]*?)\s*```$/i;
  const m = s.match(fence);
  if (m) s = m[1].trim();

  s = s
    .replace(/\\begin\{document\}/gi, "")
    .replace(/\\end\{document\}/gi, "")
    .replace(/\\begin\{CJK\*?\}[^\n]*/gi, "")
    .replace(/\\end\{CJK\*?\}/gi, "")
    .replace(/\\documentclass[\s\S]*?\{[^}]+\}\s*/i, "")
    .replace(/\\usepackage(?:\s*\[[^\]]*\])?\s*\{[^}]+\}/g, "")
    .replace(/\\tcbuselibrary\{[^}]+\}/g, "")
    .replace(/\\geometry\{[^}]+\}/g, "")
    .replace(/\\setmainfont[\s\S]*?\n/g, "")
    .trim();

  s = s.replace(
    /\\(chapter|section|subsection|subsubsection|paragraph|subparagraph|textbf|textit|emph|textrm|texttt|textcolor|colorbox|uline|sout|heiti|kaishu|songti|fangsong|ce|pu|tag|label|mathrm|mathbf|fancyhead|fancyfoot)\s*\n\s*(\*?\{)/g,
    "\\$1$2",
  );
  s = s.replace(
    /\\(section|subsection|subsubsection)\s+(\*)\s*\{/g,
    "\\$1$2{",
  );
  s = s.replace(
    /\\(begin|end|usepackage|documentclass|geometry)\s*\n\s*([\[{])/g,
    "\\$1$2",
  );

  // article/ctexart 的 \section* 会撑高版心；改成字号标题，版面更接近教辅
  s = s.replace(
    /\\section\*\{([^}]*)\}/g,
    "{\\noindent\\heiti\\zihao{-3} $1\\par}\\vspace{0.35em}\n",
  );
  s = s.replace(
    /\\subsection\*\{([^}]*)\}/g,
    "{\\noindent\\heiti\\zihao{4} $1\\par}\\vspace{0.2em}\n",
  );
  s = s.replace(
    /\\subsubsection\*\{([^}]*)\}/g,
    "{\\noindent\\heiti\\zihao{-4} $1\\par}\\vspace{0.15em}\n",
  );

  // wrapfig / textpos 叠在行间公式上会「框压字」；拆成普通流式内容
  s = s.replace(
    /\\begin\{wrapfigure\}(?:\{[^}]*\}){0,2}\s*([\s\S]*?)\\end\{wrapfigure\}/gi,
    "\n$1\n",
  );
  s = s.replace(
    /\\begin\{textblock\*?\}[^\n]*\n([\s\S]*?)\\end\{textblock\*?\}/gi,
    "\n$1\n",
  );
  s = s.replace(/\\AddToShipoutPicture(?:BG|FG)?\{[\s\S]*?\}\s*/g, "");

  // 行间公式统一为 \[...\]（保留行内 $...$）
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, "\\[$1\\]");

  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/**
 * 完整 XeLaTeX + ctex 工程模板（Overleaf 须选 Compiler = XeLaTeX）。
 * 完整 XeLaTeX + ctex。不用 wrapfig/textpos：绝对定位会把色块框叠在公式上。
 */
export type WatermarkPosition =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "tl"
  | "tr"
  | "bl"
  | "br";

export type MathcodeWatermark = {
  textEnabled: boolean;
  text: string;
  imageEnabled: boolean;
  /** Overleaf 项目里的图片文件名，默认 watermark.png */
  imageFileName: string;
  /** 0=水平，正数逆时针倾斜 */
  angle: number;
  position: WatermarkPosition;
  rows: number;
  cols: number;
  /** 8–40，越大越明显 */
  opacityPercent: number;
  /** ctex 字号，如 2、-1、3 */
  zihao: string;
  imageWidthCm: number;
};

export const DEFAULT_WATERMARK: MathcodeWatermark = {
  textEnabled: false,
  text: "内部资料",
  imageEnabled: false,
  imageFileName: "watermark.png",
  angle: 30,
  position: "center",
  rows: 1,
  cols: 1,
  opacityPercent: 12,
  zihao: "2",
  imageWidthCm: 3.2,
};

function escapeLatexText(raw: string): string {
  return raw
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}$&#%_])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** 单枚水印在 A4 上的坐标（cm，原点页脚左下） */
function positionCm(pos: WatermarkPosition): { x: number; y: number } {
  switch (pos) {
    case "tl":
      return { x: 3.2, y: 26.4 };
    case "tr":
      return { x: 17.8, y: 26.4 };
    case "bl":
      return { x: 3.2, y: 3.2 };
    case "br":
      return { x: 17.8, y: 3.2 };
    case "top":
      return { x: 10.5, y: 26.6 };
    case "bottom":
      return { x: 10.5, y: 3.0 };
    case "left":
      return { x: 3.0, y: 14.85 };
    case "right":
      return { x: 18.0, y: 14.85 };
    default:
      return { x: 10.5, y: 14.85 };
  }
}

/**
 * 水印画在 shipout 背景层，不占正文位置、不压公式（浅灰 + 低透明度）。
 */
export function buildWatermarkPreamble(wm: MathcodeWatermark | undefined): string {
  if (!wm || (!wm.textEnabled && !wm.imageEnabled)) return "";
  const angle = clampInt(wm.angle, -90, 90);
  const rows = clampInt(wm.rows, 1, 8);
  const cols = clampInt(wm.cols, 1, 8);
  const op = Math.min(0.4, Math.max(0.05, wm.opacityPercent / 100));
  const zihao = String(wm.zihao || "2").replace(/[^\d.-]/g, "") || "2";
  const imgW = Math.min(12, Math.max(0.8, wm.imageWidthCm || 3.2));
  const file = (wm.imageFileName || "watermark.png").replace(/[^a-zA-Z0-9._-]/g, "")
    || "watermark.png";
  const text = escapeLatexText((wm.text || "").slice(0, 80));
  const useText = Boolean(wm.textEnabled && text);
  const useImage = Boolean(wm.imageEnabled);
  if (!useText && !useImage) return "";
  const tiled = rows * cols > 1;

  // 用 \wmX/\wmY，避免和 TikZ 的 \x 循环变量打架
  const textNode = useText
    ? `\\node[rotate=${angle},opacity=${op.toFixed(2)},text=black,anchor=center] at (\\wmX cm,\\wmY cm) {{\\zihao{${zihao}}\\heiti ${text}}};`
    : "";
  const imgNode = useImage
    ? `\\node[rotate=${angle},opacity=${op.toFixed(2)},anchor=center] at (\\wmX cm,\\wmY cm) {\\includegraphics[width=${imgW}cm]{${file}}};`
    : "";

  let loop: string;
  if (tiled) {
    loop = [
      `\\foreach \\wmRow in {1,...,${rows}} {`,
      `  \\foreach \\wmCol in {1,...,${cols}} {`,
      `    \\pgfmathsetmacro{\\wmX}{2.4 + (\\wmCol-0.5)*16.2/${cols}}`,
      `    \\pgfmathsetmacro{\\wmY}{2.4 + (\\wmRow-0.5)*24.9/${rows}}`,
      textNode ? `    ${textNode}` : "",
      imgNode ? `    ${imgNode}` : "",
      `  }`,
      `}`,
    ]
      .filter(Boolean)
      .join("\n");
  } else {
    const { x, y } = positionCm(wm.position);
    loop = [
      `\\pgfmathsetmacro{\\wmX}{${x}}`,
      `\\pgfmathsetmacro{\\wmY}{${y}}`,
      textNode,
      imgNode,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "\\usepackage{eso-pic}",
    "\\usepackage{tikz}",
    "% 水印在 shipout 背景层：不占正文、透明度封顶，避免盖住公式",
    "\\AddToShipoutPictureBG{%",
    "  \\AtPageLowerLeft{%",
    "    \\begin{tikzpicture}[overlay]",
    loop,
    "    \\end{tikzpicture}%",
    "  }%",
    "}",
    useImage
      ? `% 图片水印：把图片以 ${file} 传到 Overleaf 项目根目录（与 main.tex 同级）`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function wrapAsLatexDocument(
  body: string,
  wm?: MathcodeWatermark,
): string {
  const today = new Date().toISOString().slice(0, 10);
  const inner = sanitizeLatexBody(body);
  const watermarkBlock = buildWatermarkPreamble(wm);
  return [
    "% !TEX program = xelatex",
    "% !TeX TS-program = xelatex",
    "% Overleaf：左上 Menu → Compiler 必须选 XeLaTeX，再点「重新编译」。",
    "% MathCode 文档版面逆向：ctex 中文 + 色块/框/公式；水印在背景层",
    `% 生成时间：${today}`,
    "\\documentclass[UTF8,a4paper,zihao=5,oneside]{ctexart}",
    "\\usepackage{amsmath,amssymb,amsfonts,bm}",
    "\\usepackage[version=4]{mhchem}",
    "\\usepackage{xcolor}",
    "\\usepackage{graphicx}",
    ...(watermarkBlock ? [watermarkBlock] : []),
    "\\usepackage{geometry}",
    "\\geometry{a4paper,top=1.5cm,bottom=1.6cm,left=1.7cm,right=1.7cm}",
    "\\usepackage{tcolorbox}",
    "\\tcbuselibrary{breakable,skins}",
    "\\tcbset{boxsep=3pt,left=6pt,right=6pt,top=4pt,bottom=4pt,arc=1mm,boxrule=0.5pt,before skip=8pt,after skip=8pt}",
    "\\usepackage[normalem]{ulem}",
    "\\usepackage{enumitem}",
    "\\usepackage{array,booktabs,colortbl}",
    "\\usepackage{multicol}",
    "\\pagestyle{empty}",
    "\\setlength{\\parskip}{2pt}",
    "\\setlength{\\parindent}{2em}",
    "\\setlist{nosep,leftmargin=1.6em,itemsep=2pt,topsep=3pt}",
    "\\raggedbottom",
    "",
    "\\begin{document}",
    "",
    inner || "% 识别结果为空",
    "",
    "\\end{document}",
    "",
  ].join("\n");
}

export function extractLatexBody(fullDoc: string): string {
  const doc = fullDoc.match(
    /\\begin\{document\}([\s\S]*?)\\end\{document\}/,
  );
  if (doc) {
    return doc[1]
      .replace(/\\begin\{CJK\*?\}[^\n]*/g, "")
      .replace(/\\end\{CJK\*?\}/g, "")
      .trim();
  }
  return sanitizeLatexBody(fullDoc);
}

export function looksLikeExistingLatex(text: string): boolean {
  return /\\documentclass\b|\\begin\{document\}|\\\[/.test(text);
}

export function passthroughLatex(text: string): string {
  return sanitizeLatexBody(extractLatexBody(text));
}

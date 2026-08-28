/**
 * MathCode 可编译文档：纯字符串处理，前后端都能用。
 * 不要在此文件 import 数据库 / 站点设置，避免客户端打包进服务端依赖。
 */

/** 模型常把 \section*{标题} 拆成两行；Overleaf 日志也会把 \section 和 *{ 显示成两行 */
export function sanitizeLatexBody(text: string): string {
  let s = text.replace(/\r\n/g, "\n").trim();
  const fence = /^```(?:latex|tex|math)?\s*([\s\S]*?)\s*```$/i;
  const m = s.match(fence);
  if (m) s = m[1].trim();

  // 去掉模型偶尔输出的 document 壳，避免套两层
  s = s
    .replace(/\\begin\{document\}/gi, "")
    .replace(/\\end\{document\}/gi, "")
    .replace(/\\documentclass[\s\S]*?\{[^}]+\}\s*/i, "")
    .trim();

  s = s.replace(
    /\\(chapter|section|subsection|subsubsection|paragraph|subparagraph|textbf|textit|emph|mathrm|mathbf|mathsf|mathit|textrm|texttt|ce|pu|tag|label)\s*\n\s*(\*?\{)/g,
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
  return s.trim();
}

/**
 * Overleaf 默认编译器是 pdfLaTeX，不会去看 % !TEX 注释。
 * 因此模板必须让「粘贴后直接点重新编译」就能出中文 PDF：
 * article + CJKutf8 + gbsn（Overleaf TeX Live 自带）。
 */
export function wrapAsLatexDocument(body: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const inner = sanitizeLatexBody(body);
  return [
    "% MathCode：此模板按 Overleaf 默认 pdfLaTeX 编写，粘贴后直接点「重新编译」即可。",
    `% 生成时间：${today}`,
    "\\documentclass[a4paper,12pt]{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage{amsmath,amssymb,amsfonts}",
    "\\usepackage[version=4]{mhchem}",
    "\\usepackage{geometry}",
    "\\geometry{margin=2.5cm}",
    "\\usepackage{CJKutf8}",
    "",
    "\\begin{document}",
    "\\begin{CJK*}{UTF8}{gbsn}",
    "",
    inner || "% 识别结果为空",
    "",
    "\\end{CJK*}",
    "\\end{document}",
    "",
  ].join("\n");
}

export function extractLatexBody(fullDoc: string): string {
  const cjk = fullDoc.match(
    /\\begin\{CJK\*\}[^\n]*\n([\s\S]*?)\\end\{CJK\*\}/,
  );
  if (cjk) return cjk[1].trim();
  const doc = fullDoc.match(
    /\\begin\{document\}([\s\S]*?)\\end\{document\}/,
  );
  if (doc) {
    return doc[1]
      .replace(/\\begin\{CJK\*\}[^\n]*/g, "")
      .replace(/\\end\{CJK\*\}/g, "")
      .trim();
  }
  return sanitizeLatexBody(fullDoc);
}

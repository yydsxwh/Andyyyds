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

  // 行间公式统一为 \[...\]（保留行内 $...$）
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, "\\[$1\\]");

  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/**
 * 完整 XeLaTeX + ctex 工程模板（Overleaf 须选 Compiler = XeLaTeX）。
 * 预加载色块/页眉页脚/水印/表格/侧栏/绝对定位，供识别正文直接调用。
 */
export function wrapAsLatexDocument(body: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const inner = sanitizeLatexBody(body);
  return [
    "% !TEX program = xelatex",
    "% !TeX TS-program = xelatex",
    "% Overleaf：左上 Menu → Compiler 必须选 XeLaTeX，再点「重新编译」。",
    "% MathCode 文档版面逆向：ctex 中文 + 色块/框/页眉页脚/公式",
    `% 生成时间：${today}`,
    "\\documentclass[UTF8,a4paper,zihao=5,oneside]{ctexart}",
    "\\usepackage{amsmath,amssymb,amsfonts,bm}",
    "\\usepackage[version=4]{mhchem}",
    "\\usepackage{xcolor}",
    "\\usepackage{graphicx}",
    "\\usepackage{geometry}",
    "\\geometry{a4paper,top=1.5cm,bottom=1.5cm,left=1.6cm,right=1.6cm,headheight=14pt}",
    "\\usepackage{fancyhdr}",
    "\\usepackage{tikz}",
    "\\usepackage{eso-pic}",
    "\\usepackage[absolute,overlay]{textpos}",
    "\\setlength{\\TPHorizModule}{1mm}",
    "\\setlength{\\TPVertModule}{1mm}",
    "\\usepackage{tcolorbox}",
    "\\tcbuselibrary{breakable,skins,theorems}",
    "\\tcbset{boxsep=2pt,left=5pt,right=5pt,top=3pt,bottom=3pt,arc=1mm,boxrule=0.6pt,before skip=4pt,after skip=4pt}",
    "\\usepackage[normalem]{ulem}",
    "\\usepackage{enumitem}",
    "\\usepackage{array,booktabs,multirow,colortbl}",
    "\\usepackage{wrapfig,multicol}",
    "\\pagestyle{fancy}",
    "\\fancyhf{}",
    "\\renewcommand{\\headrulewidth}{0pt}",
    "\\renewcommand{\\footrulewidth}{0pt}",
    "\\setlength{\\parskip}{0pt}",
    "\\setlength{\\parindent}{2em}",
    "\\setlist{nosep,leftmargin=1.6em,itemsep=0pt,topsep=2pt}",
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

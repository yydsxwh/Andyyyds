import assert from "node:assert/strict";
import { summarizeLatexLog } from "./mathcode-pdf";

{
  const summary = summarizeLatexLog(
    [
      "This is XeTeX, Version 3.14159265",
      "(/usr/share/texlive/texmf-dist/tex/latex/base/article.cls",
      "! Undefined control sequence.",
      "l.12 \\notacommand",
      "Package mhchem Error: Unknown option.",
    ].join("\n"),
  );
  assert.match(summary, /Undefined control sequence/);
  assert.match(summary, /Package mhchem Error/);
}

{
  assert.equal(summarizeLatexLog("This is XeTeX\nOutput written on main.pdf"), "");
}

{
  const summary = summarizeLatexLog("Fatal error occurred, no output PDF file produced!");
  assert.match(summary, /Fatal error/);
}

console.log("mathcode-pdf tests ok");

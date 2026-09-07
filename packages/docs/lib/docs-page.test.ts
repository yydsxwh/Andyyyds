import assert from "node:assert/strict";
import {
  bandCell,
  normalizePageChrome,
  pageNumberText,
  safeDownloadName,
} from "./docs-page";
import { docsContentToHtml, docsContentToPlainText, importPlainOrMarkup } from "./docs-html";
import { inferDocsTitle } from "./docs-content";

{
  const chrome = normalizePageChrome({
    headerCenter: "讲义",
    pageNumber: "footer-right",
    startAt: 3,
    headerLeft: "x".repeat(80),
  });
  assert.equal(chrome.headerCenter, "讲义");
  assert.equal(chrome.pageNumber, "footer-right");
  assert.equal(chrome.startAt, 3);
  assert.equal(chrome.headerLeft.length, 40);
  assert.equal(pageNumberText(chrome, 1, 2), "3 / 4");
  assert.equal(bandCell(chrome, "header", "center", 1, 2), "讲义");
  assert.equal(bandCell(chrome, "footer", "right", 1, 2), "3 / 4");
}

{
  const md = importPlainOrMarkup("# 标题\n\n- 甲\n- 乙\n\n1. 一\n2. 二", "md");
  assert.equal(md.content?.[0]?.type, "heading");
  assert.equal(inferDocsTitle(md), "标题");
  assert.match(docsContentToHtml(md), /<h1>标题<\/h1>/);
  assert.match(docsContentToPlainText(md), /标题/);
}

{
  const txt = importPlainOrMarkup("第一段\n\n第二段", "txt");
  assert.equal(txt.content?.length, 2);
  const html = importPlainOrMarkup("<h2>节</h2><p>正文<strong>粗</strong></p>", "html");
  assert.equal(html.content?.[0]?.type, "heading");
}

{
  assert.equal(safeDownloadName('a/b:c', "docx"), "a_b_c.docx");
}

console.log("docs-page tests ok");

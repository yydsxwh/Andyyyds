import assert from "node:assert/strict";
import {
  applyListPreset,
  buildListSchemeCss,
  formatLevelPreview,
  formatNumberToken,
  normalizeListScheme,
  schemePreviewLines,
} from "./docs-scheme";
import { inferDocsTitle, sanitizeDocsContent } from "./docs-content";

{
  assert.equal(formatNumberToken(1, "decimal"), "1");
  assert.equal(formatNumberToken(12, "cjk"), "十二");
  assert.equal(formatNumberToken(21, "cjk"), "二十一");
  assert.equal(formatNumberToken(1, "lower-alpha"), "a");
  assert.equal(formatNumberToken(27, "lower-alpha"), "aa");
  assert.equal(formatNumberToken(4, "upper-roman"), "IV");
  assert.equal(formatNumberToken(1, "circled"), "①");
}

{
  const standard = applyListPreset("standard");
  assert.equal(formatLevelPreview(standard, [1]), "1.");
  assert.equal(formatLevelPreview(standard, [1, 2]), "1.2.");
  const chinese = applyListPreset("chinese");
  assert.equal(formatLevelPreview(chinese, [1]), "一、");
  assert.equal(formatLevelPreview(chinese, [1, 2]), "（二）");
  const chapter = applyListPreset("chapter");
  assert.equal(formatLevelPreview(chapter, [3]), "第3章");
}

{
  const css = buildListSchemeCss(applyListPreset("standard"));
  assert.match(css, /counter-reset: docs-l1/);
  assert.match(css, /docs-circled/);
  assert.match(css, /cjk-ideographic|decimal/);
}

{
  const cleaned = sanitizeDocsContent({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "讲义", marks: [{ type: "bold" }] }],
      },
      { type: "script", content: [{ type: "text", text: "alert(1)" }] },
      {
        type: "orderedList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "第一项" }] }],
          },
        ],
      },
    ],
  });
  assert.equal(cleaned.type, "doc");
  assert.equal(inferDocsTitle(cleaned), "讲义");
  assert.equal(
    cleaned.content?.some((node) => node.type === "script"),
    false,
  );
  assert.equal(cleaned.content?.some((node) => node.type === "orderedList"), true);
}

{
  const n = normalizeListScheme({
    presetId: "nope",
    byType: {},
    levels: [{ style: "cjk", prefix: "第", suffix: "条", includeParents: false }],
  });
  assert.equal(n.presetId, "custom");
  assert.equal(n.levels[0].style, "cjk");
  assert.equal(n.levels[0].suffix, "条");
  assert.equal(n.levels.length, 6);
  assert.equal(schemePreviewLines(n)[0], "第一条");
}

console.log("docs-scheme tests ok");

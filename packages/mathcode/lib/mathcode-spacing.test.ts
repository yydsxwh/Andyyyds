import assert from "node:assert/strict";
import {
  applyQuestionGaps,
  buildSpacingPrompt,
  classifyQuestionHeader,
  DEFAULT_QUESTION_SPACING,
  describeGapSpec,
  gapLatex,
  isQuestionStartLine,
  normalizeQuestionSpacing,
  stripQuestionGaps,
} from "./mathcode-spacing";

{
  assert.equal(classifyQuestionHeader("一、选择题"), "choice");
  assert.equal(classifyQuestionHeader("二、填空题"), "fill");
  assert.equal(classifyQuestionHeader("三、计算题"), "calc");
  assert.equal(classifyQuestionHeader("四、证明题"), "proof");
  assert.equal(classifyQuestionHeader("普通标题"), null);
}

{
  assert.equal(isQuestionStartLine("1. 已知 $x=1$"), true);
  assert.equal(isQuestionStartLine("2、填空"), true);
  assert.equal(isQuestionStartLine("第3题 证明"), true);
  assert.equal(isQuestionStartLine("\\item 下列正确的是"), true);
  assert.equal(isQuestionStartLine("A. 1"), false);
  assert.equal(isQuestionStartLine("B. 2"), false);
}

{
  assert.equal(gapLatex({ mode: "none", lines: 2 }), "");
  assert.equal(gapLatex({ mode: "page", lines: 2 }), "\\clearpage");
  assert.match(gapLatex({ mode: "half", lines: 2 }), /0\.48\\textheight/);
  assert.equal(gapLatex({ mode: "lines", lines: 3 }), "\\par\\vspace{3\\baselineskip}\\par");
}

{
  const sample = [
    "一、选择题",
    "1. 第一题",
    "A. 1",
    "2. 第二题",
    "二、填空题",
    "3. 第三题",
    "三、计算题",
    "4. 第四题",
    "四、证明题",
    "5. 第五题",
  ].join("\n");

  const spacing = normalizeQuestionSpacing({
    enabled: true,
    byType: {
      choice: { mode: "lines", lines: 2 },
      fill: { mode: "half", lines: 1 },
      calc: { mode: "page", lines: 1 },
      proof: { mode: "none", lines: 1 },
      other: { mode: "none", lines: 1 },
    },
  });

  const applied = applyQuestionGaps(sample, spacing);
  assert.match(applied, /mathcode-gap:choice/);
  assert.match(applied, /vspace\{2\\baselineskip\}/);
  // 1→2 是选择题空行；2→3 仍按选择题（刚结束的题），不是填空半页
  const choiceGaps = applied.match(/mathcode-gap:choice/g) || [];
  assert.equal(choiceGaps.length, 2);
  assert.match(applied, /mathcode-gap:fill/);
  assert.match(applied, /mathcode-gap:calc/);
  assert.doesNotMatch(applied, /mathcode-gap:proof/);

  const off = applyQuestionGaps(applied, DEFAULT_QUESTION_SPACING);
  assert.doesNotMatch(off, /mathcode-gap:/);
  assert.equal(stripQuestionGaps(applied).includes("1. 第一题"), true);
}

{
  const again = applyQuestionGaps(
    applyQuestionGaps("1. a\n2. b", {
      ...DEFAULT_QUESTION_SPACING,
      enabled: true,
      byType: {
        ...DEFAULT_QUESTION_SPACING.byType,
        other: { mode: "lines", lines: 1 },
      },
    }),
    {
      ...DEFAULT_QUESTION_SPACING,
      enabled: true,
      byType: {
        ...DEFAULT_QUESTION_SPACING.byType,
        other: { mode: "lines", lines: 1 },
      },
    },
  );
  const marks = again.match(/mathcode-gap:other/g) || [];
  assert.equal(marks.length, 1);
}

{
  const prompt = buildSpacingPrompt({
    ...DEFAULT_QUESTION_SPACING,
    enabled: true,
  });
  assert.match(prompt, /选择题/);
  assert.match(prompt, /不要自己写/);
  assert.equal(buildSpacingPrompt(DEFAULT_QUESTION_SPACING), "");
}

{
  assert.equal(describeGapSpec({ mode: "half", lines: 8 }), "半页");
  const n = normalizeQuestionSpacing({ enabled: true, byType: { choice: { mode: "lines", lines: 99 } } });
  assert.equal(n.byType.choice.lines, 40);
}

console.log("mathcode-spacing tests ok");

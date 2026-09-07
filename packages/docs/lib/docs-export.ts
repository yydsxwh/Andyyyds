/**
 * 另存为 Word：把文档 JSON 收成 OOXML。页眉页脚写进节属性。
 */

import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { extractPlainText, type DocsJsonNode } from "@andyyyds/docs/lib/docs-content";
import {
  normalizePageChrome,
  type DocsPageChrome,
  type DocsPageNumberSlot,
} from "@andyyyds/docs/lib/docs-page";

const HEADING_MAP: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

function inlineRuns(nodes?: DocsJsonNode[]): TextRun[] {
  if (!nodes?.length) return [new TextRun("")];
  const runs: TextRun[] = [];
  for (const node of nodes) {
    if (node.type === "hardBreak") {
      runs.push(new TextRun({ text: "", break: 1 }));
      continue;
    }
    if (node.type === "text") {
      const marks = node.marks || [];
      runs.push(
        new TextRun({
          text: node.text || "",
          bold: marks.some((mark) => mark.type === "bold"),
          italics: marks.some((mark) => mark.type === "italic"),
        }),
      );
      continue;
    }
    runs.push(...inlineRuns(node.content));
  }
  return runs.length ? runs : [new TextRun("")];
}

function listParagraphs(node: DocsJsonNode, ordered: boolean, depth = 0): Paragraph[] {
  const out: Paragraph[] = [];
  for (const item of node.content || []) {
    const first = item.content?.[0];
    const rest = item.content?.slice(1) || [];
    out.push(
      new Paragraph({
        children: first ? inlineRuns(first.content) : [new TextRun("")],
        numbering: {
          reference: ordered ? "docs-num" : "docs-bul",
          level: Math.min(5, depth),
        },
      }),
    );
    for (const child of rest) {
      if (child.type === "bulletList") out.push(...listParagraphs(child, false, depth + 1));
      else if (child.type === "orderedList") out.push(...listParagraphs(child, true, depth + 1));
      else if (child.type === "paragraph") {
        out.push(new Paragraph({ children: inlineRuns(child.content) }));
      }
    }
  }
  return out;
}

function tableFromNode(node: DocsJsonNode): Table {
  const rows = (node.content || []).map(
    (row) =>
      new TableRow({
        children: (row.content || []).map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun(extractPlainText(cell) || " ")],
                }),
              ],
            }),
        ),
      }),
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.length
      ? rows
      : [
          new TableRow({
            children: [new TableCell({ children: [new Paragraph("")] })],
          }),
        ],
  });
}

function blocksFromContent(content: DocsJsonNode): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  for (const node of content.content || []) {
    if (node.type === "heading") {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 2));
      out.push(
        new Paragraph({
          heading: HEADING_MAP[level],
          children: inlineRuns(node.content),
        }),
      );
      continue;
    }
    if (node.type === "bulletList") {
      out.push(...listParagraphs(node, false));
      continue;
    }
    if (node.type === "orderedList") {
      out.push(...listParagraphs(node, true));
      continue;
    }
    if (node.type === "table") {
      out.push(tableFromNode(node));
      continue;
    }
    if (node.type === "image") {
      out.push(new Paragraph({ children: [new TextRun("［图片］")] }));
      continue;
    }
    out.push(new Paragraph({ children: inlineRuns(node.content) }));
  }
  return out.length ? out : [new Paragraph("")];
}

function slotHasPage(chrome: DocsPageChrome, slot: DocsPageNumberSlot): boolean {
  return chrome.pageNumber === slot;
}

function bandChildren(
  chrome: DocsPageChrome,
  band: "header" | "footer",
  slot: "left" | "center" | "right",
): TextRun[] {
  const key = `${band}-${slot}` as DocsPageNumberSlot;
  const text =
    band === "header"
      ? slot === "left"
        ? chrome.headerLeft
        : slot === "center"
          ? chrome.headerCenter
          : chrome.headerRight
      : slot === "left"
        ? chrome.footerLeft
        : slot === "center"
          ? chrome.footerCenter
          : chrome.footerRight;
  if (slotHasPage(chrome, key)) {
    return [
      new TextRun({ children: [PageNumber.CURRENT] }),
      new TextRun(" / "),
      new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
    ];
  }
  return text ? [new TextRun(text)] : [];
}

function bandParagraphs(chrome: DocsPageChrome, band: "header" | "footer"): Paragraph[] {
  return (["left", "center", "right"] as const).map((slot) => {
    const align =
      slot === "left"
        ? AlignmentType.LEFT
        : slot === "right"
          ? AlignmentType.RIGHT
          : AlignmentType.CENTER;
    return new Paragraph({
      alignment: align,
      children: bandChildren(chrome, band, slot),
    });
  });
}

export async function exportDocsDocx(input: {
  title: string;
  content: DocsJsonNode;
  pageChrome?: DocsPageChrome;
}): Promise<Buffer> {
  const chrome = normalizePageChrome(input.pageChrome);
  const doc = new Document({
    title: input.title,
    numbering: {
      config: [
        {
          reference: "docs-num",
          levels: [0, 1, 2, 3, 4, 5].map((level) => ({
            level,
            format: "decimal",
            text: `%${level + 1}.`,
          })),
        },
        {
          reference: "docs-bul",
          levels: [0, 1, 2, 3, 4, 5].map((level) => ({
            level,
            format: "bullet",
            text: "•",
          })),
        },
      ],
    },
    sections: [
      {
        headers: {
          default: new Header({ children: bandParagraphs(chrome, "header") }),
        },
        footers: {
          default: new Footer({ children: bandParagraphs(chrome, "footer") }),
        },
        properties: {
          page: {
            pageNumbers: { start: chrome.startAt },
          },
        },
        children: blocksFromContent(input.content),
      },
    ],
  });
  const blob = await Packer.toBuffer(doc);
  return Buffer.from(blob);
}

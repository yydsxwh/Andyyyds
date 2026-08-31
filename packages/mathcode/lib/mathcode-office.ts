/**
 * 办公文档 / OpenDocument → 有序「文字块 + 内嵌图片」。
 * 只在服务端跑（JSZip），浏览器把整文件 POST 到 /api/mathcode/office。
 *
 * 旧版 OLE（.doc/.ppt/.xls 二进制）解不了：请用户另存为 docx/pptx/xlsx 或导出 PDF。
 * 新版 WPS 的 .wps/.dps/.et 经常就是 OOXML zip，按内容探测而不是只看扩展名。
 */

import JSZip from "jszip";
import {
  MATHCODE_MAX_UNITS,
  MATHCODE_MIN_OCR_IMAGE_BYTES,
  fileExtension,
} from "@andyyyds/mathcode/lib/mathcode-filetypes";

export type OfficeExtractUnit = {
  label: string;
  kind: "text" | "image";
  text?: string;
  mime?: string;
  /** PNG/JPEG/GIF/WebP 的 base64，不含 data: 前缀 */
  base64?: string;
};

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

function isZip(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

function isOle(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0
  );
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function localTagTexts(xml: string, localName: string): string[] {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${localName}>`,
    "gi",
  );
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    out.push(decodeXmlEntities(m[1].replace(/<[^>]+>/g, "")));
  }
  return out;
}

function parseRels(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /Id="([^"]+)"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const id = m[1] || m[4];
    const target = m[2] || m[3];
    if (id && target) map.set(id, target.replace(/\\/g, "/"));
  }
  return map;
}

function resolveZipPath(fromFile: string, target: string): string {
  const t = target.replace(/^\//, "");
  if (!fromFile.includes("/")) return t;
  const dir = fromFile.split("/").slice(0, -1);
  const parts = [...dir, ...t.split("/")];
  const out: string[] = [];
  for (const p of parts) {
    if (!p || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

async function readZipText(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path) || zip.file(decodeURIComponent(path));
  if (!file) return null;
  return file.async("string");
}

async function readZipBytes(zip: JSZip, path: string): Promise<Buffer | null> {
  const file = zip.file(path) || zip.file(decodeURIComponent(path));
  if (!file) return null;
  return Buffer.from(await file.async("uint8array"));
}

function imageMimeFromPath(path: string): string | null {
  const ext = fileExtension(path);
  return IMAGE_MIME[ext] || null;
}

async function unitFromImage(
  zip: JSZip,
  path: string,
  label: string,
): Promise<OfficeExtractUnit | null> {
  const mime = imageMimeFromPath(path);
  if (!mime) return null;
  const bytes = await readZipBytes(zip, path);
  if (!bytes || bytes.length < MATHCODE_MIN_OCR_IMAGE_BYTES) return null;
  return {
    label,
    kind: "image",
    mime,
    base64: bytes.toString("base64"),
  };
}

function pushText(units: OfficeExtractUnit[], label: string, text: string) {
  const t = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (t) units.push({ label, kind: "text", text: t });
}

function docxTableToMarkdown(tblXml: string): string {
  const rows = tblXml.split(/<(?:[\w.-]+:)?tr[\s>]/i).slice(1);
  const grid = rows.map((row) => {
    const cells = row.split(/<(?:[\w.-]+:)?tc[\s>]/i).slice(1);
    return cells.map((cell) =>
      localTagTexts(cell, "t").join("").replace(/\|/g, "\\|").trim(),
    );
  });
  if (grid.length === 0) return "";
  const width = Math.max(...grid.map((r) => r.length), 1);
  const pad = grid.map((r) => {
    const copy = [...r];
    while (copy.length < width) copy.push("");
    return copy;
  });
  const header = `| ${pad[0].join(" | ")} |`;
  const sep = `| ${pad[0].map(() => "---").join(" | ")} |`;
  const body = pad.slice(1).map((r) => `| ${r.join(" | ")} |`);
  return [header, sep, ...body].join("\n");
}

function rewriteDocxBody(xml: string): string {
  let body = xml;
  body = body.replace(
    /<(?:[\w.-]+:)?oMath(?:Para)?\b[\s\S]*?<\/(?:[\w.-]+:)?oMath(?:Para)?>/gi,
    (block) => {
      const inner = localTagTexts(block, "t").join("");
      return inner ? ` $${inner}$ ` : " ";
    },
  );
  body = body.replace(
    /<(?:[\w.-]+:)?tbl\b[\s\S]*?<\/(?:[\w.-]+:)?tbl>/gi,
    (tbl) => `\n\n${docxTableToMarkdown(tbl)}\n\n`,
  );
  body = body.replace(/<(?:[\w.-]+:)?br\b[^/]*\/>/gi, "\n");
  body = body.replace(/<(?:[\w.-]+:)?tab\b[^/]*\/>/gi, "\t");
  const paras = body.split(/<(?:[\w.-]+:)?p[\s>]/i).slice(1);
  if (paras.length === 0) {
    return localTagTexts(body, "t").join("");
  }
  return paras
    .map((p) => localTagTexts(p, "t").join(""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function collectBlipRids(xml: string): string[] {
  const ids: string[] = [];
  const re = /(?:r:embed|r:id)="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) ids.push(m[1]);
  return ids;
}

async function extractDocx(
  zip: JSZip,
  fileName: string,
): Promise<OfficeExtractUnit[]> {
  const xml = await readZipText(zip, "word/document.xml");
  if (!xml) throw new Error("Word 文档里找不到正文（word/document.xml）");
  const relXml = (await readZipText(zip, "word/_rels/document.xml.rels")) || "";
  const rels = parseRels(relXml);
  const units: OfficeExtractUnit[] = [];

  // 按正文出现顺序：图片单独成块，中间的文字合并
  const parts = xml.split(/<(?:[\w.-]+:)?drawing\b/i);
  const textHead = rewriteDocxBody(parts[0] || "");
  pushText(units, fileName, textHead);

  for (let i = 1; i < parts.length; i += 1) {
    const chunk = parts[i];
    const rids = collectBlipRids(chunk);
    for (const rid of rids) {
      const target = rels.get(rid);
      if (!target) continue;
      const path = resolveZipPath("word/document.xml", target);
      const img = await unitFromImage(
        zip,
        path,
        `${fileName} · 图 ${units.filter((u) => u.kind === "image").length + 1}`,
      );
      if (img) units.push(img);
    }
    const rest = rewriteDocxBody(chunk);
    pushText(units, fileName, rest);
  }

  if (units.length === 0) {
    pushText(units, fileName, rewriteDocxBody(xml));
  }
  return units;
}

function pptSlideText(xml: string): string {
  const paras = xml.split(/<(?:[\w.-]+:)?p[\s>]/i).slice(1);
  const lines = (paras.length ? paras : [xml]).map((p) =>
    localTagTexts(p, "t").join(""),
  );
  return lines.filter(Boolean).join("\n");
}

async function extractPptx(
  zip: JSZip,
  fileName: string,
): Promise<OfficeExtractUnit[]> {
  const pres = await readZipText(zip, "ppt/presentation.xml");
  const presRels = (await readZipText(zip, "ppt/_rels/presentation.xml.rels")) || "";
  const rels = parseRels(presRels);
  const order: string[] = [];
  if (pres) {
    const idRe = /<(?:[\w.-]+:)?sldId\b[^>]*r:id="([^"]+)"/gi;
    let m: RegExpExecArray | null;
    while ((m = idRe.exec(pres))) {
      const target = rels.get(m[1]);
      if (target) order.push(resolveZipPath("ppt/presentation.xml", target));
    }
  }
  if (order.length === 0) {
    const names = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort((a, b) => {
        const na = Number((/slide(\d+)/i.exec(a) || [])[1] || 0);
        const nb = Number((/slide(\d+)/i.exec(b) || [])[1] || 0);
        return na - nb;
      });
    order.push(...names);
  }

  const units: OfficeExtractUnit[] = [];
  const total = order.length;
  for (let i = 0; i < order.length; i += 1) {
    const slidePath = order[i];
    const xml = await readZipText(zip, slidePath);
    if (!xml) continue;
    const label = `${fileName} · 第 ${i + 1}/${total} 页`;
    pushText(units, label, pptSlideText(xml));
    const relPath = slidePath.replace(/([^/]+)$/, "_rels/$1.rels");
    const slideRels = parseRels((await readZipText(zip, relPath)) || "");
    const rids = collectBlipRids(xml);
    let imgN = 0;
    for (const rid of rids) {
      const target = slideRels.get(rid);
      if (!target) continue;
      const path = resolveZipPath(slidePath, target);
      imgN += 1;
      const img = await unitFromImage(zip, path, `${label} · 图 ${imgN}`);
      if (img) units.push(img);
    }
  }
  return units;
}

function parseSharedStrings(xml: string): string[] {
  const items: string[] = [];
  const re = /<(?:[\w.-]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?si>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    items.push(localTagTexts(m[1], "t").join(""));
  }
  return items;
}

function colLettersToIndex(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return Math.max(0, n - 1);
}

function sheetToMarkdown(sheetXml: string, shared: string[]): string {
  const rows = new Map<number, Map<number, string>>();
  const cellRe =
    /<(?:[\w.-]+:)?c\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?c>/gi;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(sheetXml))) {
    const attrs = m[1];
    const inner = m[2];
    const ref = /r="([A-Z]+)(\d+)"/i.exec(attrs);
    if (!ref) continue;
    const col = colLettersToIndex(ref[1]);
    const row = Number(ref[2]);
    const t = /\bt="([^"]+)"/.exec(attrs)?.[1] || "";
    const v = localTagTexts(inner, "v")[0] ?? localTagTexts(inner, "t").join("");
    let value = v;
    if (t === "s") value = shared[Number(v)] ?? v;
    else if (t === "inlineStr") value = localTagTexts(inner, "t").join("");
    if (!rows.has(row)) rows.set(row, new Map());
    rows.get(row)!.set(col, value.replace(/\|/g, "\\|"));
  }
  const rowNums = [...rows.keys()].sort((a, b) => a - b);
  if (rowNums.length === 0) return "";
  const width =
    Math.max(0, ...rowNums.map((r) => Math.max(0, ...rows.get(r)!.keys()))) + 1;
  const lines = rowNums.map((r) => {
    const cells = [];
    for (let c = 0; c < width; c += 1) cells.push(rows.get(r)!.get(c) || "");
    return `| ${cells.join(" | ")} |`;
  });
  if (lines.length === 1) return lines[0];
  const sep = `| ${Array.from({ length: width }, () => "---").join(" | ")} |`;
  return [lines[0], sep, ...lines.slice(1)].join("\n");
}

async function extractXlsx(
  zip: JSZip,
  fileName: string,
): Promise<OfficeExtractUnit[]> {
  const sharedXml = (await readZipText(zip, "xl/sharedStrings.xml")) || "";
  const shared = parseSharedStrings(sharedXml);
  const wb = await readZipText(zip, "xl/workbook.xml");
  const wbRels = parseRels(
    (await readZipText(zip, "xl/_rels/workbook.xml.rels")) || "",
  );
  const sheets: { name: string; path: string }[] = [];
  if (wb) {
    const re =
      /<(?:[\w.-]+:)?sheet\b([^>]*)\/?>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(wb))) {
      const attrs = m[1];
      const name = /name="([^"]+)"/.exec(attrs)?.[1] || `Sheet${sheets.length + 1}`;
      const rid = /r:id="([^"]+)"/.exec(attrs)?.[1];
      const target = rid ? wbRels.get(rid) : null;
      if (target) {
        sheets.push({
          name,
          path: resolveZipPath("xl/workbook.xml", target),
        });
      }
    }
  }
  if (sheets.length === 0) {
    const names = Object.keys(zip.files).filter((n) =>
      /^xl\/worksheets\/sheet\d+\.xml$/i.test(n),
    );
    names.sort();
    names.forEach((path, i) => sheets.push({ name: `Sheet${i + 1}`, path }));
  }

  const units: OfficeExtractUnit[] = [];
  for (const sheet of sheets) {
    const xml = await readZipText(zip, sheet.path);
    if (!xml) continue;
    const md = sheetToMarkdown(xml, shared);
    pushText(units, `${fileName} · ${sheet.name}`, md);
  }
  return units;
}

async function extractOdtLike(
  zip: JSZip,
  fileName: string,
  kind: "odt" | "odp" | "ods",
): Promise<OfficeExtractUnit[]> {
  const xml = await readZipText(zip, "content.xml");
  if (!xml) throw new Error("OpenDocument 缺少 content.xml");
  const units: OfficeExtractUnit[] = [];
  if (kind === "ods" || /<(?:[\w.-]+:)?table\b/i.test(xml)) {
    const tables = xml.split(/<(?:[\w.-]+:)?table\b/i).slice(1);
    tables.forEach((tbl, idx) => {
      const rows = tbl.split(/<(?:[\w.-]+:)?table-row\b/i).slice(1);
      const grid = rows.map((row) =>
        row
          .split(/<(?:[\w.-]+:)?table-cell\b/i)
          .slice(1)
          .map((cell) => localTagTexts(cell, "p").join(" ").replace(/\|/g, "\\|").trim()),
      );
      if (grid.length === 0) return;
      const width = Math.max(...grid.map((r) => r.length), 1);
      const pad = grid.map((r) => {
        const c = [...r];
        while (c.length < width) c.push("");
        return c;
      });
      const md = [
        `| ${pad[0].join(" | ")} |`,
        `| ${pad[0].map(() => "---").join(" | ")} |`,
        ...pad.slice(1).map((r) => `| ${r.join(" | ")} |`),
      ].join("\n");
      pushText(units, `${fileName} · 表 ${idx + 1}`, md);
    });
  }
  if (kind !== "ods") {
    const paras = localTagTexts(xml, "p").filter((s) => s.trim());
    pushText(units, fileName, paras.join("\n"));
  }
  // 内嵌图
  const media = Object.keys(zip.files).filter((n) =>
    /^Pictures\//i.test(n) && !n.endsWith("/"),
  );
  let n = 0;
  for (const path of media) {
    n += 1;
    const img = await unitFromImage(zip, path, `${fileName} · 图 ${n}`);
    if (img) units.push(img);
  }
  return units;
}

function looksLikeDocx(zip: JSZip): boolean {
  return Boolean(zip.file("word/document.xml"));
}
function looksLikePptx(zip: JSZip): boolean {
  return Boolean(zip.file("ppt/presentation.xml"));
}
function looksLikeXlsx(zip: JSZip): boolean {
  return Boolean(zip.file("xl/workbook.xml"));
}
function looksLikeOdf(zip: JSZip): boolean {
  return Boolean(zip.file("content.xml"));
}

function capUnits(units: OfficeExtractUnit[], fileName: string): OfficeExtractUnit[] {
  if (units.length <= MATHCODE_MAX_UNITS) return units;
  const kept = units.slice(0, MATHCODE_MAX_UNITS);
  kept.push({
    label: fileName,
    kind: "text",
    text: `（已截断：共拆出 ${units.length} 块，本次只转换前 ${MATHCODE_MAX_UNITS} 块。可把文档拆开再传，或先导出 PDF。）`,
  });
  return kept;
}

export async function extractOfficeDocument(input: {
  fileName: string;
  buf: Buffer;
}): Promise<OfficeExtractUnit[]> {
  const { fileName, buf } = input;
  const ext = fileExtension(fileName);

  if (isOle(buf)) {
    throw new Error(
      `「${fileName}」是旧版二进制办公格式。请用 Word / WPS / PPT 另存为 .docx / .pptx / .xlsx，或导出 PDF 后再上传。`,
    );
  }

  if (!isZip(buf)) {
    throw new Error(
      `无法解析「${fileName}」。请另存为 .docx / .pptx / .xlsx / .md，或导出 PDF。`,
    );
  }

  const zip = await JSZip.loadAsync(buf);
  let units: OfficeExtractUnit[] = [];

  // 新版 WPS 扩展名常仍是 .wps/.dps/.et，内容其实是 OOXML，按包内文件探测
  if (looksLikeDocx(zip)) {
    units = await extractDocx(zip, fileName);
  } else if (looksLikePptx(zip)) {
    units = await extractPptx(zip, fileName);
  } else if (looksLikeXlsx(zip)) {
    units = await extractXlsx(zip, fileName);
  } else if (looksLikeOdf(zip)) {
    const kind = ext === "ods" || ext === "odp" || ext === "odt" ? ext : "odt";
    units = await extractOdtLike(zip, fileName, kind);
  } else {
    throw new Error(
      `暂不支持「${fileName}」。请另存为 .docx / .pptx / .xlsx / .md，或导出 PDF。`,
    );
  }

  const meaningful = units.filter((u) =>
    u.kind === "image" ? Boolean(u.base64) : Boolean((u.text || "").trim()),
  );
  if (meaningful.length === 0) {
    throw new Error(
      `「${fileName}」里没有抽出文字或可识别的图片。可改导出 PDF 再上传。`,
    );
  }
  return capUnits(meaningful, fileName);
}

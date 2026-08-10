/**
 * 简繁转换（本地 OpenCC，无外呼、不计费）。
 * 仅服务端使用；动态 import 避免客户端打包。
 */

type Converter = { convert: (text: string) => string };

let s2t: Converter | null = null;
let t2s: Converter | null = null;

async function loadConverters() {
  if (s2t && t2s) return;
  const OpenCC = await import("opencc-js");
  s2t = OpenCC.Converter({ from: "cn", to: "tw" });
  t2s = OpenCC.Converter({ from: "tw", to: "cn" });
}

export async function toTraditionalChinese(text: string): Promise<string> {
  if (!text) return text;
  await loadConverters();
  return s2t!.convert(text);
}

export async function toSimplifiedChinese(text: string): Promise<string> {
  if (!text) return text;
  await loadConverters();
  return t2s!.convert(text);
}

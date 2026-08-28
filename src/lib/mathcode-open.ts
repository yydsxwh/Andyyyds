/**
 * 把 MathCode 生成的 .tex 送到 Overleaf / VS Code。
 * 只跑在浏览器里，不要 import 数据库。
 */

const OVERLEAF_DOCS = "https://www.overleaf.com/docs";
const VSCODE_WEB = "https://vscode.dev";
/** hidden input 过大时改走 data URL，避免表单被浏览器截断 */
const OVERLEAF_ENCODED_SNIP_MAX = 1_200_000;

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const chunk = 8192;
  let bin = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

function postOverleafForm(fields: Record<string, string>) {
  const form = document.createElement("form");
  form.action = OVERLEAF_DOCS;
  form.method = "post";
  form.target = "_blank";
  form.rel = "noopener noreferrer";
  form.style.display = "none";
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

/** 用户手势里调用：新标签打开 Overleaf 工程，编译器固定 XeLaTeX */
export function openTexInOverleaf(tex: string, fileName = "main.tex") {
  const source = tex.trim();
  if (!source) return;
  const encoded = encodeURIComponent(source);
  if (encoded.length <= OVERLEAF_ENCODED_SNIP_MAX) {
    postOverleafForm({
      encoded_snip: encoded,
      snip_name: fileName,
      engine: "xelatex",
    });
    return;
  }
  postOverleafForm({
    snip_uri: `data:application/x-tex;base64,${utf8ToBase64(source)}`,
    snip_name: fileName,
    engine: "xelatex",
  });
}

function vscodeFileHref(absPath: string): string {
  const unix = absPath.replace(/\\/g, "/");
  const withRoot = /^[A-Za-z]:/.test(unix) ? `/${unix}` : unix;
  return `vscode://file${withRoot.startsWith("/") ? "" : "/"}${withRoot}`;
}

function clickProtocol(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function isWeChatBrowser(): boolean {
  return /MicroMessenger/i.test(navigator.userAgent || "");
}

function downloadTexFile(tex: string, fileName: string) {
  const blob = new Blob([tex], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type SavePickerWindow = Window & {
  showSaveFilePicker?: (opts: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    getFile: () => Promise<File>;
    createWritable: () => Promise<{
      write: (data: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

export type VsCodeOpenResult = "saved-protocol" | "saved" | "download-web" | "cancelled";

/**
 * 电脑：先让用户把 main.tex 存到 VS Code 工程目录，再唤起 vscode://。
 * 微信/无文件选择器：下载文件并打开 vscode.dev（网页版可继续编辑）。
 */
export async function openTexInVsCode(
  tex: string,
  fileName = "main.tex",
): Promise<VsCodeOpenResult> {
  const source = tex.trim();
  if (!source) return "cancelled";

  if (isWeChatBrowser() || typeof (window as SavePickerWindow).showSaveFilePicker !== "function") {
    downloadTexFile(source, fileName);
    window.open(VSCODE_WEB, "_blank", "noopener,noreferrer");
    return "download-web";
  }

  try {
    const handle = await (window as SavePickerWindow).showSaveFilePicker!({
      suggestedName: fileName,
      types: [
        {
          description: "LaTeX",
          accept: { "text/plain": [".tex"] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(source);
    await writable.close();
    const file = await handle.getFile();
    const diskPath = (file as File & { path?: string }).path;
    if (diskPath) {
      clickProtocol(vscodeFileHref(diskPath));
      return "saved-protocol";
    }
    clickProtocol("vscode://");
    return "saved";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return "cancelled";
    }
    downloadTexFile(source, fileName);
    clickProtocol("vscode://");
    window.open(VSCODE_WEB, "_blank", "noopener,noreferrer");
    return "download-web";
  }
}

export const MATHCODE_EDITOR_LINKS = {
  overleaf: "https://www.overleaf.com/project",
  vscodeWeb: VSCODE_WEB,
} as const;

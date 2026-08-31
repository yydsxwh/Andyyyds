/**
 * 把 MathCode 生成的 .tex 送到 Overleaf / VS Code。
 * 只跑在浏览器里，不要 import 数据库。
 */

const OVERLEAF_DOCS = "https://www.overleaf.com/docs";
const VSCODE_WEB = "https://vscode.dev";
const VSCODE_DESKTOP = "vscode://";
/** 等窗口失焦，判断自定义协议是否唤起了客户端 */
const VSCODE_PROTOCOL_WAIT_MS = 1800;
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

function clickProtocol(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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

/**
 * 先走 vscode:// 唤起桌面客户端；窗口没失焦则视为未安装，再打开网页版。
 * 必须在点击事件里同步调用 clickProtocol，await 之后再调常会被浏览器拦住。
 */
function tryOpenVsCodeDesktop(protocolHref: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      resolve(ok);
    };
    const onBlur = () => finish(true);
    const onVis = () => {
      if (document.hidden) finish(true);
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    clickProtocol(protocolHref);
    window.setTimeout(() => finish(false), VSCODE_PROTOCOL_WAIT_MS);
  });
}

async function launchVsCodePreferDesktop(protocolHref = VSCODE_DESKTOP): Promise<"desktop" | "web"> {
  const openedDesktop = await tryOpenVsCodeDesktop(protocolHref);
  if (openedDesktop) return "desktop";
  window.open(VSCODE_WEB, "_blank", "noopener,noreferrer");
  return "web";
}

/** 只打开编辑器（产品页入口）：有客户端先开客户端 */
export async function openVsCodeApp(): Promise<"desktop" | "web"> {
  return launchVsCodePreferDesktop(VSCODE_DESKTOP);
}

export type VsCodeOpenResult = "desktop" | "web" | "cancelled";

/**
 * 下载当前 .tex，并优先用桌面 VS Code 打开；唤不起客户端再打开 vscode.dev。
 */
export async function openTexInVsCode(
  tex: string,
  fileName = "main.tex",
): Promise<VsCodeOpenResult> {
  const source = tex.trim();
  if (!source) return "cancelled";

  downloadTexFile(source, fileName);
  return launchVsCodePreferDesktop(VSCODE_DESKTOP);
}

export const MATHCODE_EDITOR_LINKS = {
  overleaf: "https://www.overleaf.com/project",
  vscodeDesktop: VSCODE_DESKTOP,
  vscodeWeb: VSCODE_WEB,
} as const;

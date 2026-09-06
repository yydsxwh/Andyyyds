import type { DocsDocumentPayload, DocsJsonNode } from "@andyyyds/docs/lib/docs-content";
import type { DocsListScheme } from "@andyyyds/docs/lib/docs-scheme";

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const message = String((body as { error?: unknown }).error || "").trim();
    if (message) return message;
  }
  return fallback;
}

export async function fetchDocsList(): Promise<DocsDocumentPayload[]> {
  const res = await fetch("/api/docs", { credentials: "same-origin" });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(body, "无法加载文档列表"));
  const items = (body as { items?: DocsDocumentPayload[] }).items;
  return Array.isArray(items) ? items : [];
}

export async function fetchDocsDocument(id: string): Promise<DocsDocumentPayload> {
  const res = await fetch(`/api/docs/${encodeURIComponent(id)}`, {
    credentials: "same-origin",
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(body, "无法打开文档"));
  return body as DocsDocumentPayload;
}

export async function createDocsDocumentRequest(input?: {
  title?: string;
  content?: DocsJsonNode;
  listScheme?: DocsListScheme;
}): Promise<DocsDocumentPayload> {
  const res = await fetch("/api/docs", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input || {}),
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(body, "无法新建文档"));
  return body as DocsDocumentPayload;
}

export async function saveDocsDocumentRequest(
  id: string,
  input: {
    title?: string;
    content?: DocsJsonNode;
    listScheme?: DocsListScheme;
  },
): Promise<DocsDocumentPayload> {
  const res = await fetch(`/api/docs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(body, "保存失败"));
  return body as DocsDocumentPayload;
}

export async function deleteDocsDocumentRequest(id: string): Promise<void> {
  const res = await fetch(`/api/docs/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = await readJson(res);
    throw new Error(errorMessage(body, "删除失败"));
  }
}

export async function uploadDocsImage(file: File): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  const res = await fetch("/api/upload/image", {
    method: "POST",
    credentials: "same-origin",
    body: form,
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(body, "图片上传失败"));
  const preview = String((body as { previewUrl?: string }).previewUrl || "");
  const url = String((body as { url?: string }).url || "");
  return preview || url;
}

import type {
  PersonEntryKind,
  PersonEntryPayload,
  PersonProfilePayload,
} from "@andyyyds/person/lib/person-site";

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

export async function fetchPersonAdminProfile(): Promise<PersonProfilePayload> {
  const res = await fetch("/api/person-admin/profile", { credentials: "same-origin" });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(body, "无法加载档案"));
  return body as PersonProfilePayload;
}

export async function savePersonAdminProfile(
  input: PersonProfilePayload,
): Promise<PersonProfilePayload> {
  const res = await fetch("/api/person-admin/profile", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(body, "保存档案失败"));
  return body as PersonProfilePayload;
}

export async function fetchPersonAdminEntries(
  kind?: PersonEntryKind,
): Promise<PersonEntryPayload[]> {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : "";
  const res = await fetch(`/api/person-admin/entries${query}`, {
    credentials: "same-origin",
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(body, "无法加载条目"));
  const items = (body as { items?: PersonEntryPayload[] }).items;
  return Array.isArray(items) ? items : [];
}

export async function createPersonAdminEntry(
  input: Partial<PersonEntryPayload>,
): Promise<PersonEntryPayload> {
  const res = await fetch("/api/person-admin/entries", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(body, "新建失败"));
  return body as PersonEntryPayload;
}

export async function savePersonAdminEntry(
  id: string,
  input: Partial<PersonEntryPayload>,
): Promise<PersonEntryPayload> {
  const res = await fetch(`/api/person-admin/entries/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(body, "保存失败"));
  return body as PersonEntryPayload;
}

export async function deletePersonAdminEntry(id: string): Promise<void> {
  const res = await fetch(`/api/person-admin/entries/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = await readJson(res);
    throw new Error(errorMessage(body, "删除失败"));
  }
}

export async function uploadPersonAdminImage(file: File): Promise<string> {
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

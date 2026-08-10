/**
 * 浏览器端 OSS 分片上传（含 VOD STS）。
 * 大视频直传云端，不经本站 Node 缓冲，才能突破 10MB/nginx 代理瓶颈并支持数 GB。
 */

const PART_SIZE = 8 * 1024 * 1024; // 8MB，满足 OSS 分片下限且利于并行
const PARALLEL = 3;

export type BrowserOssCreds = {
  host: string;
  bucket: string;
  objectKey: string;
  accessKeyId: string;
  accessKeySecret: string;
  securityToken?: string;
};

function encodeObjectKey(objectKey: string) {
  return objectKey
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

async function hmacSha1Base64(secret: string, content: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(content));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

/**
 * 浏览器 fetch 禁止设置 Date 头；若签名用 Date、请求却带不上，OSS 会 403 AccessDenied。
 * 改用可自定义的 x-oss-date，并把 StringToSign 的 Date 栏留空（阿里云文档约定）。
 */
function buildOssAuthHeaders(input: {
  method: string;
  contentType: string;
  resource: string;
  accessKeyId: string;
  accessKeySecret: string;
  securityToken?: string;
  extraOssHeaders?: Record<string, string>;
}): Promise<Record<string, string>> {
  const ossDate = new Date().toUTCString();
  const ossHeaders: Record<string, string> = {
    "x-oss-date": ossDate,
    ...(input.extraOssHeaders || {}),
  };
  if (input.securityToken) {
    ossHeaders["x-oss-security-token"] = input.securityToken;
  }
  const canonical = Object.keys(ossHeaders)
    .filter((k) => k.toLowerCase().startsWith("x-oss-"))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((k) => `${k.toLowerCase()}:${ossHeaders[k]!.trim()}`)
    .join("\n");
  const canonicalHeaders = canonical ? `${canonical}\n` : "";
  // Date 栏必须为空：真实时间只在 x-oss-date 里
  const stringToSign = `${input.method}\n\n${input.contentType}\n\n${canonicalHeaders}${input.resource}`;

  return hmacSha1Base64(input.accessKeySecret, stringToSign).then((signature) => {
    const headers: Record<string, string> = {
      ...ossHeaders,
      Authorization: `OSS ${input.accessKeyId}:${signature}`,
    };
    if (input.contentType) headers["Content-Type"] = input.contentType;
    return headers;
  });
}

async function ossFetch(
  creds: BrowserOssCreds,
  input: {
    method: "GET" | "POST" | "PUT" | "DELETE";
    query?: string;
    contentType?: string;
    body?: BodyInit | null;
    resourceSuffix?: string;
  },
) {
  const contentType = input.contentType || "";
  const path = `/${encodeObjectKey(creds.objectKey)}${input.query || ""}`;
  const resource = `/${creds.bucket}/${creds.objectKey}${input.resourceSuffix || input.query || ""}`;
  const headers = await buildOssAuthHeaders({
    method: input.method,
    contentType,
    resource,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    securityToken: creds.securityToken,
  });
  const res = await fetch(`https://${creds.host}${path}`, {
    method: input.method,
    headers,
    body: input.body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`云存储上传失败（${res.status}）：${text.slice(0, 160)}`);
  }
  return text;
}

function xmlTag(text: string, tag: string) {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return m?.[1]?.trim() || "";
}

async function initiateMultipart(creds: BrowserOssCreds, contentType: string) {
  const xml = await ossFetch(creds, {
    method: "POST",
    query: "?uploads",
    resourceSuffix: "?uploads",
    contentType,
    body: "",
  });
  const uploadId = xmlTag(xml, "UploadId");
  if (!uploadId) throw new Error("云存储未返回 UploadId");
  return uploadId;
}

async function uploadPart(
  creds: BrowserOssCreds,
  uploadId: string,
  partNumber: number,
  blob: Blob,
) {
  const query = `?partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`;
  const resource = `/${creds.bucket}/${creds.objectKey}?partNumber=${partNumber}&uploadId=${uploadId}`;
  const headers = await buildOssAuthHeaders({
    method: "PUT",
    contentType: "",
    resource,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    securityToken: creds.securityToken,
  });
  const res = await fetch(
    `https://${creds.host}/${encodeObjectKey(creds.objectKey)}${query}`,
    { method: "PUT", headers, body: blob },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`分片 ${partNumber} 失败（${res.status}）：${text.slice(0, 120)}`);
  }
  const etag = res.headers.get("ETag") || res.headers.get("etag") || "";
  if (!etag) throw new Error(`分片 ${partNumber} 未返回 ETag`);
  return etag.replace(/"/g, "");
}

async function completeMultipart(
  creds: BrowserOssCreds,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>,
) {
  const body =
    `<CompleteMultipartUpload>` +
    parts
      .map(
        (p) =>
          `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>"${p.etag}"</ETag></Part>`,
      )
      .join("") +
    `</CompleteMultipartUpload>`;
  await ossFetch(creds, {
    method: "POST",
    query: `?uploadId=${encodeURIComponent(uploadId)}`,
    resourceSuffix: `?uploadId=${uploadId}`,
    contentType: "application/xml",
    body,
  });
}

async function putObjectSimple(
  creds: BrowserOssCreds,
  file: Blob,
  contentType: string,
) {
  const resource = `/${creds.bucket}/${creds.objectKey}`;
  const headers = await buildOssAuthHeaders({
    method: "PUT",
    contentType,
    resource,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    securityToken: creds.securityToken,
  });
  const res = await fetch(
    `https://${creds.host}/${encodeObjectKey(creds.objectKey)}`,
    { method: "PUT", headers, body: file },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`直传失败（${res.status}）：${text.slice(0, 160)}`);
  }
}

/**
 * 直传文件到 OSS/点播临时桶；>8MB 自动分片并行，并回传进度（含已上传字节）。
 */
export async function uploadFileToOssDirect(input: {
  file: File;
  creds: BrowserOssCreds;
  contentType?: string;
  onProgress?: (loaded: number, total: number) => void;
}) {
  const contentType =
    input.contentType || input.file.type || "application/octet-stream";
  const total = input.file.size;
  if (total <= PART_SIZE) {
    await putObjectSimple(input.creds, input.file, contentType);
    input.onProgress?.(total, total);
    return;
  }

  const uploadId = await initiateMultipart(input.creds, contentType);
  const partCount = Math.ceil(total / PART_SIZE);
  const parts: Array<{ partNumber: number; etag: string }> = [];
  let loaded = 0;
  let cursor = 0;

  const runPart = async (partNumber: number) => {
    const start = (partNumber - 1) * PART_SIZE;
    const end = Math.min(start + PART_SIZE, total);
    const blob = input.file.slice(start, end);
    const etag = await uploadPart(input.creds, uploadId, partNumber, blob);
    loaded += end - start;
    input.onProgress?.(loaded, total);
    parts.push({ partNumber, etag });
  };

  while (cursor < partCount) {
    const batch: Promise<void>[] = [];
    for (let i = 0; i < PARALLEL && cursor < partCount; i++, cursor++) {
      batch.push(runPart(cursor + 1));
    }
    await Promise.all(batch);
  }

  parts.sort((a, b) => a.partNumber - b.partNumber);
  await completeMultipart(input.creds, uploadId, parts);
  input.onProgress?.(total, total);
}

/**
 * 使用服务端预签名 URL 分片上传（站点自有 OSS，前端不持有长期 Secret）。
 * 完成后返回各分片 ETag，供 /complete 合并。
 */
export async function uploadFileWithSignedParts(input: {
  file: File;
  partSize: number;
  parts: Array<{ partNumber: number; url: string }>;
  onProgress?: (loaded: number, total: number) => void;
  /** 单次预签名 PUT 入库不需要 ETag；分片合并必须要 */
  requireEtag?: boolean;
}): Promise<Array<{ partNumber: number; etag: string }>> {
  const total = input.file.size;
  const partSize = input.partSize || PART_SIZE;
  const requireEtag = input.requireEtag !== false;
  const results: Array<{ partNumber: number; etag: string }> = [];
  let loaded = 0;
  let cursor = 0;
  const sorted = [...input.parts].sort((a, b) => a.partNumber - b.partNumber);

  const putBlob = (
    url: string,
    blob: Blob,
    partNumber: number,
    onChunkProgress?: (bytes: number) => void,
  ) =>
    new Promise<{ etag: string }>((resolve, reject) => {
      // XHR 才能报上传进度；点播单次预签名大文件尤其需要
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onChunkProgress?.(event.loaded);
      };
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(
            new Error(
              `分片 ${partNumber} 失败（${xhr.status}）：${String(xhr.responseText || "").slice(0, 120)}`,
            ),
          );
          return;
        }
        const etag = (
          xhr.getResponseHeader("ETag") ||
          xhr.getResponseHeader("etag") ||
          ""
        ).replace(/"/g, "");
        if (requireEtag && !etag) {
          reject(
            new Error(
              `分片 ${partNumber} 未返回 ETag（点播/OSS 桶 CORS 需 ExposeHeader: ETag）`,
            ),
          );
          return;
        }
        resolve({ etag: etag || `part-${partNumber}` });
      };
      xhr.onerror = () =>
        reject(new Error(`分片 ${partNumber} 网络错误，上传中断`));
      xhr.send(blob);
    });

  const runPart = async (part: { partNumber: number; url: string }) => {
    const start = (part.partNumber - 1) * partSize;
    const end = Math.min(start + partSize, total);
    const blob = input.file.slice(start, end);
    const baseLoaded = loaded;
    const { etag } = await putBlob(part.url, blob, part.partNumber, (bytes) => {
      input.onProgress?.(Math.min(baseLoaded + bytes, total), total);
    });
    loaded += end - start;
    input.onProgress?.(loaded, total);
    results.push({ partNumber: part.partNumber, etag });
  };

  while (cursor < sorted.length) {
    const batch: Promise<void>[] = [];
    for (let i = 0; i < PARALLEL && cursor < sorted.length; i++, cursor++) {
      batch.push(runPart(sorted[cursor]!));
    }
    await Promise.all(batch);
  }

  results.sort((a, b) => a.partNumber - b.partNumber);
  input.onProgress?.(total, total);
  return results;
}

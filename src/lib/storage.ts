import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getSiteSettings, type SiteSettingsRow } from "./site-settings";

import {
  uploadVideoToVod,
  vodConfigured,
  deleteVodVideo,
  videoIdFromVodUrl,
  isVodUrl,
} from "./aliyun-vod";

export type StoredObject = {
  fileUrl: string;
  storageKey: string;
  provider: "LOCAL" | "ALIYUN_OSS" | "ALIYUN_VOD";
  vodVideoId?: string;
};

type OssCreds = {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  region: string;
  endpoint: string;
  publicBaseUrl: string;
  prefix: string;
};

function safeFileName(name: string) {
  return name.replace(/[^\w.\u4e00-\u9fa5-]+/g, "_").slice(0, 80) || "file.bin";
}

function normalizeRegion(region: string) {
  const r = region.trim().replace(/^oss-/, "");
  return r || "cn-hongkong";
}

function ossEndpointHost(settings: {
  ossEndpoint: string;
  ossRegion: string;
  ossBucket: string;
}) {
  if (settings.ossEndpoint) {
    return settings.ossEndpoint
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
  }
  const region = normalizeRegion(settings.ossRegion);
  return `${settings.ossBucket}.oss-${region}.aliyuncs.com`;
}

function getOssCreds(settings: SiteSettingsRow): OssCreds {
  const accessKeyId = settings.ossAccessKeyId.trim();
  const accessKeySecret = settings.ossAccessKeySecret.trim();
  const bucket = settings.ossBucket.trim();
  const region = normalizeRegion(settings.ossRegion || "cn-hongkong");
  if (!accessKeyId || !accessKeySecret || !bucket) {
    throw new Error("请先填写 OSS 的 AccessKey、Bucket 与 Region");
  }
  return {
    accessKeyId,
    accessKeySecret,
    bucket,
    region,
    endpoint: settings.ossEndpoint.trim(),
    publicBaseUrl: settings.ossPublicBaseUrl.trim(),
    prefix: (settings.ossPrefix || "uploads").replace(/^\/|\/$/g, ""),
  };
}

function signOss(input: {
  method: string;
  contentType?: string;
  date: string;
  resource: string;
  headers?: Record<string, string>;
  accessKeySecret: string;
}) {
  const ossHeaders = Object.keys(input.headers || {})
    .filter((k) => k.toLowerCase().startsWith("x-oss-"))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((k) => `${k.toLowerCase()}:${(input.headers || {})[k].trim()}`)
    .join("\n");
  const canonicalHeaders = ossHeaders ? `${ossHeaders}\n` : "";
  const stringToSign = `${input.method}\n\n${input.contentType || ""}\n${input.date}\n${canonicalHeaders}${input.resource}`;
  return crypto
    .createHmac("sha1", input.accessKeySecret)
    .update(stringToSign)
    .digest("base64");
}

async function ossRequest(input: {
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  host: string;
  path: string;
  resource: string;
  accessKeyId: string;
  accessKeySecret: string;
  contentType?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
}) {
  const date = new Date().toUTCString();
  const headers: Record<string, string> = {
    Date: date,
    ...(input.headers || {}),
  };
  if (input.contentType) headers["Content-Type"] = input.contentType;
  const signature = signOss({
    method: input.method,
    contentType: input.contentType || "",
    date,
    resource: input.resource,
    headers,
    accessKeySecret: input.accessKeySecret,
  });
  headers.Authorization = `OSS ${input.accessKeyId}:${signature}`;

  let body: BodyInit | undefined;
  if (typeof input.body === "string") {
    body = input.body;
  } else if (input.body) {
    body = new Blob([Uint8Array.from(input.body)]);
  }

  const res = await fetch(`https://${input.host}${input.path}`, {
    method: input.method,
    headers,
    body,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

async function putLocal(input: {
  ownerId: string;
  fileName: string;
  buffer: Buffer;
}): Promise<StoredObject> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storedName = `${stamp}-${safeFileName(input.fileName)}`;
  const dir = path.join(process.cwd(), "public", "uploads", input.ownerId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), input.buffer);
  const fileUrl = `/uploads/${input.ownerId}/${storedName}`;
  return { fileUrl, storageKey: fileUrl, provider: "LOCAL" };
}

async function putOss(input: {
  ownerId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<StoredObject> {
  const settings = await getSiteSettings();
  const creds = getOssCreds(settings);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const objectKey = `${creds.prefix}/${input.ownerId}/${stamp}-${safeFileName(input.fileName)}`;
  const host = ossEndpointHost({
    ossEndpoint: creds.endpoint,
    ossRegion: creds.region,
    ossBucket: creds.bucket,
  });
  const contentType = input.mimeType || "application/octet-stream";
  const result = await ossRequest({
    method: "PUT",
    host,
    path: `/${objectKey}`,
    resource: `/${creds.bucket}/${objectKey}`,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    contentType,
    headers: {
      "x-oss-object-acl": "public-read",
    },
    body: input.buffer,
  });
  if (!result.ok) {
    throw new Error(`OSS 上传失败: ${result.status} ${result.text.slice(0, 200)}`);
  }

  const publicBase = (
    creds.publicBaseUrl || `https://${host}`
  ).replace(/\/$/, "");
  return {
    fileUrl: `${publicBase}/${objectKey}`,
    storageKey: objectKey,
    provider: "ALIYUN_OSS",
  };
}

function isVideoMime(mimeType: string) {
  return mimeType.startsWith("video/");
}

/**
 * kind=video → 优先阿里云点播；kind=file → 优先 OSS
 * 二者可同时启用，按类型分流。
 */
export async function storeUpload(input: {
  ownerId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  title?: string;
  kind?: "video" | "file";
}): Promise<StoredObject> {
  const settings = await getSiteSettings();
  const kind =
    input.kind || (isVideoMime(input.mimeType) ? "video" : "file");

  if (kind === "video") {
    if (
      settings.videoStorageProvider === "ALIYUN_VOD" &&
      vodConfigured(settings)
    ) {
      const vod = await uploadVideoToVod({
        title: input.title || input.fileName,
        fileName: input.fileName,
        buffer: input.buffer,
        mimeType: input.mimeType,
        settings,
      });
      return {
        fileUrl: vod.fileUrl,
        storageKey: vod.videoId,
        provider: "ALIYUN_VOD",
        vodVideoId: vod.videoId,
      };
    }
    // 点播未启用时，视频可回退到 OSS / 本地
    if (settings.storageProvider === "ALIYUN_OSS") {
      return putOss(input);
    }
    return putLocal(input);
  }

  if (settings.storageProvider === "ALIYUN_OSS") {
    return putOss(input);
  }
  return putLocal(input);
}

export async function deleteStoredFile(
  fileUrl: string,
  ownerId: string,
  opts?: { vodVideoId?: string; storageProvider?: string },
) {
  if (!fileUrl && !opts?.vodVideoId) return;

  if (
    opts?.storageProvider === "ALIYUN_VOD" ||
    isVodUrl(fileUrl) ||
    opts?.vodVideoId
  ) {
    await deleteVodVideo(opts?.vodVideoId || videoIdFromVodUrl(fileUrl));
    return;
  }

  if (fileUrl.startsWith(`/uploads/${ownerId}/`)) {
    const absolute = path.join(process.cwd(), "public", fileUrl);
    try {
      await unlink(absolute);
    } catch {
      // ignore
    }
    return;
  }

  const settings = await getSiteSettings();
  if (settings.storageProvider !== "ALIYUN_OSS") return;
  try {
    const creds = getOssCreds(settings);
    let objectKey = "";
    try {
      objectKey = new URL(fileUrl).pathname.replace(/^\//, "");
    } catch {
      return;
    }
    if (!objectKey) return;
    const host = ossEndpointHost({
      ossEndpoint: creds.endpoint,
      ossRegion: creds.region,
      ossBucket: creds.bucket,
    });
    await ossRequest({
      method: "DELETE",
      host,
      path: `/${objectKey}`,
      resource: `/${creds.bucket}/${objectKey}`,
      accessKeyId: creds.accessKeyId,
      accessKeySecret: creds.accessKeySecret,
    });
  } catch {
    // ignore delete errors
  }
}

/** 探测 Bucket 是否可访问 */
export async function testOssConnection(settings?: SiteSettingsRow) {
  const row = settings || (await getSiteSettings());
  const creds = getOssCreds(row);
  const host = ossEndpointHost({
    ossEndpoint: creds.endpoint,
    ossRegion: creds.region,
    ossBucket: creds.bucket,
  });
  const result = await ossRequest({
    method: "GET",
    host,
    path: "/?max-keys=1",
    resource: `/${creds.bucket}/`,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
  });
  if (!result.ok && result.status !== 404) {
    // 404 bucket 不存在；403 权限不足
    if (result.status === 404) {
      return {
        ok: false,
        code: "BUCKET_NOT_FOUND",
        message: `Bucket「${creds.bucket}」不存在，可点击一键创建`,
        publicBase: "",
      };
    }
    return {
      ok: false,
      code: "OSS_ERROR",
      message: `OSS 访问失败（${result.status}）：${result.text.slice(0, 180)}`,
      publicBase: "",
    };
  }
  const publicBase = (creds.publicBaseUrl || `https://${host}`).replace(
    /\/$/,
    "",
  );
  return {
    ok: true,
    code: "OK",
    message: `OSS 连接成功：${creds.bucket}（oss-${creds.region}）`,
    publicBase,
  };
}

/** 创建 Bucket + 配置公共读 CORS，便于视频直链播放 */
export async function ensureOssBucket(settings?: SiteSettingsRow) {
  const row = settings || (await getSiteSettings());
  const creds = getOssCreds(row);
  const host = ossEndpointHost({
    ossEndpoint: creds.endpoint,
    ossRegion: creds.region,
    ossBucket: creds.bucket,
  });

  const createBody = `<?xml version="1.0" encoding="UTF-8"?>
<CreateBucketConfiguration>
  <StorageClass>Standard</StorageClass>
  <DataRedundancyType>LRS</DataRedundancyType>
</CreateBucketConfiguration>`;

  const createRes = await ossRequest({
    method: "PUT",
    host,
    path: "/",
    resource: `/${creds.bucket}/`,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    contentType: "application/xml",
    headers: {
      "x-oss-acl": "public-read",
    },
    body: createBody,
  });

  // 200/409 BucketAlreadyExists / BucketAlreadyOwnedByYou 都可继续
  if (
    !createRes.ok &&
    createRes.status !== 409 &&
    !createRes.text.includes("BucketAlreadyExists") &&
    !createRes.text.includes("BucketAlreadyOwnedByYou")
  ) {
    throw new Error(
      `创建 Bucket 失败（${createRes.status}）：${createRes.text.slice(0, 240)}`,
    );
  }

  const corsBody = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`;

  const corsRes = await ossRequest({
    method: "PUT",
    host,
    path: "/?cors",
    resource: `/${creds.bucket}/?cors`,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    contentType: "application/xml",
    body: corsBody,
  });
  if (!corsRes.ok) {
    throw new Error(
      `Bucket 已就绪，但 CORS 设置失败（${corsRes.status}）：${corsRes.text.slice(0, 200)}`,
    );
  }

  const publicBase = (creds.publicBaseUrl || `https://${host}`).replace(
    /\/$/,
    "",
  );
  return {
    ok: true,
    bucket: creds.bucket,
    region: `oss-${creds.region}`,
    publicBase,
    message: `Bucket「${creds.bucket}」已就绪，并已设置为公共读 + CORS`,
  };
}

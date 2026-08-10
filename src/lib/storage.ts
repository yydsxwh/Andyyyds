import { access, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getSiteSettings, type SiteSettingsRow } from "./site-settings";

import {
  uploadVideoToVod,
  vodConfigured,
  deleteVodVideo,
  videoIdFromVodUrl,
  isVodUrl,
  getVodPlayUrl,
  vodUrlFromVideoId,
} from "./aliyun-vod";

/** 本地上传丢失时的统一提示（部署曾误清 public/uploads） */
export const LOCAL_MEDIA_MISSING_MESSAGE =
  "视频文件不存在或已被清理，请老师在素材中心重新上传，并在课程编辑里重新绑定该课时";

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

/** 私有 Bucket 读链默认有效期；封面/装修图在 SSR 时重签即可 */
const OSS_SIGNED_URL_TTL_SEC = 60 * 60;

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

function ossVirtualHost(creds: Pick<OssCreds, "bucket" | "region" | "endpoint">) {
  return ossEndpointHost({
    ossEndpoint: creds.endpoint,
    ossRegion: creds.region,
    ossBucket: creds.bucket,
  });
}

/** 判断 URL 是否指向当前站点配置的 OSS Bucket，并取出 object key */
function ossObjectKeyFromUrl(fileUrl: string, creds: OssCreds): string | null {
  try {
    const url = new URL(fileUrl);
    const host = ossVirtualHost(creds).toLowerCase();
    const hostname = url.hostname.toLowerCase();
    const publicBase = creds.publicBaseUrl.replace(/\/$/, "").toLowerCase();
    const matchesConfiguredHost = hostname === host;
    const matchesPublicBase =
      Boolean(publicBase) &&
      fileUrl.toLowerCase().startsWith(`${publicBase}/`);
    // 兼容未填 endpoint、仅存默认虚拟主机域名的历史链接
    const matchesBucketHost =
      hostname === `${creds.bucket.toLowerCase()}.oss-${creds.region}.aliyuncs.com` ||
      hostname.startsWith(`${creds.bucket.toLowerCase()}.oss-`);
    if (!matchesConfiguredHost && !matchesPublicBase && !matchesBucketHost) {
      return null;
    }
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    return key || null;
  } catch {
    return null;
  }
}

/**
 * 为私有 Bucket 对象签发 GET 临时 URL。
 * 新版 OSS 常关闭「对象 ACL」，上传时不能再带 x-oss-object-acl，读须走签名。
 */
export function signOssGetUrl(input: {
  objectKey: string;
  creds: OssCreds;
  expiresInSec?: number;
}) {
  const expires =
    Math.floor(Date.now() / 1000) +
    (input.expiresInSec ?? OSS_SIGNED_URL_TTL_SEC);
  const resource = `/${input.creds.bucket}/${input.objectKey}`;
  const stringToSign = `GET\n\n\n${expires}\n${resource}`;
  const signature = crypto
    .createHmac("sha1", input.creds.accessKeySecret)
    .update(stringToSign)
    .digest("base64");
  const host = ossVirtualHost(input.creds);
  const base = (
    input.creds.publicBaseUrl || `https://${host}`
  ).replace(/\/$/, "");
  const params = new URLSearchParams({
    OSSAccessKeyId: input.creds.accessKeyId,
    Expires: String(expires),
    Signature: signature,
  });
  return `${base}/${input.objectKey}?${params.toString()}`;
}

/**
 * 本地/外链原样返回；本站 OSS 对象返回签名 URL（兼容私有 Bucket）。
 * 若未配置 OSS 密钥则退回原始 URL，避免装修页整体挂掉。
 */
export async function resolveStoredAccessUrl(
  fileUrl: string,
  expiresInSec = OSS_SIGNED_URL_TTL_SEC,
): Promise<string> {
  if (!fileUrl || fileUrl.startsWith("/") || isVodUrl(fileUrl)) {
    return fileUrl;
  }
  try {
    const settings = await getSiteSettings();
    if (settings.storageProvider !== "ALIYUN_OSS") return fileUrl;
    const creds = getOssCreds(settings);
    const objectKey = ossObjectKeyFromUrl(fileUrl, creds);
    if (!objectKey) return fileUrl;
    return signOssGetUrl({ objectKey, creds, expiresInSec });
  } catch {
    return fileUrl;
  }
}

/**
 * 历史本地路径 `/uploads/...`：优先读本机 public；
 * 若文件已丢，再尝试同 key 的私有 OSS（兼容「库里仍是本地路径、文件已迁到 Bucket」）。
 */
async function resolveLocalUploadAccessUrl(fileUrl: string): Promise<string> {
  const relative = fileUrl.replace(/^\/+/, "");
  const absolute = path.join(process.cwd(), "public", relative);
  try {
    await access(absolute);
    return fileUrl.startsWith("/") ? fileUrl : `/${relative}`;
  } catch {
    // 本地没有时再查 OSS，避免学员只看到黑屏却无说明
  }

  try {
    const settings = await getSiteSettings();
    if (settings.storageProvider === "ALIYUN_OSS") {
      const creds = getOssCreds(settings);
      const signed = signOssGetUrl({ objectKey: relative, creds });
      const head = await fetch(signed, { method: "HEAD" });
      if (head.ok) return signed;
    }
  } catch {
    // OSS 探测失败则走下方统一错误
  }

  throw new Error(LOCAL_MEDIA_MISSING_MESSAGE);
}

/** 点播签发播放地址；OSS 私有对象签发临时读链；其它直链原样返回 */
export async function resolveMediaAccessUrl(fileUrl: string): Promise<string> {
  if (!fileUrl) return "";
  if (isVodUrl(fileUrl)) {
    const videoId = videoIdFromVodUrl(fileUrl);
    if (!videoId) return "";
    return getVodPlayUrl(videoId);
  }
  // 勿把 /uploads 直接当可播地址返回：部署丢文件后会导致「已购却播不了」且无错误文案
  if (fileUrl.startsWith("/uploads/")) {
    return resolveLocalUploadAccessUrl(fileUrl);
  }
  return resolveStoredAccessUrl(fileUrl);
}

/**
 * 课时播放源：优先素材上的点播 VideoId / fileUrl，再回退 lesson.videoUrl。
 * 合成课与后续改绑素材时，素材表往往比课时字段更新。
 */
export function pickLessonMediaSource(input: {
  videoUrl?: string | null;
  mediaAsset?: {
    fileUrl?: string | null;
    vodVideoId?: string | null;
    storageProvider?: string | null;
  } | null;
}): string {
  const asset = input.mediaAsset;
  if (asset?.vodVideoId?.trim()) {
    return vodUrlFromVideoId(asset.vodVideoId.trim());
  }
  if (
    asset?.storageProvider === "ALIYUN_VOD" &&
    asset.fileUrl &&
    isVodUrl(asset.fileUrl)
  ) {
    return asset.fileUrl;
  }
  const assetUrl = asset?.fileUrl?.trim() || "";
  if (assetUrl) return assetUrl;
  return (input.videoUrl || "").trim();
}

/** 列表/详情页展示封面时批量签发，保持 DB 仍存 canonical OSS URL */
export async function withSignedCoverUrls<T extends { coverUrl: string }>(
  items: T[],
): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      coverUrl: await resolveStoredAccessUrl(item.coverUrl),
    })),
  );
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

function xmlTag(text: string, tag: string) {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return m?.[1]?.trim() || "";
}

/**
 * 把 OSS 403 转成可操作的中文说明。
 * 「because of bucket acl」常被误判成对象 ACL 头；实际多为 RAM 对 oss:PutObject ImplicitDeny，
 * 或 AccessKey 所属账号与 Bucket 不一致。
 */
function explainOssHttpError(status: number, body: string): string {
  const code = xmlTag(body, "Code") || `HTTP_${status}`;
  const message = xmlTag(body, "Message");
  const authAction = xmlTag(body, "AuthAction");
  const noPermissionType = xmlTag(body, "NoPermissionType");
  const policyType = xmlTag(body, "PolicyType");
  const principalType = xmlTag(body, "AuthPrincipalType");

  if (
    message.includes("does not belong to you") ||
    message.includes("bucket you access does not belong")
  ) {
    return (
      `OSS ${status} ${code}：当前 AccessKey 无权管理 Bucket（桶可能属于其他阿里云账号）。` +
      `请确认站点设置里的 OSS AccessKey 与 Bucket「所属账号」一致，并为该 RAM 用户授予该桶的读写权限。`
    );
  }

  if (
    authAction === "oss:PutObject" ||
    message.includes("because of bucket acl")
  ) {
    const detail = [
      authAction && `动作 ${authAction}`,
      noPermissionType && `拒绝类型 ${noPermissionType}`,
      policyType && `策略 ${policyType}`,
      principalType && `主体 ${principalType}`,
    ]
      .filter(Boolean)
      .join("；");
    return (
      `OSS ${status} AccessDenied：RAM 未授予写入权限（${detail || message}）。` +
      `请在阿里云控制台给该 AccessKey 对应 RAM 用户添加 oss:PutObject / GetObject / DeleteObject / ListObjects，` +
      `并确认 Bucket 在其可访问的资源组内。代码侧已不再发送 x-oss-object-acl。`
    );
  }

  const brief = (message || body).replace(/\s+/g, " ").slice(0, 180);
  return `OSS ${status} ${code}${brief ? `：${brief}` : ""}`;
}

async function ossRequest(input: {
  method: "GET" | "PUT" | "POST" | "DELETE" | "HEAD";
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

/** 规范化存储子路径（媒体类型/分类），防路径穿越 */
function safeStorageSubPath(raw?: string): string {
  if (!raw?.trim()) return "";
  return raw
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .map((seg) => seg.replace(/[^\w.\u4e00-\u9fa5-]+/g, "_").slice(0, 40))
    .filter((seg) => seg && seg !== "." && seg !== "..")
    .join("/");
}

async function putLocal(input: {
  ownerId: string;
  fileName: string;
  buffer: Buffer;
  /** 如 image/封面图 → public/uploads/{owner}/image/封面图/ */
  subPath?: string;
}): Promise<StoredObject> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storedName = `${stamp}-${safeFileName(input.fileName)}`;
  const sub = safeStorageSubPath(input.subPath);
  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    input.ownerId,
    ...(sub ? sub.split("/") : []),
  );
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), input.buffer);
  const rel = sub
    ? `/uploads/${input.ownerId}/${sub}/${storedName}`
    : `/uploads/${input.ownerId}/${storedName}`;
  return { fileUrl: rel, storageKey: rel, provider: "LOCAL" };
}

async function putOss(input: {
  ownerId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  /** 如 image/未分类 → uploads/{owner}/image/未分类/ */
  subPath?: string;
}): Promise<StoredObject> {
  const settings = await getSiteSettings();
  const creds = getOssCreds(settings);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sub = safeStorageSubPath(input.subPath);
  const objectKey = sub
    ? `${creds.prefix}/${input.ownerId}/${sub}/${stamp}-${safeFileName(input.fileName)}`
    : `${creds.prefix}/${input.ownerId}/${stamp}-${safeFileName(input.fileName)}`;
  const host = ossEndpointHost({
    ossEndpoint: creds.endpoint,
    ossRegion: creds.region,
    ossBucket: creds.bucket,
  });
  const contentType = input.mimeType || "application/octet-stream";
  // 不传 x-oss-object-acl：对象继承 Bucket 默认私有；读用签名 URL。
  // 403「because of bucket acl」多半是 RAM 无 PutObject，不是缺这个头。
  const result = await ossRequest({
    method: "PUT",
    host,
    path: `/${objectKey}`,
    resource: `/${creds.bucket}/${objectKey}`,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    contentType,
    body: input.buffer,
  });
  if (!result.ok) {
    throw new Error(`OSS 上传失败: ${explainOssHttpError(result.status, result.text)}`);
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
  /**
   * 对象键子目录：按媒体类型/素材分类分桶（如 image/风景），
   * 便于在 OSS/本地 uploads 里按分类查找。
   */
  subPath?: string;
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

/** 探测 Bucket 是否可 List（不等于可上传；PDF 入库还需 PutObject） */
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
      message: explainOssHttpError(result.status, result.text),
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
    message: `OSS 列表权限正常：${creds.bucket}（oss-${creds.region}）。文档上传还需 PutObject，请再点「测试 OSS 上传」。`,
    publicBase,
  };
}

/**
 * 实际上传一个极小私有对象（无 ACL 头），验证素材 PDF/图片能否入库。
 * List 成功但 Put 失败时，素材中心会表现为「视频 OK、文档 403」。
 */
export async function testOssUpload(settings?: SiteSettingsRow) {
  const row = settings || (await getSiteSettings());
  const creds = getOssCreds(row);
  const host = ossEndpointHost({
    ossEndpoint: creds.endpoint,
    ossRegion: creds.region,
    ossBucket: creds.bucket,
  });
  const objectKey = `${creds.prefix}/_probe/${Date.now()}-oss-upload-test.txt`;
  const put = await ossRequest({
    method: "PUT",
    host,
    path: `/${objectKey}`,
    resource: `/${creds.bucket}/${objectKey}`,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    contentType: "text/plain",
    body: Buffer.from("yyds-oss-upload-probe"),
  });
  if (!put.ok) {
    return {
      ok: false,
      code: "OSS_PUT_DENIED",
      message: explainOssHttpError(put.status, put.text),
      publicBase: "",
      objectKey,
    };
  }

  // 探测成功后尽量删掉，避免堆积；删除失败不影响结论
  await ossRequest({
    method: "DELETE",
    host,
    path: `/${objectKey}`,
    resource: `/${creds.bucket}/${objectKey}`,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
  });

  const publicBase = (creds.publicBaseUrl || `https://${host}`).replace(
    /\/$/,
    "",
  );
  return {
    ok: true,
    code: "OK",
    message: `OSS 上传探测成功：已向 ${creds.bucket}/${objectKey} 写入并清理（无对象 ACL）。PDF/图片等可走 OSS 入库。`,
    publicBase,
    objectKey,
  };
}

/** 创建私有 Bucket + CORS；读访问由应用签发临时 URL，不依赖对象/公共 ACL */
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

  // 不传 x-oss-acl：默认即私有；部分账号已关闭 ACL，传 public-read/private 都可能失败
  const createRes = await ossRequest({
    method: "PUT",
    host,
    path: "/",
    resource: `/${creds.bucket}/`,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    contentType: "application/xml",
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

  // 浏览器直传需要 PUT/POST + ETag；仅 GET 会导致素材中心大文件跨域失败
  const corsBody = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>x-oss-request-id</ExposeHeader>
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
    message: `Bucket「${creds.bucket}」已就绪（私有 + CORS）。预览/播放由站点签发临时链接，无需公共读`,
  };
}

export function ossStorageConfigured(settings: SiteSettingsRow) {
  return (
    settings.storageProvider === "ALIYUN_OSS" &&
    Boolean(
      settings.ossAccessKeyId?.trim() &&
        settings.ossAccessKeySecret?.trim() &&
        settings.ossBucket?.trim(),
    )
  );
}

/** 为浏览器直传补齐 Bucket CORS（幂等）；失败不阻断，由前端错误提示排查 */
export async function ensureOssBrowserUploadCors() {
  const settings = await getSiteSettings();
  if (!ossStorageConfigured(settings)) return;
  const creds = getOssCreds(settings);
  const host = ossVirtualHost(creds);
  const corsBody = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>x-oss-request-id</ExposeHeader>
    <MaxAgeSeconds>600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`;
  await ossRequest({
    method: "PUT",
    host,
    path: "/?cors",
    resource: `/${creds.bucket}/?cors`,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    contentType: "application/xml",
    body: corsBody,
  });
}

const OSS_MULTIPART_PART_BYTES = 8 * 1024 * 1024;

function encodeOssObjectKey(objectKey: string) {
  return objectKey
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

/** 浏览器直传：服务端发起分片，只签发预签名 URL，永不把长期 Secret 交给前端 */
export async function createOssBrowserMultipart(input: {
  ownerId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  subPath?: string;
}): Promise<{
  uploadId: string;
  objectKey: string;
  host: string;
  fileUrl: string;
  partSize: number;
  parts: Array<{ partNumber: number; url: string }>;
}> {
  if (input.fileSize <= 0) throw new Error("文件大小无效");
  if (input.fileSize > 2 * 1024 * 1024 * 1024) {
    throw new Error("文件不能超过 2GB");
  }
  const settings = await getSiteSettings();
  const creds = getOssCreds(settings);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sub = safeStorageSubPath(input.subPath);
  const objectKey = sub
    ? `${creds.prefix}/${input.ownerId}/${sub}/${stamp}-${safeFileName(input.fileName)}`
    : `${creds.prefix}/${input.ownerId}/${stamp}-${safeFileName(input.fileName)}`;
  const host = ossVirtualHost(creds);
  const contentType = input.mimeType || "application/octet-stream";

  const init = await ossRequest({
    method: "POST",
    host,
    path: `/${encodeOssObjectKey(objectKey)}?uploads`,
    resource: `/${creds.bucket}/${objectKey}?uploads`,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    contentType,
    body: "",
  });
  if (!init.ok) {
    throw new Error(`OSS 初始化分片失败: ${explainOssHttpError(init.status, init.text)}`);
  }
  const uploadId = xmlTag(init.text, "UploadId");
  if (!uploadId) throw new Error("OSS 未返回 UploadId");

  const partCount = Math.max(1, Math.ceil(input.fileSize / OSS_MULTIPART_PART_BYTES));
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 6; // 大文件上传给足时间
  const parts: Array<{ partNumber: number; url: string }> = [];
  for (let partNumber = 1; partNumber <= partCount; partNumber++) {
    const resource = `/${creds.bucket}/${objectKey}?partNumber=${partNumber}&uploadId=${uploadId}`;
    const stringToSign = `PUT\n\n\n${expires}\n${resource}`;
    const signature = crypto
      .createHmac("sha1", creds.accessKeySecret)
      .update(stringToSign)
      .digest("base64");
    const params = new URLSearchParams({
      partNumber: String(partNumber),
      uploadId,
      OSSAccessKeyId: creds.accessKeyId,
      Expires: String(expires),
      Signature: signature,
    });
    parts.push({
      partNumber,
      url: `https://${host}/${encodeOssObjectKey(objectKey)}?${params.toString()}`,
    });
  }

  const publicBase = (creds.publicBaseUrl || `https://${host}`).replace(/\/$/, "");
  return {
    uploadId,
    objectKey,
    host,
    fileUrl: `${publicBase}/${objectKey}`,
    partSize: OSS_MULTIPART_PART_BYTES,
    parts,
  };
}

export async function completeOssBrowserMultipart(input: {
  objectKey: string;
  uploadId: string;
  parts: Array<{ partNumber: number; etag: string }>;
}) {
  const settings = await getSiteSettings();
  const creds = getOssCreds(settings);
  const host = ossVirtualHost(creds);
  const sorted = [...input.parts].sort((a, b) => a.partNumber - b.partNumber);
  const body =
    `<CompleteMultipartUpload>` +
    sorted
      .map(
        (p) =>
          `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>"${p.etag.replace(/"/g, "")}"</ETag></Part>`,
      )
      .join("") +
    `</CompleteMultipartUpload>`;
  const result = await ossRequest({
    method: "POST",
    host,
    path: `/${encodeOssObjectKey(input.objectKey)}?uploadId=${encodeURIComponent(input.uploadId)}`,
    resource: `/${creds.bucket}/${input.objectKey}?uploadId=${input.uploadId}`,
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    contentType: "application/xml",
    body,
  });
  if (!result.ok) {
    throw new Error(
      `OSS 完成分片失败: ${explainOssHttpError(result.status, result.text)}`,
    );
  }
}

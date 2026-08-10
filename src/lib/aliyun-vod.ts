import crypto from "crypto";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RPCClient = require("@alicloud/pop-core") as {
  new (config: {
    accessKeyId: string;
    accessKeySecret: string;
    endpoint: string;
    apiVersion: string;
  }): {
    request: (
      action: string,
      params: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => Promise<unknown>;
  };
};
import { prisma } from "./db";
import {
  getSiteSettings,
  invalidateSiteSettingsCache,
  type SiteSettingsRow,
} from "./site-settings";

export const VOD_URL_PREFIX = "vod:";

export function isVodUrl(url: string) {
  return Boolean(url?.startsWith(VOD_URL_PREFIX));
}

export function vodUrlFromVideoId(videoId: string) {
  return `${VOD_URL_PREFIX}${videoId}`;
}

export function videoIdFromVodUrl(url: string) {
  if (!isVodUrl(url)) return "";
  return url.slice(VOD_URL_PREFIX.length);
}

/** 去掉拷贝 AccessKey 时常见的 BOM / 零宽字符，避免签名永远对不上 */
function sanitizeAccessKey(value: string) {
  return (value || "")
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

export function vodConfigured(settings: SiteSettingsRow) {
  return Boolean(
    sanitizeAccessKey(settings.vodAccessKeyId) &&
      sanitizeAccessKey(settings.vodAccessKeySecret),
  );
}

function vodErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function isSignatureMismatch(error: unknown) {
  const code = vodErrorCode(error);
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    code === "SignatureDoesNotMatch" ||
    /signature is not matched/i.test(message)
  );
}

/**
 * 将阿里云 POP 长错误（含 StringToSign 全文）收成可展示的中文短句。
 * 素材中心保存旁不应直接甩服务端签名原文。
 */
export function formatVodError(error: unknown): string {
  const code = vodErrorCode(error);
  const raw = error instanceof Error ? error.message : String(error || "");

  if (isSignatureMismatch(error)) {
    return "点播 AccessKey 签名校验失败：请在系统设置重新填写与 AccessKey ID 配对的 Secret（可与 OSS 使用同一对密钥）";
  }
  if (
    code === "InvalidAccessKeyId.NotFound" ||
    /access key is not found/i.test(raw)
  ) {
    return "点播 AccessKey ID 无效或不存在，请检查系统设置";
  }
  if (
    code === "Forbidden.RAM" ||
    code === "Forbidden" ||
    /user not authorized|forbidden\.ram/i.test(raw)
  ) {
    return "点播 AccessKey 权限不足，请为该 RAM 用户开通视频点播权限";
  }
  if (code === "InvalidTemplateGroupId.NotFound") {
    return "点播转码模板组不存在，请检查 TemplateGroupId（不转码可用 VOD_NO_TRANSCODE）";
  }

  // 去掉「server string to sign…」与尾部 URL，避免界面被签名串撑爆
  const short = raw
    .replace(/\s*server string to sign is:[\s\S]*$/i, "")
    .replace(/,\s*URL:\s*https?:\/\/\S+/gi, "")
    .trim();
  if (!short) return "点播请求失败";
  if (short.length > 120) return `点播请求失败：${short.slice(0, 100)}…`;
  return short.startsWith("点播") ? short : `点播请求失败：${short}`;
}

/**
 * CreateUploadVideo 的 FileName 只需带合法扩展名；中文名放 Title 展示即可。
 * 使用 ASCII 文件名，避免个别环境下表单编码与签名计算不一致。
 */
function vodApiFileName(originalName: string) {
  const match = originalName.match(/(\.[A-Za-z0-9]{1,8})$/);
  const ext = (match?.[1] || ".mp4").toLowerCase();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `upload-${stamp}${ext}`;
}

function createVodClient(accessKeyId: string, accessKeySecret: string, regionId: string) {
  return new RPCClient({
    accessKeyId,
    accessKeySecret,
    endpoint: `https://vod.${regionId}.aliyuncs.com`,
    apiVersion: "2017-03-21",
  });
}

type VodKeyPair = {
  accessKeyId: string;
  accessKeySecret: string;
  /** 是否来自 OSS 栏密钥回退（用于纠正库里的错误点播 Secret） */
  usedOssFallback: boolean;
};

/**
 * 解析点播签名用密钥。
 * 业务上常与 OSS 共用同一 AccessKeyId；若点播 Secret 填错会 SignatureDoesNotMatch，
 * 而同一 ID 只有一个正确 Secret —— 此时用 OSS Secret 重试并写回点播配置。
 */
function resolveVodKeyCandidates(settings: SiteSettingsRow): VodKeyPair[] {
  const accessKeyId = sanitizeAccessKey(settings.vodAccessKeyId);
  const vodSecret = sanitizeAccessKey(settings.vodAccessKeySecret);
  const ossId = sanitizeAccessKey(settings.ossAccessKeyId);
  const ossSecret = sanitizeAccessKey(settings.ossAccessKeySecret);

  const candidates: VodKeyPair[] = [];
  if (accessKeyId && vodSecret) {
    candidates.push({
      accessKeyId,
      accessKeySecret: vodSecret,
      usedOssFallback: false,
    });
  }
  // 同一 AK 时，错误的点播 Secret 会导致所有接口签名失败；追加 OSS Secret 作为候选
  if (
    accessKeyId &&
    ossId &&
    accessKeyId === ossId &&
    ossSecret &&
    ossSecret !== vodSecret
  ) {
    candidates.push({
      accessKeyId,
      accessKeySecret: ossSecret,
      usedOssFallback: true,
    });
  }
  return candidates;
}

async function persistCorrectedVodSecret(secret: string) {
  try {
    await prisma.siteSettings.update({
      where: { id: "default" },
      data: { vodAccessKeySecret: secret },
    });
    invalidateSiteSettingsCache();
  } catch {
    // 纠正失败不阻断本次上传
  }
}

async function vodRpcRequest(
  settings: SiteSettingsRow,
  action: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const regionId = sanitizeAccessKey(settings.vodRegionId) || "cn-shanghai";
  const candidates = resolveVodKeyCandidates(settings);
  if (candidates.length === 0) {
    throw new Error("请先在系统设置中填写阿里云点播 AccessKey");
  }

  let lastError: unknown;
  for (let i = 0; i < candidates.length; i++) {
    const key = candidates[i];
    try {
      const client = createVodClient(
        key.accessKeyId,
        key.accessKeySecret,
        regionId,
      );
      const result = await client.request(action, params, { method: "POST" });
      // 用 OSS Secret 签通后，把点播栏错误 Secret 纠正为同一对密钥
      if (key.usedOssFallback) {
        await persistCorrectedVodSecret(key.accessKeySecret);
      }
      return result;
    } catch (error) {
      lastError = error;
      const hasNext = i < candidates.length - 1;
      // 仅签名不匹配时尝试下一组密钥；权限/参数错误不要误换密钥
      if (!(hasNext && isSignatureMismatch(error))) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("点播请求失败");
}

function signOssPut(input: {
  accessKeySecret: string;
  contentType: string;
  date: string;
  securityToken: string;
  resource: string;
}) {
  const canonicalHeaders = `x-oss-security-token:${input.securityToken}\n`;
  const stringToSign = `PUT\n\n${input.contentType}\n${input.date}\n${canonicalHeaders}${input.resource}`;
  return crypto
    .createHmac("sha1", input.accessKeySecret)
    .update(stringToSign)
    .digest("base64");
}

type CreateUploadVideoResult = {
  VideoId: string;
  UploadAddress: string;
  UploadAuth: string;
};

type UploadAddress = {
  Endpoint: string;
  Bucket: string;
  FileName: string;
};

type UploadAuth = {
  AccessKeyId: string;
  AccessKeySecret: string;
  SecurityToken: string;
};

export type VodDirectUploadCredential = {
  videoId: string;
  fileUrl: string;
  host: string;
  bucket: string;
  objectKey: string;
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
};

/** 点播临时桶虚拟主机；Endpoint 已带 bucket 前缀时不再拼接，避免签错域 */
function resolveVodOssHost(bucket: string, endpointRaw: string) {
  const endpoint = endpointRaw.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!endpoint) throw new Error("点播未返回 OSS Endpoint");
  if (endpoint === bucket || endpoint.startsWith(`${bucket}.`)) {
    return endpoint;
  }
  return `${bucket}.${endpoint}`;
}

function encodeOssObjectKey(objectKey: string) {
  return objectKey
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function xmlTag(text: string, tag: string) {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return m?.[1]?.trim() || "";
}

/**
 * 服务端用 STS 签 URL（Query 签名）。
 * 浏览器不能可靠设置 Date，前端自签易 SignatureDoesNotMatch；预签名可彻底避开。
 */
function buildVodStsSignedUrl(input: {
  method: "PUT" | "POST";
  host: string;
  bucket: string;
  objectKey: string;
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  expires: number;
  contentType?: string;
  subresources?: Record<string, string>;
}) {
  const subs: Record<string, string> = {
    "security-token": input.securityToken,
    ...(input.subresources || {}),
  };
  const canonicalQuery = Object.keys(subs)
    .sort()
    .map((k) => `${k}=${subs[k]}`)
    .join("&");
  const resource = `/${input.bucket}/${input.objectKey}?${canonicalQuery}`;
  const stringToSign = `${input.method}\n\n${input.contentType || ""}\n${input.expires}\n${resource}`;
  const signature = crypto
    .createHmac("sha1", input.accessKeySecret)
    .update(stringToSign)
    .digest("base64");

  const params = new URLSearchParams();
  for (const key of Object.keys(subs).sort()) {
    params.set(key, subs[key]!);
  }
  params.set("OSSAccessKeyId", input.accessKeyId);
  params.set("Expires", String(input.expires));
  params.set("Signature", signature);
  return `https://${input.host}/${encodeOssObjectKey(input.objectKey)}?${params.toString()}`;
}

async function vodOssHeaderRequest(input: {
  method: "GET" | "PUT" | "POST" | "DELETE";
  host: string;
  path: string;
  resource: string;
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  contentType?: string;
  body?: string;
}) {
  const date = new Date().toUTCString();
  const contentType = input.contentType || "";
  const headers: Record<string, string> = {
    Date: date,
    "x-oss-security-token": input.securityToken,
  };
  if (contentType) headers["Content-Type"] = contentType;
  const ossHeaders = Object.keys(headers)
    .filter((k) => k.toLowerCase().startsWith("x-oss-"))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((k) => `${k.toLowerCase()}:${headers[k]!.trim()}`)
    .join("\n");
  const canonicalHeaders = ossHeaders ? `${ossHeaders}\n` : "";
  const stringToSign = `${input.method}\n\n${contentType}\n${date}\n${canonicalHeaders}${input.resource}`;
  const signature = crypto
    .createHmac("sha1", input.accessKeySecret)
    .update(stringToSign)
    .digest("base64");
  headers.Authorization = `OSS ${input.accessKeyId}:${signature}`;

  const res = await fetch(`https://${input.host}${input.path}`, {
    method: input.method,
    headers,
    body: input.body ?? "",
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

export type VodBrowserMultipartCredential = {
  videoId: string;
  fileUrl: string;
  host: string;
  bucket: string;
  objectKey: string;
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  uploadId: string;
  partSize: number;
  parts: Array<{ partNumber: number; url: string }>;
};

/**
 * 仅向点播申请上传凭证，不把文件经本机中转。
 * 浏览器拿 STS 直传阿里云 OSS（点播侧 Bucket），避免 Next/nginx 大包缓冲与 OOM。
 */
export async function createVodDirectUpload(input: {
  title: string;
  fileName: string;
  settings?: SiteSettingsRow;
}): Promise<VodDirectUploadCredential> {
  const settings = input.settings || (await getSiteSettings());
  if (!vodConfigured(settings)) {
    throw new Error("请先在系统设置中填写阿里云点播 AccessKey");
  }

  const title =
    (input.title || "").trim().slice(0, 128) ||
    input.fileName.replace(/\.[^.]+$/, "").slice(0, 128) ||
    "未命名视频";
  const params: Record<string, string> = {
    Title: title,
    FileName: vodApiFileName(input.fileName),
  };
  if (settings.vodTemplateGroupId?.trim()) {
    params.TemplateGroupId = settings.vodTemplateGroupId.trim();
  }

  let created: CreateUploadVideoResult;
  try {
    created = (await vodRpcRequest(
      settings,
      "CreateUploadVideo",
      params,
    )) as CreateUploadVideoResult;
  } catch (error) {
    throw new Error(formatVodError(error));
  }

  if (!created?.VideoId || !created.UploadAddress || !created.UploadAuth) {
    throw new Error("点播未返回上传凭证");
  }

  const address = JSON.parse(
    Buffer.from(created.UploadAddress, "base64").toString("utf8"),
  ) as UploadAddress;
  const auth = JSON.parse(
    Buffer.from(created.UploadAuth, "base64").toString("utf8"),
  ) as UploadAuth;

  const bucket = address.Bucket;
  const objectKey = address.FileName.replace(/^\//, "");
  return {
    videoId: created.VideoId,
    fileUrl: vodUrlFromVideoId(created.VideoId),
    host: resolveVodOssHost(bucket, address.Endpoint),
    bucket,
    objectKey,
    accessKeyId: auth.AccessKeyId,
    accessKeySecret: auth.AccessKeySecret,
    securityToken: auth.SecurityToken,
  };
}

/**
 * 点播浏览器直传：只签发「单次预签名 PUT」（已在生产探测 PUT=200）。
 * 故意不用 InitMultipart——点播临时桶上分片初始化易 SignatureDoesNotMatch，
 * 单次 PUT 官方上限 5GB，站点上限 2GB，足够且路径更稳。
 */
export async function createVodBrowserMultipart(input: {
  title: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  settings?: SiteSettingsRow;
}): Promise<VodBrowserMultipartCredential> {
  if (input.fileSize <= 0) throw new Error("文件大小无效");
  if (input.fileSize > 2 * 1024 * 1024 * 1024) {
    throw new Error("文件不能超过 2GB");
  }

  const cred = await createVodDirectUpload(input);
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 6;
  const url = buildVodStsSignedUrl({
    method: "PUT",
    host: cred.host,
    bucket: cred.bucket,
    objectKey: cred.objectKey,
    accessKeyId: cred.accessKeyId,
    accessKeySecret: cred.accessKeySecret,
    securityToken: cred.securityToken,
    expires,
    contentType: "",
  });
  return {
    ...cred,
    uploadId: "",
    partSize: Math.max(input.fileSize, 1),
    parts: [{ partNumber: 1, url }],
  };
}

/** 浏览器分片上传完成后，由服务端持 STS 合并（Node 可设 Date） */
export async function completeVodBrowserMultipart(input: {
  host: string;
  bucket: string;
  objectKey: string;
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  uploadId: string;
  parts: Array<{ partNumber: number; etag: string }>;
}) {
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
  const result = await vodOssHeaderRequest({
    method: "POST",
    host: input.host,
    path: `/${encodeOssObjectKey(input.objectKey)}?uploadId=${encodeURIComponent(input.uploadId)}`,
    resource: `/${input.bucket}/${input.objectKey}?uploadId=${input.uploadId}`,
    accessKeyId: input.accessKeyId,
    accessKeySecret: input.accessKeySecret,
    securityToken: input.securityToken,
    contentType: "application/xml",
    body,
  });
  if (!result.ok) {
    throw new Error(
      `点播合并分片失败（${result.status}）：${result.text.slice(0, 160)}`,
    );
  }
}

/** 上传视频到阿里云点播，返回 VideoId（服务端代理路径；大文件请用直传） */
export async function uploadVideoToVod(input: {
  title: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  settings?: SiteSettingsRow;
}): Promise<{ videoId: string; fileUrl: string; provider: "ALIYUN_VOD" }> {
  const cred = await createVodDirectUpload(input);
  const contentType = input.mimeType || "application/octet-stream";
  const date = new Date().toUTCString();
  const signature = signOssPut({
    accessKeySecret: cred.accessKeySecret,
    contentType,
    date,
    securityToken: cred.securityToken,
    resource: `/${cred.bucket}/${cred.objectKey}`,
  });

  const putRes = await fetch(`https://${cred.host}/${cred.objectKey}`, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      Date: date,
      "x-oss-security-token": cred.securityToken,
      Authorization: `OSS ${cred.accessKeyId}:${signature}`,
    },
    body: new Blob([Uint8Array.from(input.buffer)]),
  });

  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    throw new Error(
      `点播文件上传失败（${putRes.status}）：${text.slice(0, 120)}`,
    );
  }

  return {
    videoId: cred.videoId,
    fileUrl: cred.fileUrl,
    provider: "ALIYUN_VOD",
  };
}

type PlayInfoResponse = {
  PlayInfoList?: {
    PlayInfo?: Array<{ PlayURL?: string; Format?: string; Definition?: string }>;
  };
};

/** 根据 VideoId 获取可播放地址 */
export async function getVodPlayUrl(
  videoId: string,
  settings?: SiteSettingsRow,
): Promise<string> {
  const row = settings || (await getSiteSettings());
  if (!vodConfigured(row)) {
    throw new Error("未配置阿里云点播");
  }
  const params: Record<string, string> = { VideoId: videoId };
  if (row.vodPlayDomain?.trim()) {
    params.PlayDomain = row.vodPlayDomain.trim().replace(/^https?:\/\//, "");
  }

  let data: PlayInfoResponse;
  try {
    data = (await vodRpcRequest(row, "GetPlayInfo", params)) as PlayInfoResponse;
  } catch (error) {
    throw new Error(formatVodError(error));
  }

  const list = data.PlayInfoList?.PlayInfo || [];
  const preferred =
    list.find((p) => (p.Format || "").toLowerCase() === "mp4") || list[0];
  const playUrl = preferred?.PlayURL;
  if (!playUrl) {
    throw new Error("点播暂无播放地址，视频可能仍在处理中，请稍后重试");
  }
  return playUrl;
}

export async function resolveMediaPlayUrl(fileUrl: string): Promise<string> {
  if (!fileUrl) return "";
  if (isVodUrl(fileUrl)) {
    const videoId = videoIdFromVodUrl(fileUrl);
    if (!videoId) return "";
    return getVodPlayUrl(videoId);
  }
  // 动态导入避免与 storage 循环依赖；私有 OSS 直链改为签名读
  const { resolveStoredAccessUrl } = await import("./storage");
  return resolveStoredAccessUrl(fileUrl);
}

export async function testVodConnection(settings?: SiteSettingsRow) {
  const row = settings || (await getSiteSettings());
  if (!vodConfigured(row)) {
    return { ok: false, message: "请先填写点播 AccessKey ID 与 Secret" };
  }
  try {
    // 轻量探测：拉取空列表；签名正确即视为连通
    await vodRpcRequest(row, "GetVideoList", { PageNo: 1, PageSize: 1 });
    return { ok: true, message: "点播连接成功" };
  } catch (error) {
    // 个别账号对空列表返回业务码而非成功，但签名已通过则仍算连通
    if (
      !isSignatureMismatch(error) &&
      vodErrorCode(error) &&
      !/InvalidAccessKey|Forbidden/i.test(vodErrorCode(error))
    ) {
      return { ok: true, message: "点播连接成功（密钥有效）" };
    }
    return { ok: false, message: formatVodError(error) };
  }
}

export async function deleteVodVideo(videoId: string) {
  if (!videoId) return;
  const settings = await getSiteSettings();
  if (!vodConfigured(settings)) return;
  try {
    await vodRpcRequest(settings, "DeleteVideo", { VideoIds: videoId });
  } catch {
    // ignore
  }
}

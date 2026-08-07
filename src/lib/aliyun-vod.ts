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

/** 上传视频到阿里云点播，返回 VideoId */
export async function uploadVideoToVod(input: {
  title: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  settings?: SiteSettingsRow;
}): Promise<{ videoId: string; fileUrl: string; provider: "ALIYUN_VOD" }> {
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

  const endpoint = address.Endpoint.replace(/^https?:\/\//, "");
  const host = `${address.Bucket}.${endpoint}`;
  const objectKey = address.FileName.replace(/^\//, "");
  const contentType = input.mimeType || "application/octet-stream";
  const date = new Date().toUTCString();
  const signature = signOssPut({
    accessKeySecret: auth.AccessKeySecret,
    contentType,
    date,
    securityToken: auth.SecurityToken,
    resource: `/${address.Bucket}/${objectKey}`,
  });

  const putRes = await fetch(`https://${host}/${objectKey}`, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      Date: date,
      "x-oss-security-token": auth.SecurityToken,
      Authorization: `OSS ${auth.AccessKeyId}:${signature}`,
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
    videoId: created.VideoId,
    fileUrl: vodUrlFromVideoId(created.VideoId),
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

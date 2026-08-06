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
import { getSiteSettings, type SiteSettingsRow } from "./site-settings";

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

export function vodConfigured(settings: SiteSettingsRow) {
  return Boolean(
    settings.vodAccessKeyId?.trim() && settings.vodAccessKeySecret?.trim(),
  );
}

function createVodClient(settings: SiteSettingsRow) {
  const regionId = (settings.vodRegionId || "cn-shanghai").trim();
  return new RPCClient({
    accessKeyId: settings.vodAccessKeyId.trim(),
    accessKeySecret: settings.vodAccessKeySecret.trim(),
    endpoint: `https://vod.${regionId}.aliyuncs.com`,
    apiVersion: "2017-03-21",
  });
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

  const client = createVodClient(settings);
  const params: Record<string, string> = {
    Title: input.title.slice(0, 128) || input.fileName,
    FileName: input.fileName,
  };
  if (settings.vodTemplateGroupId?.trim()) {
    params.TemplateGroupId = settings.vodTemplateGroupId.trim();
  }

  const created = (await client.request("CreateUploadVideo", params, {
    method: "POST",
  })) as CreateUploadVideoResult;

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
    throw new Error(`点播文件上传失败（${putRes.status}）：${text.slice(0, 180)}`);
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
  const client = createVodClient(row);
  const params: Record<string, string> = { VideoId: videoId };
  if (row.vodPlayDomain?.trim()) {
    params.PlayDomain = row.vodPlayDomain.trim().replace(/^https?:\/\//, "");
  }

  const data = (await client.request("GetPlayInfo", params, {
    method: "POST",
  })) as PlayInfoResponse;

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
  if (!isVodUrl(fileUrl)) return fileUrl;
  const videoId = videoIdFromVodUrl(fileUrl);
  if (!videoId) return "";
  return getVodPlayUrl(videoId);
}

export async function testVodConnection(settings?: SiteSettingsRow) {
  const row = settings || (await getSiteSettings());
  if (!vodConfigured(row)) {
    return { ok: false, message: "请先填写点播 AccessKey ID 与 Secret" };
  }
  try {
    const client = createVodClient(row);
    // 轻量探测：拉取空列表
    await client.request(
      "GetVideoList",
      { PageNo: 1, PageSize: 1 },
      { method: "POST" },
    );
    return { ok: true, message: "点播连接成功" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "点播连接失败";
    return { ok: false, message };
  }
}

export async function deleteVodVideo(videoId: string) {
  if (!videoId) return;
  const settings = await getSiteSettings();
  if (!vodConfigured(settings)) return;
  try {
    const client = createVodClient(settings);
    await client.request(
      "DeleteVideo",
      { VideoIds: videoId },
      { method: "POST" },
    );
  } catch {
    // ignore
  }
}

import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getSiteSettings } from "./site-settings";

export type StoredObject = {
  fileUrl: string;
  storageKey: string;
  provider: "LOCAL" | "ALIYUN_OSS";
};

function safeFileName(name: string) {
  return name.replace(/[^\w.\u4e00-\u9fa5-]+/g, "_").slice(0, 80) || "file.bin";
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
  const region = settings.ossRegion.replace(/^oss-/, "");
  return `${settings.ossBucket}.oss-${region}.aliyuncs.com`;
}

async function putOss(input: {
  ownerId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<StoredObject> {
  const settings = await getSiteSettings();
  const accessKeyId = settings.ossAccessKeyId;
  const accessKeySecret = settings.ossAccessKeySecret;
  const bucket = settings.ossBucket;
  if (!accessKeyId || !accessKeySecret || !bucket || !settings.ossRegion) {
    throw new Error("阿里云 OSS 未配置完整，请在系统设置中填写");
  }

  const prefix = (settings.ossPrefix || "uploads").replace(/^\/|\/$/g, "");
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const objectKey = `${prefix}/${input.ownerId}/${stamp}-${safeFileName(input.fileName)}`;
  const host = ossEndpointHost(settings);
  const date = new Date().toUTCString();
  const contentType = input.mimeType || "application/octet-stream";
  const canonicalResource = `/${bucket}/${objectKey}`;
  const stringToSign = `PUT\n\n${contentType}\n${date}\n${canonicalResource}`;
  const signature = crypto
    .createHmac("sha1", accessKeySecret)
    .update(stringToSign)
    .digest("base64");

  const url = `https://${host}/${objectKey}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Date: date,
      "Content-Type": contentType,
      Authorization: `OSS ${accessKeyId}:${signature}`,
      "Content-Length": String(input.buffer.length),
    },
    body: new Uint8Array(input.buffer),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OSS 上传失败: ${res.status} ${text.slice(0, 200)}`);
  }

  const publicBase = (settings.ossPublicBaseUrl || `https://${host}`).replace(
    /\/$/,
    "",
  );
  return {
    fileUrl: `${publicBase}/${objectKey}`,
    storageKey: objectKey,
    provider: "ALIYUN_OSS",
  };
}

export async function storeUpload(input: {
  ownerId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<StoredObject> {
  const settings = await getSiteSettings();
  if (settings.storageProvider === "ALIYUN_OSS") {
    return putOss(input);
  }
  return putLocal(input);
}

export async function deleteStoredFile(fileUrl: string, ownerId: string) {
  if (!fileUrl) return;

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
  if (!settings.ossAccessKeyId || !settings.ossAccessKeySecret || !settings.ossBucket) {
    return;
  }

  let objectKey = "";
  try {
    const u = new URL(fileUrl);
    objectKey = u.pathname.replace(/^\//, "");
  } catch {
    return;
  }
  if (!objectKey) return;

  const host = ossEndpointHost(settings);
  const date = new Date().toUTCString();
  const canonicalResource = `/${settings.ossBucket}/${objectKey}`;
  const stringToSign = `DELETE\n\n\n${date}\n${canonicalResource}`;
  const signature = crypto
    .createHmac("sha1", settings.ossAccessKeySecret)
    .update(stringToSign)
    .digest("base64");

  await fetch(`https://${host}/${objectKey}`, {
    method: "DELETE",
    headers: {
      Date: date,
      Authorization: `OSS ${settings.ossAccessKeyId}:${signature}`,
    },
  }).catch(() => undefined);
}

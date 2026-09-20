/**
 * platform Storage 兼容适配层。
 *
 * 渐进迁移，不是一刀切：
 * - 未配置 PLATFORM_STORAGE_ENABLED 时，一切行为与迁移前完全一致
 * - 开启后，新上传交给 platform，库里存稳定引用 `platform://<fileId>`
 * - 历史数据仍是 OSS / 本地 URL，继续走原来的解析路径，不需要回填
 *
 * 只在服务端使用：PLATFORM_SERVICE_TOKEN 不能进浏览器包。
 */

import {
  createPlatformClient,
  PlatformApiError,
  type PlatformClient,
} from "@yydsxwh/shared/platform-client/index";

/** 库里存的稳定引用；签名 URL 会过期，绝不能直接入库 */
export const PLATFORM_URL_PREFIX = "platform://";

export const DEFAULT_PLATFORM_NAMESPACE = "media";

let cached: PlatformClient | null | undefined;

/** 未配置或配置不全时返回 null，调用方据此回退到本地实现 */
export function getPlatformClient(): PlatformClient | null {
  if (cached !== undefined) return cached;
  const baseUrl = process.env.PLATFORM_API_URL?.trim();
  const serviceToken = process.env.PLATFORM_SERVICE_TOKEN?.trim();
  if (!baseUrl || !serviceToken) {
    cached = null;
    return cached;
  }
  cached = createPlatformClient({
    baseUrl,
    serviceToken,
    clientId: process.env.PLATFORM_CLIENT_ID?.trim() || "andyyyds",
  });
  return cached;
}

/** 测试与配置变更后重置缓存 */
export function resetPlatformClientCache(): void {
  cached = undefined;
}

/**
 * 存储是否已切到 platform。
 * 必须显式开启：默认关闭意味着这次改动上线后行为零变化，出问题也只用改一个环境变量。
 */
export function platformStorageEnabled(): boolean {
  if (process.env.PLATFORM_STORAGE_ENABLED !== "true") return false;
  return getPlatformClient() !== null;
}

export function isPlatformStoredUrl(fileUrl: string): boolean {
  return Boolean(fileUrl) && fileUrl.startsWith(PLATFORM_URL_PREFIX);
}

export function platformFileIdFromUrl(fileUrl: string): string {
  return fileUrl.slice(PLATFORM_URL_PREFIX.length);
}

export function platformStoredUrl(fileId: string): string {
  return `${PLATFORM_URL_PREFIX}${fileId}`;
}

export type PlatformStoredObject = {
  fileUrl: string;
  storageKey: string;
  provider: "LOCAL" | "ALIYUN_OSS" | "ALIYUN_VOD";
};

/** 经 platform 中转上传，返回可入库的稳定引用 */
export async function storeUploadViaPlatform(input: {
  ownerId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  namespace?: string;
  subPath?: string;
}): Promise<PlatformStoredObject> {
  const client = getPlatformClient();
  if (!client) throw new Error("platform 未配置");

  const record = await client.withActor(input.ownerId).storage.proxyUpload(
    new Blob([new Uint8Array(input.buffer)], {
      type: input.mimeType || "application/octet-stream",
    }),
    {
      namespace: input.namespace || DEFAULT_PLATFORM_NAMESPACE,
      fileName: input.fileName,
      ownerId: input.ownerId,
      // subPath 只作为排查用标签，不承担业务数据职责
      labels: input.subPath ? { subPath: input.subPath } : undefined,
    },
  );

  return {
    fileUrl: platformStoredUrl(record.fileId),
    storageKey: record.key,
    provider: record.provider,
  };
}

/**
 * 换取短期签名下载地址。
 * platform 不可达时返回 null，由调用方决定降级展示，不要让整页挂掉。
 */
export async function resolvePlatformAccessUrl(
  fileUrl: string,
  options: { expiresInSeconds?: number; downloadFileName?: string } = {},
): Promise<string | null> {
  const client = getPlatformClient();
  if (!client) return null;
  try {
    const result = await client.storage.createDownloadUrl(
      platformFileIdFromUrl(fileUrl),
      {
        expiresInSeconds: options.expiresInSeconds,
        downloadFileName: options.downloadFileName,
      },
    );
    return result.url;
  } catch (error) {
    logPlatformFailure("取下载链接", error);
    return null;
  }
}

/** 删除失败不阻断业务流程，与原有本地删除的容错一致 */
export async function deletePlatformStoredFile(fileUrl: string): Promise<void> {
  const client = getPlatformClient();
  if (!client) return;
  try {
    await client.storage.deleteFile(platformFileIdFromUrl(fileUrl));
  } catch (error) {
    if (error instanceof PlatformApiError && error.code === "NOT_FOUND") return;
    logPlatformFailure("删除文件", error);
  }
}

function logPlatformFailure(action: string, error: unknown): void {
  const detail =
    error instanceof PlatformApiError
      ? `${error.code} ${error.message}${error.requestId ? ` (requestId=${error.requestId})` : ""}`
      : (error as Error)?.message || String(error);
  // 只记错误码与 requestId，绝不打印凭证或签名 URL
  console.error(`[platform-storage] ${action}失败：${detail}`);
}

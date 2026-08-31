/**
 * 论坛发帖附件：图片走现有 /api/upload/image；视频走 OSS 分片或小文件代理。
 * 仅在客户端调用。
 */

import { uploadFileWithSignedParts } from "@andyyyds/shared/browser-oss-multipart";
import type { ForumMediaKind } from "@andyyyds/forum/lib/forum";

type PrepareResponse = {
  error?: string;
  mode?: "oss_multipart" | "proxy";
  kind?: ForumMediaKind;
  mimeType?: string;
  oss?: {
    uploadId: string;
    objectKey: string;
    fileUrl: string;
    partSize: number;
    parts: Array<{ partNumber: number; url: string }>;
  };
};

function isImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
}

function isVideoFile(file: File) {
  if (file.type.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|m4v|avi)$/i.test(file.name);
}

export function classifyForumFile(file: File): ForumMediaKind | null {
  if (isImageFile(file)) return "image";
  if (isVideoFile(file)) return "video";
  return null;
}

export async function uploadForumMediaFile(file: File): Promise<{
  kind: ForumMediaKind;
  url: string;
  previewUrl: string;
}> {
  const kind = classifyForumFile(file);
  if (!kind) throw new Error("只支持图片或视频");

  if (kind === "image") {
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/upload/image", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "图片上传失败");
    return {
      kind: "image",
      url: data.url as string,
      previewUrl: (data.previewUrl as string) || (data.url as string),
    };
  }

  const prepareRes = await fetch("/api/forum/media/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || "",
      sizeBytes: file.size,
    }),
  });
  const prepare = (await prepareRes.json()) as PrepareResponse;
  if (!prepareRes.ok) throw new Error(prepare.error || "无法开始上传视频");

  if (prepare.mode === "proxy") {
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/forum/media", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "视频上传失败");
    return {
      kind: "video",
      url: data.url as string,
      previewUrl: (data.previewUrl as string) || (data.url as string),
    };
  }

  if (prepare.mode === "oss_multipart" && prepare.oss) {
    const parts = await uploadFileWithSignedParts({
      file,
      partSize: prepare.oss.partSize,
      parts: prepare.oss.parts,
    });
    const completeRes = await fetch("/api/forum/media/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: prepare.mimeType || file.type || "",
        fileUrl: prepare.oss.fileUrl,
        oss: {
          objectKey: prepare.oss.objectKey,
          uploadId: prepare.oss.uploadId,
          parts,
        },
      }),
    });
    const data = await completeRes.json();
    if (!completeRes.ok) throw new Error(data.error || "视频上传失败");
    return {
      kind: "video",
      url: data.url as string,
      previewUrl: (data.previewUrl as string) || (data.url as string),
    };
  }

  throw new Error("未知的上传方式");
}

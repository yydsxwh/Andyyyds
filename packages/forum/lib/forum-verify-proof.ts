/**
 * 学生认证照片：后台预览必须走 inline，下载才带 attachment。
 * 不能把入库的 canonical OSS 地址直接当 <a href>，浏览器会当文件下载。
 */

import { access } from "fs/promises";
import path from "path";
import {
  probeStoredObject,
  resolveStoredAccessByKey,
  resolveStoredAccessUrl,
  storedFileDownloadName,
  storedFileMimeType,
  type StoredObjectProbe,
} from "@andyyyds/shared/storage";

export const FORUM_VERIFY_PROOF_TTL_SEC = 10 * 60;

export type ForumVerifyProofMode = "preview" | "download" | "meta";

export function forumVerifyProofPath(
  id: string,
  mode: ForumVerifyProofMode,
): string {
  return `/api/studio/forum/verifications/${id}/proof?mode=${mode}`;
}

export function parseForumVerifyProofMode(
  raw: string | null,
): ForumVerifyProofMode {
  if (raw === "download" || raw === "meta") return raw;
  return "preview";
}

export type ForumVerifyProofMeta = StoredObjectProbe & {
  previewDisposition: "inline";
  downloadDisposition: "attachment";
  /** 旧后台把同一条 proofUrl 当链接打开，等于没走 inline 预览 */
  previewUsesAttachmentLink: false;
};

export async function getForumVerifyProofMeta(
  proofUrl: string,
): Promise<ForumVerifyProofMeta> {
  const probe = await probeStoredObject(proofUrl);
  return {
    ...probe,
    previewDisposition: "inline",
    downloadDisposition: "attachment",
    previewUsesAttachmentLink: false,
  };
}

export async function resolveForumVerifyProofTarget(
  proofUrl: string,
  mode: Exclude<ForumVerifyProofMode, "meta">,
): Promise<
  | { kind: "local"; absolutePath: string; mimeType: string; fileName: string }
  | { kind: "remote"; url: string }
  | { kind: "missing" }
> {
  const fileName = storedFileDownloadName(proofUrl, "student-proof.jpg");
  const mimeType = storedFileMimeType(proofUrl);
  const disposition = mode === "download" ? "attachment" : "inline";

  if (proofUrl.startsWith("/uploads/")) {
    const relative = proofUrl.replace(/^\/+/, "");
    const absolute = path.join(process.cwd(), "public", relative);
    try {
      await access(absolute);
      return { kind: "local", absolutePath: absolute, mimeType, fileName };
    } catch {
      // 库里仍是 /uploads 时，文件可能已在 OSS 同 key
      const signed = await resolveStoredAccessByKey(relative, {
        expiresInSec: FORUM_VERIFY_PROOF_TTL_SEC,
        contentDisposition: disposition,
        fileName,
      });
      return signed ? { kind: "remote", url: signed } : { kind: "missing" };
    }
  }

  const signed = await resolveStoredAccessUrl(proofUrl, {
    expiresInSec: FORUM_VERIFY_PROOF_TTL_SEC,
    contentDisposition: disposition,
    fileName,
  });
  if (!signed) return { kind: "missing" };
  if (signed.startsWith("/")) {
    const absolute = path.join(process.cwd(), "public", signed.replace(/^\/+/, ""));
    try {
      await access(absolute);
      return { kind: "local", absolutePath: absolute, mimeType, fileName };
    } catch {
      return { kind: "missing" };
    }
  }
  return { kind: "remote", url: signed };
}

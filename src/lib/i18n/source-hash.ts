import { createHash } from "crypto";

/** 源文指纹：变更后对应译文应标记 stale */
export function hashSourceText(text: string): string {
  return createHash("sha256").update(text || "", "utf8").digest("hex").slice(0, 32);
}

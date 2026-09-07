/**
 * 文档保存快捷键。Ctrl+S / ⌘S 都算，避免只拦一边。
 */

export function isDocsSaveHotkey(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): boolean {
  if (event.altKey) return false;
  if (event.key.toLowerCase() !== "s") return false;
  return event.ctrlKey || event.metaKey;
}

/** 直聊双方稳定键：与顺序无关，便于查重进行中的会话 */
export function buildDirectKey(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join("__");
}

/**
 * 后台保存按钮旁的结果提示：成功 / 失败原因。
 * 各设置面板共用，避免有的只 toast、有的无反馈。
 */

export type SaveStatus =
  | { kind: "ok"; text: string }
  | { kind: "error"; text: string }
  | null;

export function SaveFeedback({ status }: { status: SaveStatus }) {
  if (!status?.text) return null;
  const ok = status.kind === "ok";
  return (
    <span
      role="status"
      aria-live="polite"
      className={`text-sm font-medium ${
        ok ? "text-[var(--brand-strong)]" : "text-[var(--fire-strong)]"
      }`}
    >
      {ok ? `✓ ${status.text}` : status.text}
    </span>
  );
}

/** 解析接口 JSON；非 JSON / 网络失败时给出可读原因 */
export async function readSaveResponse(res: Response): Promise<{
  ok: boolean;
  error: string;
  data: Record<string, unknown>;
}> {
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      error: `服务器响应异常（HTTP ${res.status}），请稍后重试`,
      data: {},
    };
  }
  if (!res.ok) {
    const err =
      typeof data.error === "string" && data.error.trim()
        ? data.error.trim()
        : `保存失败（HTTP ${res.status}）`;
    return { ok: false, error: err, data };
  }
  return { ok: true, error: "", data };
}

/** fetch 包裹：断网等抛错时转成 error 文案 */
export async function postSave(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ ok: boolean; error: string; data: Record<string, unknown> }> {
  try {
    const res = await fetch(input, init);
    return readSaveResponse(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "网络异常";
    return {
      ok: false,
      error: `无法连接服务器：${msg}`,
      data: {},
    };
  }
}

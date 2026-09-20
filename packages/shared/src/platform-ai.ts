/**
 * platform AI 兼容适配层。
 *
 * 目标：产品不再自己保存任何厂商 Key。Provider、Base URL、API Key、模型路由、
 * 限流与用量统计都归 platform；本站只说「我要做什么用途、给这些消息」。
 *
 * 渐进迁移：`PLATFORM_AI_ENABLED` 未开启时完全走原有直连实现，行为零变化；
 * 开启后 platform 不可达或未配 Provider 也会自动回落，AI 功能不会因此不可用。
 *
 * 只在服务端使用：PLATFORM_SERVICE_TOKEN 不能进浏览器包。
 */

import type {
  AiChatMessage,
  AiChatResponse,
  AiPurpose,
} from "@yydsxwh/shared/contracts/ai";
import { PlatformApiError } from "@yydsxwh/shared/platform-client/index";

import { getPlatformClient } from "./platform-storage";

export function platformAiEnabled(): boolean {
  if (process.env.PLATFORM_AI_ENABLED !== "true") return false;
  return getPlatformClient() !== null;
}

export type PlatformAiAttempt =
  | { ok: true; content: string; response: AiChatResponse }
  | { ok: false; reason: "DISABLED" | "UNAVAILABLE" };

/**
 * 经 platform 发起一次 AI 调用。
 *
 * 失败不抛异常而是返回 `ok:false`，由调用方决定回落到原有直连实现——
 * 迁移期间任何一方出问题都不该让用户看到功能消失。
 */
export async function chatViaPlatform(input: {
  purpose: AiPurpose;
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  actorId?: string | null;
  metadata?: Record<string, string>;
}): Promise<PlatformAiAttempt> {
  if (!platformAiEnabled()) return { ok: false, reason: "DISABLED" };
  const client = getPlatformClient();
  if (!client) return { ok: false, reason: "DISABLED" };

  try {
    const scoped = input.actorId ? client.withActor(input.actorId) : client;
    const response = await scoped.ai.chat({
      purpose: input.purpose,
      messages: input.messages,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      metadata: input.metadata,
    });
    return { ok: true, content: response.content, response };
  } catch (error) {
    logPlatformAiFailure(input.purpose, error);
    return { ok: false, reason: "UNAVAILABLE" };
  }
}

function logPlatformAiFailure(purpose: string, error: unknown): void {
  const detail =
    error instanceof PlatformApiError
      ? `${error.code}${error.requestId ? ` (requestId=${error.requestId})` : ""}`
      : (error as Error)?.message || String(error);
  // 只记错误码与 requestId：提示词与模型输出可能含用户内容，不进本地日志
  console.error(`[platform-ai] ${purpose} 调用失败，回落本地实现：${detail}`);
}

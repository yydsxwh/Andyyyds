"use client";

/**
 * Studio「AI 接口」面板里的 platform 接管状态。
 *
 * 管理 UI 留在主站，AI 服务实现在 platform。这里展示 platform 侧的
 * Provider 健康度、用途路由与近 7 天用量——**不展示、也拿不到任何 Key**。
 */

import { useEffect, useState } from "react";

type ProviderStatus = {
  providerId: string;
  label: string;
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyEnvName: string;
  health: "HEALTHY" | "DEGRADED" | "UNCONFIGURED";
  consecutiveFailures: number;
  models: Array<{ id: string; vision: boolean }>;
};

type RouteStatus = {
  purpose: string;
  candidates: string[];
  resolved: string | null;
};

type PlatformAiState = {
  enabled: boolean;
  reason?: string;
  unreachable?: boolean;
  providers?: ProviderStatus[];
  routes?: RouteStatus[];
  defaultModel?: string | null;
  usage?: { calls: number; failedCalls: number; totalTokens: number; costMicros: number };
};

const HEALTH_LABEL: Record<ProviderStatus["health"], string> = {
  HEALTHY: "正常",
  DEGRADED: "连续失败，已降级",
  UNCONFIGURED: "未配置 Key",
};

const PURPOSE_LABEL: Record<string, string> = {
  translate: "正文翻译",
  "vision-ocr": "识图转 LaTeX",
  general: "通用文本",
};

/** 百万分之一元 → 元 */
function formatCost(costMicros: number): string {
  return `¥${(costMicros / 1_000_000).toFixed(4)}`;
}

export function PlatformAiStatus() {
  const [state, setState] = useState<PlatformAiState | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/studio/ai")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: PlatformAiState) => {
        if (!cancelled) setState(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="text-xs text-[var(--muted)]">
        读取公共平台 AI 状态失败：{error}
      </p>
    );
  }
  if (!state) {
    return <p className="text-xs text-[var(--muted)]">正在读取公共平台 AI 状态…</p>;
  }

  if (!state.enabled) {
    return (
      <div className="rounded-xl border border-[var(--line)] p-3 text-xs text-[var(--muted)]">
        <strong className="text-[var(--ink)]">公共平台 AI：未接管</strong>
        <p className="mt-1">{state.reason}</p>
        <p className="mt-1">
          接管后 Key 与模型路由由 platform 统一持有，本页下方的本机配置将只作为兜底。
        </p>
      </div>
    );
  }

  if (state.unreachable) {
    return (
      <div className="rounded-xl border border-[var(--line)] p-3 text-xs text-[var(--muted)]">
        <strong className="text-[var(--ink)]">公共平台 AI：已开启但暂时不可达</strong>
        <p className="mt-1">{state.reason}</p>
        <p className="mt-1">当前调用会自动回落到本机配置，功能不受影响。</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--line)] p-3 text-xs">
      <div>
        <strong className="text-sm text-[var(--ink)]">公共平台 AI：已接管</strong>
        <p className="mt-1 text-[var(--muted)]">
          Key 与模型路由由 platform 统一持有，本页不再需要填写 Key；
          下方本机配置仅在 platform 不可达时兜底。
        </p>
      </div>

      <div>
        <div className="font-medium text-[var(--ink)]">用途路由</div>
        <ul className="mt-1 space-y-1 text-[var(--muted)]">
          {(state.routes ?? []).map((route) => (
            <li key={route.purpose}>
              {PURPOSE_LABEL[route.purpose] ?? route.purpose}：
              {route.resolved ? (
                <span className="text-[var(--ink)]">{route.resolved}</span>
              ) : (
                <span>未配置</span>
              )}
              {route.candidates.length > 1 ? `（备选 ${route.candidates.length - 1} 个）` : null}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="font-medium text-[var(--ink)]">Provider</div>
        <ul className="mt-1 space-y-1 text-[var(--muted)]">
          {(state.providers ?? []).map((provider) => (
            <li key={provider.providerId}>
              {provider.label}（{provider.providerId}）· {HEALTH_LABEL[provider.health]}
              {provider.consecutiveFailures > 0
                ? ` · 连续失败 ${provider.consecutiveFailures} 次`
                : null}
              <span className="ml-1">· Key 来自 {provider.apiKeyEnvName}</span>
            </li>
          ))}
        </ul>
      </div>

      {state.usage ? (
        <div className="text-[var(--muted)]">
          近 7 天：调用 {state.usage.calls} 次（失败 {state.usage.failedCalls} 次）·
          token {state.usage.totalTokens} · 成本 {formatCost(state.usage.costMicros)}
        </div>
      ) : null}
    </div>
  );
}

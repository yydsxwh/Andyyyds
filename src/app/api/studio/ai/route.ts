/**
 * GET /api/studio/ai
 *
 * Studio 的「AI 接口」面板据此展示 platform 侧的 Provider 健康度、模型路由与用量。
 *
 * 管理 UI 留在主站，服务实现在 platform：本路由只是代为查询，不持有任何 Key。
 * platform 返回的内容本身就不含 Key，只报「有没有配、来自哪个环境变量名」。
 */

import { NextResponse } from "next/server";

import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";
import { getPlatformClient } from "@andyyyds/shared/platform-storage";
import { platformAiEnabled } from "@andyyyds/shared/platform-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();

    if (!platformAiEnabled()) {
      return NextResponse.json({
        enabled: false,
        reason: getPlatformClient()
          ? "PLATFORM_AI_ENABLED 未开启，当前使用本机 AI 配置"
          : "未配置 PLATFORM_API_URL / PLATFORM_SERVICE_TOKEN，当前使用本机 AI 配置",
      });
    }

    const client = getPlatformClient()!;
    try {
      const [providers, routes, usage] = await Promise.all([
        client.ai.listProviders(),
        client.ai.listRoutes(),
        client.ai.getUsage({}),
      ]);
      return NextResponse.json({
        enabled: true,
        providers: providers.providers,
        routes: routes.routes,
        defaultModel: routes.defaultModel,
        usage: usage.totals,
      });
    } catch (error) {
      // platform 查不通不影响本机 AI 配置继续可用，面板降级展示即可
      return NextResponse.json({
        enabled: true,
        unreachable: true,
        reason: (error as Error)?.message?.slice(0, 200) || "platform 不可达",
      });
    }
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

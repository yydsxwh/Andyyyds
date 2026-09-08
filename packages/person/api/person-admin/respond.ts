import { NextResponse } from "next/server";
import { studioErrorResponse } from "@andyyyds/shared/studio";

/** Next 路由校验要 Response，不能把 studioError 的纯对象直接 return */
export function personAdminError(error: unknown) {
  const mapped = studioErrorResponse(error);
  return NextResponse.json({ error: mapped.error }, { status: mapped.status });
}

/**
 * GET /api/app/download/[file]
 * 302 到 OSS（优先传输加速），避免 88MB 安装包走香港 ECS 公网口。
 */

import { NextResponse } from "next/server";
import {
  getAppInstallerDownloadUrl,
  isAppInstallerFileName,
} from "@andyyyds/shared/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ file: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { file } = await ctx.params;
  const name = decodeURIComponent(file || "").replace(/\\/g, "/");
  if (name.includes("/") || name.includes("..") || !isAppInstallerFileName(name)) {
    return NextResponse.json({ error: "未知安装包" }, { status: 404 });
  }
  const url = await getAppInstallerDownloadUrl(name);
  if (!url) {
    // OSS 未配好时仍走站点静态文件（nginx 直出）
    return NextResponse.redirect(new URL(`/app/_direct/${name}`, _req.url), 302);
  }
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "no-store",
    },
  });
}

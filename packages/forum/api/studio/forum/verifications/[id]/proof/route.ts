/**
 * GET /api/studio/forum/verifications/[id]/proof
 * 站长核对学生证：preview=inline 预览，download=attachment 下载，meta=是否在 OSS。
 */

import { createReadStream } from "fs";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { prisma } from "@andyyyds/shared/db";
import { canManageForum } from "@andyyyds/shared/roles";
import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";
import {
  getForumVerifyProofMeta,
  parseForumVerifyProofMode,
  resolveForumVerifyProofTarget,
} from "@andyyyds/forum/lib/forum-verify-proof";

type Ctx = { params: Promise<{ id: string }> };

function contentDispositionHeader(
  mode: "preview" | "download",
  fileName: string,
) {
  const encoded = encodeURIComponent(fileName);
  return mode === "download"
    ? `attachment; filename="${fileName}"; filename*=UTF-8''${encoded}`
    : `inline; filename="${fileName}"; filename*=UTF-8''${encoded}`;
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    const session = await requireAdmin();
    if (!canManageForum(session)) {
      return NextResponse.json({ error: "仅站长可查看认证照片" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const mode = parseForumVerifyProofMode(new URL(req.url).searchParams.get("mode"));
    const row = await prisma.forumSchoolVerification.findUnique({
      where: { id },
      select: { id: true, proofUrl: true, realName: true },
    });
    if (!row) {
      return NextResponse.json({ error: "认证记录不存在" }, { status: 404 });
    }
    if (!row.proofUrl) {
      return NextResponse.json({ error: "未上传学生证照片" }, { status: 404 });
    }

    if (mode === "meta") {
      const meta = await getForumVerifyProofMeta(row.proofUrl);
      return NextResponse.json(meta);
    }

    const target = await resolveForumVerifyProofTarget(row.proofUrl, mode);
    if (target.kind === "missing") {
      return NextResponse.json(
        { error: "认证照片不存在或已从存储中删除" },
        { status: 404 },
      );
    }

    if (target.kind === "remote") {
      const res = NextResponse.redirect(target.url, 302);
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    }

    const nodeStream = createReadStream(target.absolutePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": target.mimeType,
        "Content-Disposition": contentDispositionHeader(mode, target.fileName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

/**
 * POST /api/docs/export
 * 当前编辑器内容另存为 .docx，含页眉页脚页码。不必先登录。
 */

import { NextResponse } from "next/server";
import { sanitizeDocsContent } from "@andyyyds/docs/lib/docs-content";
import { exportDocsDocx } from "@andyyyds/docs/lib/docs-export";
import { clampDocsTitle } from "@andyyyds/docs/lib/docs-content";
import { normalizePageChrome, safeDownloadName } from "@andyyyds/docs/lib/docs-page";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      title?: string;
      content?: unknown;
      pageChrome?: unknown;
    };
    const title = clampDocsTitle(body.title);
    const buffer = await exportDocsDocx({
      title,
      content: sanitizeDocsContent(body.content),
      pageChrome: normalizePageChrome(body.pageChrome),
    });
    const filename = safeDownloadName(title, "docx");
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "另存失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

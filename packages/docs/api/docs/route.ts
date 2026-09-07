/**
 * GET  /api/docs  当前用户文档列表
 * POST /api/docs  新建一篇
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { sanitizeDocsContent } from "@andyyyds/docs/lib/docs-content";
import { normalizePageChrome } from "@andyyyds/docs/lib/docs-page";
import { normalizeListScheme } from "@andyyyds/docs/lib/docs-scheme";
import {
  createDocsDocument,
  DocsLimitError,
  listDocsDocuments,
} from "@andyyyds/docs/lib/docs-store";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const items = await listDocsDocuments(session.id);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  let body: {
    title?: string;
    content?: unknown;
    listScheme?: unknown;
    pageChrome?: unknown;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  try {
    const doc = await createDocsDocument(session.id, {
      title: body.title,
      content: body.content ? sanitizeDocsContent(body.content) : undefined,
      listScheme: body.listScheme ? normalizeListScheme(body.listScheme) : undefined,
      pageChrome: body.pageChrome ? normalizePageChrome(body.pageChrome) : undefined,
    });
    return NextResponse.json(doc);
  } catch (error) {
    if (error instanceof DocsLimitError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "新建失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * GET / PATCH / DELETE /api/docs/[id]
 * 只允许改自己的文档。
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { DOCS_LOCAL_ID, sanitizeDocsContent } from "@andyyyds/docs/lib/docs-content";
import { normalizePageChrome } from "@andyyyds/docs/lib/docs-page";
import { normalizeListScheme } from "@andyyyds/docs/lib/docs-scheme";
import {
  deleteDocsDocument,
  DocsNotFoundError,
  getDocsDocument,
  updateDocsDocument,
} from "@andyyyds/docs/lib/docs-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function isReservedId(id: string): boolean {
  return id === DOCS_LOCAL_ID;
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (isReservedId(id)) {
    return NextResponse.json({ error: "本地草稿不在云端" }, { status: 400 });
  }
  try {
    const doc = await getDocsDocument(session.id, id);
    return NextResponse.json(doc);
  } catch (error) {
    if (error instanceof DocsNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (isReservedId(id)) {
    return NextResponse.json({ error: "本地草稿请用浏览器保存" }, { status: 400 });
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
    return NextResponse.json({ error: "请求格式不对" }, { status: 400 });
  }
  try {
    const doc = await updateDocsDocument(session.id, id, {
      title: body.title,
      content: body.content === undefined ? undefined : sanitizeDocsContent(body.content),
      listScheme:
        body.listScheme === undefined ? undefined : normalizeListScheme(body.listScheme),
      pageChrome:
        body.pageChrome === undefined ? undefined : normalizePageChrome(body.pageChrome),
    });
    return NextResponse.json(doc);
  } catch (error) {
    if (error instanceof DocsNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (isReservedId(id)) {
    return NextResponse.json({ error: "本地草稿不能从云端删" }, { status: 400 });
  }
  try {
    await deleteDocsDocument(session.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DocsNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}

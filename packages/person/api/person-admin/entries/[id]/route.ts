/**
 * PATCH / DELETE /api/person-admin/entries/[id]
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@andyyyds/shared/studio";
import { personAdminError } from "@andyyyds/person/api/person-admin/respond";
import { deletePersonEntry, updatePersonEntry } from "@andyyyds/person/lib/person-site-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const item = await updatePersonEntry(id, body);
    if (!item) return NextResponse.json({ error: "条目不存在" }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    return personAdminError(error);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const ok = await deletePersonEntry(id);
    if (!ok) return NextResponse.json({ error: "条目不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return personAdminError(error);
  }
}

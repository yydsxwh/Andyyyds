/**
 * GET / POST /api/person-admin/entries
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@andyyyds/shared/studio";
import { personAdminError } from "@andyyyds/person/api/person-admin/respond";
import { isPersonEntryKind } from "@andyyyds/person/lib/person-site";
import {
  createPersonEntry,
  listPersonEntries,
} from "@andyyyds/person/lib/person-site-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const kindRaw = new URL(req.url).searchParams.get("kind") || "";
    const kind = isPersonEntryKind(kindRaw) ? kindRaw : undefined;
    const items = await listPersonEntries({ kind });
    return NextResponse.json({ items });
  } catch (error) {
    return personAdminError(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const item = await createPersonEntry(body);
    return NextResponse.json(item);
  } catch (error) {
    return personAdminError(error);
  }
}

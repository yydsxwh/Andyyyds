/**
 * GET / PATCH /api/person-admin/profile
 * 个人展示站档案。仅站长。拆独立站时这一组 API 跟着走。
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@andyyyds/shared/studio";
import { personAdminError } from "@andyyyds/person/api/person-admin/respond";
import { getPersonProfile, savePersonProfile } from "@andyyyds/person/lib/person-site-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const profile = await getPersonProfile();
    return NextResponse.json(profile);
  } catch (error) {
    return personAdminError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const profile = await savePersonProfile(body);
    return NextResponse.json(profile);
  } catch (error) {
    return personAdminError(error);
  }
}

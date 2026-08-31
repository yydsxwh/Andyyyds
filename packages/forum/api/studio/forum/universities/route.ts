/**
 * GET  /api/studio/forum/universities — 高校分区列表
 * POST /api/studio/forum/universities — 创建高校分区并写入默认专区
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  FORUM_DESC_MAX,
  FORUM_NAME_MAX,
  FORUM_RESERVED_SLUGS,
  FORUM_SLOGAN_MAX,
  normalizeForumSlug,
  slugifyUniversity,
} from "@andyyyds/forum/lib/forum";
import {
  defaultZonesForForumKind,
  parseForumSpaceKind,
} from "@andyyyds/forum/lib/forum-space";
import {
  FORUM_UNIVERSITY_LIST_ORDER_BY,
  guessForumUniversityRegion,
  applyDefaultForumUniversityOrder,
  parseForumUniversityRegion,
} from "@andyyyds/forum/lib/forum-university";
import { prisma } from "@andyyyds/shared/db";
import { canManageForum } from "@andyyyds/shared/roles";
import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";

const createSchema = z.object({
  name: z.string().trim().min(2).max(FORUM_NAME_MAX),
  slug: z.string().trim().max(40).optional(),
  slogan: z.string().trim().max(FORUM_SLOGAN_MAX).optional(),
  description: z.string().trim().max(FORUM_DESC_MAX).optional(),
  logoUrl: z.string().trim().max(500).optional(),
  adImageUrl: z.string().trim().max(500).optional(),
  adHref: z.string().trim().max(500).optional(),
  adAlt: z.string().trim().max(80).optional(),
  emailDomains: z.string().trim().max(200).optional(),
  enabled: z.boolean().optional(),
  region: z.enum(["CHINA", "INTERNATIONAL"]).optional(),
  kind: z.enum(["UNIVERSITY", "CIRCLE", "CITY"]).optional(),
});

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!canManageForum(session)) {
      return NextResponse.json({ error: "仅站长可管理大学论坛" }, { status: 403 });
    }
    const rows = await prisma.forumUniversity.findMany({
      include: {
        _count: { select: { members: true, posts: true, zones: true } },
        zones: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: FORUM_UNIVERSITY_LIST_ORDER_BY,
    });
    return NextResponse.json({ universities: rows });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = createSchema.parse(await req.json());
    const slug = normalizeForumSlug(body.slug || slugifyUniversity(body.name));
    if (!slug || FORUM_RESERVED_SLUGS.has(slug)) {
      return NextResponse.json({ error: "路径不可用，请换一个英文短名" }, { status: 400 });
    }
    const exists = await prisma.forumUniversity.findUnique({ where: { slug } });
    if (exists) {
      return NextResponse.json({ error: "该路径已被占用" }, { status: 400 });
    }
    const kind = parseForumSpaceKind(body.kind);
    const region = body.region
      ? parseForumUniversityRegion(body.region)
      : kind === "UNIVERSITY"
        ? guessForumUniversityRegion(body.name, slug)
        : "CHINA";
    const maxSort = await prisma.forumUniversity.aggregate({
      where: { kind, region },
      _max: { sortOrder: true },
    });
    const university = await prisma.forumUniversity.create({
      data: {
        name: body.name,
        slug,
        slogan: body.slogan || "",
        description: body.description || "",
        logoUrl: body.logoUrl || "",
        adImageUrl: body.adImageUrl || "",
        adHref: body.adHref || "",
        adAlt: body.adAlt || "",
        emailDomains: kind === "UNIVERSITY" ? body.emailDomains || "" : "",
        enabled: body.enabled ?? true,
        kind,
        region,
        sortOrder: (maxSort._max.sortOrder || 0) + 10,
        zones: {
          create: defaultZonesForForumKind(kind).map((zone, index) => ({
            key: zone.key,
            name: zone.name,
            sortOrder: index * 10,
          })),
        },
      },
      include: {
        zones: { orderBy: { sortOrder: "asc" } },
        _count: { select: { members: true, posts: true, zones: true } },
      },
    });
    return NextResponse.json({ university });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

const reorderSchema = z.object({
  chinaIds: z.array(z.string().min(1)).max(500).optional(),
  internationalIds: z.array(z.string().min(1)).max(500).optional(),
  resetDefault: z.boolean().optional(),
});

async function loadUniversities() {
  return prisma.forumUniversity.findMany({
    include: {
      _count: { select: { members: true, posts: true, zones: true } },
      zones: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: FORUM_UNIVERSITY_LIST_ORDER_BY,
  });
}

/**
 * PATCH：站长拖拽保存两类名单次序，或一键恢复清北复交浙人 + 首拼默认序。
 */
export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = reorderSchema.parse(await req.json());
    if (body.resetDefault) {
      const rows = await prisma.forumUniversity.findMany({
        where: { kind: "UNIVERSITY" },
        select: { id: true, name: true, slug: true },
      });
      const planned = applyDefaultForumUniversityOrder(
        rows.map((row) => ({
          ...row,
          region: guessForumUniversityRegion(row.name, row.slug),
        })),
      );
      await prisma.$transaction(
        planned.map((row) =>
          prisma.forumUniversity.update({
            where: { id: row.id },
            data: { region: row.region, sortOrder: row.sortOrder },
          }),
        ),
      );
      return NextResponse.json({ universities: await loadUniversities() });
    }

    const chinaIds = body.chinaIds || [];
    const internationalIds = body.internationalIds || [];
    if (chinaIds.length === 0 && internationalIds.length === 0) {
      return NextResponse.json({ error: "无更新内容" }, { status: 400 });
    }
    const seen = new Set<string>();
    const ops = [];
    for (const [region, ids] of [
      ["CHINA", chinaIds],
      ["INTERNATIONAL", internationalIds],
    ] as const) {
      for (let index = 0; index < ids.length; index += 1) {
        const id = ids[index]!;
        if (seen.has(id)) continue;
        seen.add(id);
        ops.push(
          prisma.forumUniversity.updateMany({
            where: { id, kind: "UNIVERSITY" },
            data: { region, sortOrder: index * 10 },
          }),
        );
      }
    }
    if (ops.length) await prisma.$transaction(ops);
    return NextResponse.json({ universities: await loadUniversities() });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

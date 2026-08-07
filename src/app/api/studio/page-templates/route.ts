/**
 * GET/POST/PUT /api/studio/page-templates —— 站长页面模板 CRUD
 * GET 时自动补齐导航页缺失的系统锁定默认模板。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ensureNavDefaultTemplates } from "@/lib/nav-page-templates";
import {
  cloneModulesForDuplicate,
  createTemplate,
  getTemplateById,
  isSystemDefaultTemplateId,
  normalizePageModules,
  normalizeTemplatesConfig,
  parsePageTemplates,
  stringifyPageTemplates,
  type PageTemplate,
  type PageTemplateType,
  PAGE_MODULE_TYPES,
} from "@/lib/page-templates";
import {
  getSiteSettings,
  invalidateSiteSettingsCache,
} from "@/lib/site-settings";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";

const typeSchema = z.enum([
  "home",
  "company",
  "person",
  "courses",
  "meetup",
  "shop",
  "forum",
  "games",
  "account",
  "custom",
]);

const layoutSchema = z
  .object({
    mode: z.enum(["flow", "absolute"]).optional(),
    column: z.enum(["full", "left", "right"]).optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    zIndex: z.number().optional(),
  })
  .optional();

const moduleSchema = z.object({
  id: z.string().min(1).max(64),
  type: z
    .string()
    .refine((t) => (PAGE_MODULE_TYPES as string[]).includes(t), {
      message: "未知模块类型",
    }),
  props: z.record(z.string(), z.unknown()),
  layout: layoutSchema,
});

const templateBodySchema = z.object({
  id: z.string().min(1).max(64).optional(),
  type: typeSchema.optional(),
  name: z.string().max(80).optional(),
  slug: z.string().max(64).optional(),
  isDefault: z.boolean().optional(),
  coverUrl: z.string().max(800).optional(),
  backgroundUrl: z.string().max(800).optional(),
  modules: z.array(moduleSchema).max(40).optional(),
});

const postSchema = z.object({
  action: z
    .enum(["create", "duplicate", "setDefault", "delete", "syncNavDefaults"])
    .optional(),
  type: typeSchema.optional(),
  name: z.string().max(80).optional(),
  id: z.string().min(1).max(64).optional(),
  template: templateBodySchema.optional(),
});

function isLockedTemplate(tpl: PageTemplate) {
  return Boolean(tpl.locked) || isSystemDefaultTemplateId(tpl.id);
}

async function saveTemplates(templates: PageTemplate[]) {
  const config = normalizeTemplatesConfig(templates);
  const row = await prisma.siteSettings.update({
    where: { id: "default" },
    data: { pageTemplatesJson: stringifyPageTemplates(config) },
    select: { pageTemplatesJson: true, updatedAt: true },
  });
  invalidateSiteSettingsCache();
  return {
    templates: parsePageTemplates(row.pageTemplatesJson).templates,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 补齐/修复系统锁定默认模板并落库（有变更才写） */
async function syncNavDefaultsIfNeeded() {
  const row = await getSiteSettings();
  const parsed = parsePageTemplates(row.pageTemplatesJson);
  const { config, added, changed } = ensureNavDefaultTemplates(parsed);
  if (!changed) {
    return {
      templates: config.templates,
      updatedAt: row.updatedAt.toISOString(),
      added: 0,
    };
  }
  const saved = await saveTemplates(config.templates);
  return { ...saved, added };
}

export async function GET() {
  try {
    await requireAdmin();
    const synced = await syncNavDefaultsIfNeeded();
    return NextResponse.json(synced);
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = postSchema.parse(await req.json());
    const current = parsePageTemplates(
      (await getSiteSettings()).pageTemplatesJson,
    ).templates;
    const action = body.action || "create";

    if (action === "syncNavDefaults") {
      const synced = await syncNavDefaultsIfNeeded();
      return NextResponse.json({
        ...synced,
        message:
          synced.added > 0
            ? `已同步 ${synced.added} 个系统默认模板`
            : "系统默认模板已齐全（不可改删）",
      });
    }

    if (action === "create") {
      const type = (body.type || "home") as PageTemplateType;
      const tpl = createTemplate(type, body.name);
      // 新建一律非默认：须站长点「设为默认」才进前台，避免盖掉系统原页
      tpl.isDefault = false;
      tpl.locked = false;
      const saved = await saveTemplates([tpl, ...current]);
      return NextResponse.json({
        ...saved,
        template: saved.templates.find((t) => t.id === tpl.id) || tpl,
      });
    }

    if (action === "duplicate") {
      const source = getTemplateById({ templates: current }, body.id || "");
      if (!source) {
        return NextResponse.json({ error: "模板不存在" }, { status: 404 });
      }
      // 复制锁定/系统模板 → 可编辑副本（新 id、locked=false、非默认）
      const starter = createTemplate(source.type, `${source.name} 副本`);
      const sourceModules =
        isLockedTemplate(source) || source.modules.length === 0
          ? []
          : source.modules;
      const copy: PageTemplate = {
        ...starter,
        name: `${source.name.replace(/（不可改删）$/, "")} 副本`.slice(0, 80),
        isDefault: false,
        locked: false,
        modules: cloneModulesForDuplicate(sourceModules, starter.modules),
        coverUrl: isLockedTemplate(source) ? "" : source.coverUrl,
        backgroundUrl: isLockedTemplate(source) ? "" : source.backgroundUrl,
        slug:
          source.type === "custom"
            ? `${source.slug || "page"}-copy`.slice(0, 64)
            : "",
      };
      const saved = await saveTemplates([copy, ...current]);
      return NextResponse.json({
        ...saved,
        template: saved.templates.find((t) => t.id === copy.id) || copy,
      });
    }

    if (action === "setDefault") {
      const id = body.id || "";
      const target = getTemplateById({ templates: current }, id);
      if (!target) {
        return NextResponse.json({ error: "模板不存在" }, { status: 404 });
      }
      // 锁定模板允许设为默认：用于恢复系统经典页
      const next = current.map((t) => ({
        ...t,
        isDefault: t.type === target.type ? t.id === id : t.isDefault,
        updatedAt:
          t.id === id || (t.type === target.type && t.isDefault)
            ? new Date().toISOString()
            : t.updatedAt,
      }));
      const saved = await saveTemplates(next);
      return NextResponse.json(saved);
    }

    if (action === "delete") {
      const id = body.id || "";
      const target = getTemplateById({ templates: current }, id);
      if (!target) {
        return NextResponse.json({ error: "模板不存在" }, { status: 404 });
      }
      if (isLockedTemplate(target)) {
        return NextResponse.json(
          { error: "系统默认模板不可删除，可设为默认以恢复原页面" },
          { status: 400 },
        );
      }
      // 删掉默认后同类型不再自动递补；前台回退系统原页，直到站长再设默认
      const next = current.filter((t) => t.id !== id);
      const saved = await saveTemplates(next);
      return NextResponse.json(saved);
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "参数无效" },
        { status: 400 },
      );
    }
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function PUT(req: Request) {
  try {
    await requireAdmin();
    const body = templateBodySchema.parse(await req.json());
    if (!body.id) {
      return NextResponse.json({ error: "缺少模板 id" }, { status: 400 });
    }
    const current = parsePageTemplates(
      (await getSiteSettings()).pageTemplatesJson,
    ).templates;
    const index = current.findIndex((t) => t.id === body.id);
    if (index < 0) {
      return NextResponse.json({ error: "模板不存在" }, { status: 404 });
    }

    const prev = current[index];
    if (isLockedTemplate(prev)) {
      // 锁定模板只允许通过 setDefault 改默认态，禁止改名/模块/封面
      return NextResponse.json(
        { error: "系统默认模板不可修改，请复制后再编辑，或设为默认恢复原页面" },
        { status: 400 },
      );
    }

    const nextTpl: PageTemplate = {
      ...prev,
      name: body.name !== undefined ? body.name.trim() || prev.name : prev.name,
      slug: body.slug !== undefined ? body.slug.trim() : prev.slug,
      coverUrl: body.coverUrl !== undefined ? body.coverUrl.trim() : prev.coverUrl,
      backgroundUrl:
        body.backgroundUrl !== undefined
          ? body.backgroundUrl.trim()
          : prev.backgroundUrl,
      modules:
        body.modules !== undefined
          ? normalizePageModules(body.modules)
          : prev.modules,
      isDefault: body.isDefault !== undefined ? body.isDefault : prev.isDefault,
      locked: false,
      updatedAt: new Date().toISOString(),
    };

    let next = [...current];
    next[index] = nextTpl;
    if (nextTpl.isDefault) {
      next = next.map((t) =>
        t.type === nextTpl.type
          ? { ...t, isDefault: t.id === nextTpl.id }
          : t,
      );
    }

    const saved = await saveTemplates(next);
    return NextResponse.json({
      ...saved,
      template: saved.templates.find((t) => t.id === nextTpl.id) || nextTpl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "参数无效" },
        { status: 400 },
      );
    }
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

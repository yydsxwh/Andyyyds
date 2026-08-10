/**
 * 收集可一键翻译的正文条目（课程 / 约搭 / 分类 / 装扮与门户 JSON）。
 */
import { prisma } from "@/lib/db";
import type { TranslateJobItem } from "@/lib/i18n/content-translate";
import { getSiteSettings } from "@/lib/site-settings";
import { parseDecorate } from "@/lib/decorate";
import { parsePortal } from "@/lib/portal";

function push(
  list: TranslateJobItem[],
  entityType: string,
  entityId: string,
  field: string,
  source: string,
  isHtml?: boolean,
) {
  const text = (source || "").trim();
  if (!text) return;
  list.push({ entityType, entityId, field, source: text, isHtml });
}

export async function collectAllTranslateItems(): Promise<TranslateJobItem[]> {
  const items: TranslateJobItem[] = [];

  const [courses, meetups, categories, settings] = await Promise.all([
    prisma.course.findMany({
      select: {
        id: true,
        title: true,
        subtitle: true,
        description: true,
      },
    }),
    prisma.meetup.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        place: true,
        meetingPoint: true,
        destination: true,
        highlights: true,
        feeIncludes: true,
        refundPolicy: true,
        contentHtml: true,
      },
    }),
    prisma.category.findMany({
      select: { id: true, name: true, description: true },
    }),
    getSiteSettings(),
  ]);

  for (const c of courses) {
    push(items, "course", c.id, "title", c.title);
    push(items, "course", c.id, "subtitle", c.subtitle);
    push(items, "course", c.id, "description", c.description);
  }

  for (const m of meetups) {
    push(items, "meetup", m.id, "title", m.title);
    push(items, "meetup", m.id, "description", m.description || "");
    push(items, "meetup", m.id, "place", m.place || "");
    push(items, "meetup", m.id, "meetingPoint", m.meetingPoint || "");
    push(items, "meetup", m.id, "destination", m.destination || "");
    push(items, "meetup", m.id, "highlights", m.highlights || "");
    push(items, "meetup", m.id, "feeIncludes", m.feeIncludes || "");
    push(items, "meetup", m.id, "refundPolicy", m.refundPolicy || "");
    push(items, "meetup", m.id, "contentHtml", m.contentHtml || "", true);
  }

  for (const cat of categories) {
    push(items, "category", cat.id, "name", cat.name);
    push(items, "category", cat.id, "description", cat.description || "");
  }

  const decorate = parseDecorate(settings.decorateJson);
  push(items, "decorate", "default", "siteName", decorate.siteName || "");
  push(items, "decorate", "default", "brandName", decorate.brandName || "");
  push(items, "decorate", "default", "heroHeadline", decorate.heroHeadline || "");
  push(items, "decorate", "default", "heroSubtext", decorate.heroSubtext || "");
  for (const [i, banner] of (decorate.banners || []).entries()) {
    push(items, "decorate", "default", `banner.${i}.alt`, banner.alt || "");
  }
  if (decorate.heroPrimaryCta?.label) {
    push(
      items,
      "decorate",
      "default",
      "heroPrimaryCta.label",
      decorate.heroPrimaryCta.label,
    );
  }
  if (decorate.heroSecondaryCta?.label) {
    push(
      items,
      "decorate",
      "default",
      "heroSecondaryCta.label",
      decorate.heroSecondaryCta.label,
    );
  }

  const portal = parsePortal(settings.portalJson);
  for (const nav of portal.nav || []) {
    push(items, "portal", "default", `nav.${nav.key}.label`, nav.label || "");
  }
  const company = portal.company;
  if (company) {
    push(items, "portal", "default", "company.title", company.title || "");
    push(items, "portal", "default", "company.subtitle", company.subtitle || "");
    push(items, "portal", "default", "company.body", company.body || "");
  }
  const person = portal.person;
  if (person) {
    push(items, "portal", "default", "person.title", person.title || "");
    push(items, "portal", "default", "person.subtitle", person.subtitle || "");
    push(items, "portal", "default", "person.body", person.body || "");
  }

  return items;
}

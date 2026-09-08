/**
 * 个人展示站读写。档案空时用门户「个人介绍」垫一层，避免拆站前前台空白。
 */

import { prisma } from "@andyyyds/shared/db";
import { getPortalConfig } from "@andyyyds/shared/site-settings";
import {
  DEFAULT_PERSON_PROFILE,
  PERSON_PROFILE_ID,
  isPersonEntryKind,
  normalizeImageList,
  normalizePersonEntry,
  normalizePersonProfile,
  type PersonEntryKind,
  type PersonEntryPayload,
  type PersonProfilePayload,
} from "@andyyyds/person/lib/person-site";

function parseOccurredAt(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toEntryPayload(row: {
  id: string;
  kind: string;
  title: string;
  summary: string;
  body: string;
  coverUrl: string;
  images: string;
  org: string;
  role: string;
  period: string;
  location: string;
  link: string;
  sortOrder: number;
  published: boolean;
  featured: boolean;
  occurredAt: Date | null;
  updatedAt: Date;
}): PersonEntryPayload {
  const kind = isPersonEntryKind(row.kind) ? row.kind : "PROJECT";
  return {
    id: row.id,
    kind,
    title: row.title,
    summary: row.summary,
    body: row.body,
    coverUrl: row.coverUrl,
    images: normalizeImageList(row.images),
    org: row.org,
    role: row.role,
    period: row.period,
    location: row.location,
    link: row.link,
    sortOrder: row.sortOrder,
    published: row.published,
    featured: row.featured,
    occurredAt: row.occurredAt ? row.occurredAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function fallbackProfileFromPortal(): Promise<PersonProfilePayload> {
  const portal = await getPortalConfig();
  return normalizePersonProfile({
    ...DEFAULT_PERSON_PROFILE,
    displayName: portal.person.title || "个人介绍",
    headline: portal.person.subtitle,
    about: portal.person.body,
  });
}

export async function getPersonProfile(): Promise<PersonProfilePayload> {
  const row = await prisma.personProfile.findUnique({
    where: { id: PERSON_PROFILE_ID },
  });
  if (!row) return fallbackProfileFromPortal();
  const profile = normalizePersonProfile({
    ...row,
    extraContacts: row.extraContacts,
  });
  if (!profile.displayName && !profile.about) {
    const fallback = await fallbackProfileFromPortal();
    return {
      ...profile,
      displayName: profile.displayName || fallback.displayName,
      headline: profile.headline || fallback.headline,
      about: profile.about || fallback.about,
    };
  }
  return profile;
}

export async function savePersonProfile(
  input: unknown,
): Promise<PersonProfilePayload> {
  const profile = normalizePersonProfile(input);
  await prisma.personProfile.upsert({
    where: { id: PERSON_PROFILE_ID },
    create: {
      id: PERSON_PROFILE_ID,
      ...profile,
      extraContacts: JSON.stringify(profile.extraContacts),
    },
    update: {
      ...profile,
      extraContacts: JSON.stringify(profile.extraContacts),
    },
  });
  return profile;
}

export async function listPersonEntries(input?: {
  kind?: PersonEntryKind;
  publishedOnly?: boolean;
  featuredOnly?: boolean;
}): Promise<PersonEntryPayload[]> {
  const rows = await prisma.personEntry.findMany({
    where: {
      kind: input?.kind,
      published: input?.publishedOnly ? true : undefined,
      featured: input?.featuredOnly ? true : undefined,
    },
    orderBy: [{ sortOrder: "asc" }, { occurredAt: "desc" }, { updatedAt: "desc" }],
  });
  return rows.map(toEntryPayload);
}

export async function getPersonEntry(
  id: string,
  publishedOnly = false,
): Promise<PersonEntryPayload | null> {
  const row = await prisma.personEntry.findUnique({ where: { id } });
  if (!row) return null;
  if (publishedOnly && !row.published) return null;
  return toEntryPayload(row);
}

export async function createPersonEntry(input: unknown): Promise<PersonEntryPayload> {
  const data = normalizePersonEntry(input);
  const count = await prisma.personEntry.count({ where: { kind: data.kind } });
  const row = await prisma.personEntry.create({
    data: {
      kind: data.kind,
      title: data.title || defaultEntryTitle(data.kind),
      summary: data.summary,
      body: data.body,
      coverUrl: data.coverUrl,
      images: JSON.stringify(data.images),
      org: data.org,
      role: data.role,
      period: data.period,
      location: data.location,
      link: data.link,
      sortOrder: data.sortOrder || count,
      published: data.published,
      featured: data.featured,
      occurredAt: parseOccurredAt(data.occurredAt),
    },
  });
  return toEntryPayload(row);
}

function defaultEntryTitle(kind: PersonEntryKind): string {
  if (kind === "PHOTO") return "照片";
  if (kind === "INTEREST") return "兴趣";
  return "未命名";
}

export async function updatePersonEntry(
  id: string,
  input: unknown,
): Promise<PersonEntryPayload | null> {
  const existing = await prisma.personEntry.findUnique({ where: { id } });
  if (!existing) return null;
  const data = normalizePersonEntry(input, isPersonEntryKind(existing.kind) ? existing.kind : "PROJECT");
  const row = await prisma.personEntry.update({
    where: { id },
    data: {
      kind: data.kind,
      title: data.title || existing.title,
      summary: data.summary,
      body: data.body,
      coverUrl: data.coverUrl,
      images: JSON.stringify(data.images),
      org: data.org,
      role: data.role,
      period: data.period,
      location: data.location,
      link: data.link,
      sortOrder: data.sortOrder,
      published: data.published,
      featured: data.featured,
      occurredAt: parseOccurredAt(data.occurredAt),
    },
  });
  return toEntryPayload(row);
}

export async function deletePersonEntry(id: string): Promise<boolean> {
  const result = await prisma.personEntry.deleteMany({ where: { id } });
  return result.count > 0;
}

export async function loadPersonSitePublic() {
  const [profile, entries] = await Promise.all([
    getPersonProfile(),
    listPersonEntries({ publishedOnly: true }),
  ]);
  const byKind = (kind: PersonEntryKind) => entries.filter((item) => item.kind === kind);
  return {
    profile,
    featured: entries.filter((item) => item.featured),
    projects: byKind("PROJECT"),
    blogs: byKind("BLOG"),
    portfolio: byKind("PORTFOLIO"),
    honors: byKind("HONOR"),
    grades: byKind("GRADE"),
    practices: byKind("PRACTICE"),
    activities: byKind("ACTIVITY"),
    interests: byKind("INTEREST"),
    photos: byKind("PHOTO"),
  };
}

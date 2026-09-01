/**
 * 话题专区的库查询：发帖校验、列表按一级展开到二级。
 */

import { prisma } from "@andyyyds/shared/db";
import { forumZoneAcceptsPosts } from "@andyyyds/forum/lib/forum-zone";

export async function findOpenForumZone(universityId: string, zoneId: string) {
  const zone = await prisma.forumZone.findFirst({
    where: { id: zoneId, universityId },
    include: { parent: { select: { enabled: true, key: true } } },
  });
  if (!zone || !forumZoneAcceptsPosts(zone)) return null;
  return zone;
}

export async function forumPostZoneWhere(zoneId: string) {
  const zone = await prisma.forumZone.findUnique({
    where: { id: zoneId },
    select: { id: true, parentId: true },
  });
  if (!zone || zone.parentId) return { zoneId };
  const children = await prisma.forumZone.findMany({
    where: { parentId: zone.id },
    select: { id: true },
  });
  if (children.length === 0) return { zoneId };
  return { zoneId: { in: [zone.id, ...children.map((child) => child.id)] } };
}

/**
 * 话题专区两级树：一级出现在学校页话题栏，二级挂在某个一级下面。
 * 点一级看该级及其二级下的帖；点二级只看这一支。
 */

export type ForumZoneTreeItem = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
  parentId?: string | null;
};

export function sortForumZones<T extends { sortOrder: number; name: string }>(
  zones: T[],
): T[] {
  return [...zones].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "zh-CN"),
  );
}

export function isForumZoneTop<T extends { parentId?: string | null }>(zone: T) {
  return !zone.parentId;
}

export function forumZoneTops<T extends ForumZoneTreeItem>(zones: T[]): T[] {
  return sortForumZones(zones.filter(isForumZoneTop));
}

export function forumZoneChildren<T extends ForumZoneTreeItem>(
  zones: T[],
  parentId: string,
): T[] {
  return sortForumZones(zones.filter((zone) => zone.parentId === parentId));
}

/** 二级话题只有所属一级也开着，才出现在前台和发帖选项里 */
export function isForumZonePublic<T extends ForumZoneTreeItem>(
  zone: T,
  zones: T[],
): boolean {
  if (!zone.enabled) return false;
  if (!zone.parentId) return true;
  const parent = zones.find((item) => item.id === zone.parentId);
  return Boolean(parent?.enabled);
}

export function findPublicForumZone<T extends ForumZoneTreeItem>(
  zones: T[],
  zoneKey: string,
): T | undefined {
  if (!zoneKey) return undefined;
  return zones.find(
    (zone) =>
      isForumZonePublic(zone, zones) &&
      (zone.key === zoneKey || zone.id === zoneKey),
  );
}

export function forumZoneTopOf<T extends ForumZoneTreeItem>(
  zones: T[],
  zone: T | undefined,
): T | undefined {
  if (!zone) return undefined;
  if (!zone.parentId) return zone;
  return zones.find((item) => item.id === zone.parentId);
}

/** 点一级话题时，帖子范围包含该一级和它下面所有二级 */
export function forumZonePostIdFilter<T extends ForumZoneTreeItem>(
  zones: T[],
  active: T,
): { zoneId: string } | { zoneId: { in: string[] } } {
  if (active.parentId) return { zoneId: active.id };
  const childIds = forumZoneChildren(zones, active.id).map((zone) => zone.id);
  if (childIds.length === 0) return { zoneId: active.id };
  return { zoneId: { in: [active.id, ...childIds] } };
}

export function forumZoneAcceptsPosts(zone: {
  enabled: boolean;
  parent?: { enabled: boolean } | null;
}): boolean {
  return zone.enabled && (!zone.parent || zone.parent.enabled);
}

export function forumZoneDisplayName(zone: {
  name: string;
  parent?: { name: string } | null;
}): string {
  return zone.parent?.name ? `${zone.parent.name} · ${zone.name}` : zone.name;
}

export const FORUM_ZONE_NAME_SELECT = {
  name: true,
  parent: { select: { name: true } },
} as const;

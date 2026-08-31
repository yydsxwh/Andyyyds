/**
 * 站长把同一篇帖同步发到多所高校。
 * 各校是独立帖（赞评互不影响）；专区优先对同 key，没有则落到该校第一个开着的专区。
 * 仅站长可指定额外学校；草稿不同步，正式发布时才复制。
 */

import { prisma } from "@andyyyds/shared/db";

export const FORUM_BROADCAST_MAX = 200;

export type ForumBroadcastCampus = {
  universityId: string;
  universityName: string;
  zoneId: string;
};

export type ForumBroadcastSkip = {
  universityId: string;
  name: string;
  reason: string;
};

export function uniqueForumUniversityIds(
  raw: string[] | undefined,
  excludeId: string,
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of raw || []) {
    const id = String(item || "").trim();
    if (!id || id === excludeId || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export async function resolveForumBroadcastTargets(args: {
  extraUniversityIds: string[];
  sourceZoneKey: string;
}): Promise<{
  targets: ForumBroadcastCampus[];
  skipped: ForumBroadcastSkip[];
}> {
  const requested = uniqueForumUniversityIds(args.extraUniversityIds, "");
  if (requested.length === 0) return { targets: [], skipped: [] };

  const rows = await prisma.forumUniversity.findMany({
    where: { id: { in: requested } },
    select: {
      id: true,
      name: true,
      enabled: true,
      zones: {
        where: { enabled: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, key: true },
      },
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const targets: ForumBroadcastCampus[] = [];
  const skipped: ForumBroadcastSkip[] = [];

  for (const id of requested) {
    const uni = byId.get(id);
    if (!uni || !uni.enabled) {
      skipped.push({
        universityId: id,
        name: uni?.name || id,
        reason: "分区不存在或已关闭",
      });
      continue;
    }
    const zone =
      uni.zones.find((item) => item.key === args.sourceZoneKey) || uni.zones[0];
    if (!zone) {
      skipped.push({
        universityId: id,
        name: uni.name,
        reason: "没有可用专区",
      });
      continue;
    }
    targets.push({
      universityId: uni.id,
      universityName: uni.name,
      zoneId: zone.id,
    });
  }

  return { targets, skipped };
}

export function forumBroadcastPostData(
  campus: ForumBroadcastCampus,
  content: {
    authorId: string;
    title: string;
    body: string;
    place: string;
    latitude: number | null;
    longitude: number | null;
    mediaJson: string;
    audience: string;
  },
) {
  return {
    universityId: campus.universityId,
    zoneId: campus.zoneId,
    authorId: content.authorId,
    kind: "POST" as const,
    title: content.title,
    body: content.body,
    place: content.place,
    latitude: content.latitude,
    longitude: content.longitude,
    mediaJson: content.mediaJson,
    status: "PUBLISHED" as const,
    audience: content.audience,
  };
}

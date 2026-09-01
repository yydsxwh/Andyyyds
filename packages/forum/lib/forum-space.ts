/**
 * 论坛一级分区：大学论坛、兴趣圈子、本地同城、单位机构。
 * 大学只是其中一类；圈子/同城/单位登录即可发帖，不走高校实名。
 */

import { prisma } from "@andyyyds/shared/db";
import { isAdmin, type RoleInput } from "@andyyyds/shared/roles";
import { DEFAULT_FORUM_ZONES, canPostInUniversity } from "@andyyyds/forum/lib/forum";

export const FORUM_SPACE_KINDS = ["UNIVERSITY", "CIRCLE", "CITY", "ORG"] as const;
export type ForumSpaceKind = (typeof FORUM_SPACE_KINDS)[number];

export const FORUM_SPACE_KIND_LABEL: Record<ForumSpaceKind, string> = {
  UNIVERSITY: "大学论坛",
  CIRCLE: "兴趣圈子",
  CITY: "本地同城",
  ORG: "单位机构",
};

export const FORUM_SPACE_KIND_HINT: Record<ForumSpaceKind, string> = {
  UNIVERSITY: "按学校分区，实名认证后发帖",
  CIRCLE: "按兴趣主题聚人，登录即可交流",
  CITY: "按城市找附近的人，登录即可发帖",
  ORG: "按单位或机构聚人，登录即可交流",
};

export const FORUM_SPACE_LIST_PATH: Record<ForumSpaceKind, string> = {
  UNIVERSITY: "/forum/campus",
  CIRCLE: "/forum/circles",
  CITY: "/forum/cities",
  ORG: "/forum/orgs",
};

export const FORUM_SPACE_HUB_HEADLINE: Record<ForumSpaceKind, string> = {
  UNIVERSITY: "按学校找同学",
  CIRCLE: "按兴趣找同好",
  CITY: "按城市找附近",
  ORG: "按单位找同事",
};

export const FORUM_SPACE_LIST_BACK: Record<ForumSpaceKind, string> = {
  UNIVERSITY: "全部高校",
  CIRCLE: "全部圈子",
  CITY: "全部同城",
  ORG: "全部机构",
};

export const FORUM_SPACE_FALLBACK_SLOGAN: Record<ForumSpaceKind, string> = {
  UNIVERSITY: "本校同学的交流专区",
  CIRCLE: "兴趣同好的交流圈子",
  CITY: "同城邻居的交流专区",
  ORG: "单位同事的交流专区",
};

export const DEFAULT_CIRCLE_ZONES: { key: string; name: string }[] = [
  { key: "discuss", name: "讨论交流" },
  { key: "share", name: "资源分享" },
  { key: "event", name: "活动约局" },
  { key: "qa", name: "问答互助" },
];

export const DEFAULT_CITY_ZONES: { key: string; name: string }[] = [
  { key: "hangout", name: "同城活动" },
  { key: "food", name: "吃喝玩乐" },
  { key: "housing", name: "租房搬家" },
  { key: "secondhand", name: "二手闲置" },
  { key: "job", name: "求职招聘" },
  { key: "help", name: "生活互助" },
];

export const DEFAULT_ORG_ZONES: { key: string; name: string }[] = [
  { key: "discuss", name: "讨论交流" },
  { key: "notice", name: "通知公告" },
  { key: "job", name: "招聘内推" },
  { key: "event", name: "活动组织" },
  { key: "qa", name: "问答互助" },
];

const STARTER_CIRCLES: { name: string; slug: string; slogan: string }[] = [
  { name: "摄影圈", slug: "photo", slogan: "拍片、后期、约拍交流" },
  { name: "考研互助", slug: "kaoyan", slogan: "资料、经验、答疑" },
  { name: "数码科技", slug: "tech", slogan: "数码、编程、AI 闲聊" },
];

const STARTER_CITIES: { name: string; slug: string; slogan: string }[] = [
  { name: "北京同城", slug: "beijing", slogan: "京圈吃喝玩乐与互助" },
  { name: "上海同城", slug: "shanghai", slogan: "沪上同城活动与生活" },
  { name: "杭州同城", slug: "hangzhou", slogan: "杭州本地吃喝与活动" },
];

const STARTER_ORGS: { name: string; slug: string; slogan: string }[] = [
  { name: "公司交流", slug: "corp", slogan: "职场同事交流、内推与活动" },
  { name: "行业协会", slug: "industry", slogan: "行业动态、标准与合作" },
  { name: "机关单位", slug: "gov", slogan: "机关与事业单位同事交流" },
];

const STARTERS: Record<
  Exclude<ForumSpaceKind, "UNIVERSITY">,
  { name: string; slug: string; slogan: string }[]
> = {
  CIRCLE: STARTER_CIRCLES,
  CITY: STARTER_CITIES,
  ORG: STARTER_ORGS,
};

export type ForumSpaceStudioCopy = {
  nameLabel: string;
  namePlaceholder: string;
  sloganPlaceholder: string;
  slugPlaceholder: string;
  searchPlaceholder: string;
  showRegion: boolean;
  regionChina: string;
  regionIntl: string;
};

export function forumSpaceStudioCopy(kind: ForumSpaceKind): ForumSpaceStudioCopy {
  switch (kind) {
    case "CIRCLE":
      return {
        nameLabel: "圈子名称",
        namePlaceholder: "如 摄影圈",
        sloganPlaceholder: "拍片、后期、约拍…",
        slugPlaceholder: "photo",
        searchPlaceholder: "搜圈子名或路径",
        showRegion: false,
        regionChina: "",
        regionIntl: "",
      };
    case "CITY":
      return {
        nameLabel: "城市名称",
        namePlaceholder: "如 杭州同城",
        sloganPlaceholder: "吃喝玩乐、租房互助…",
        slugPlaceholder: "hangzhou",
        searchPlaceholder: "搜城市名或路径",
        showRegion: true,
        regionChina: "国内城市",
        regionIntl: "海外城市",
      };
    case "ORG":
      return {
        nameLabel: "单位名称",
        namePlaceholder: "如 某某研究院",
        sloganPlaceholder: "同事交流、招聘、活动…",
        slugPlaceholder: "institute",
        searchPlaceholder: "搜单位名或路径",
        showRegion: true,
        regionChina: "国内机构",
        regionIntl: "海外机构",
      };
    default:
      return {
        nameLabel: "学校名称",
        namePlaceholder: "如 北京大学",
        sloganPlaceholder: "同学交流、选课、二手、跑腿…",
        slugPlaceholder: "pku",
        searchPlaceholder: "搜学校名或路径",
        showRegion: true,
        regionChina: "中国高校",
        regionIntl: "国际高校",
      };
  }
}

export function isForumSpaceKind(value: string): value is ForumSpaceKind {
  return (FORUM_SPACE_KINDS as readonly string[]).includes(value);
}

export function parseForumSpaceKind(
  raw: string | null | undefined,
): ForumSpaceKind {
  const value = String(raw || "").trim();
  return isForumSpaceKind(value) ? value : "UNIVERSITY";
}

export function isCampusForumSpace(kind: string | null | undefined): boolean {
  return parseForumSpaceKind(kind) === "UNIVERSITY";
}

export function defaultZonesForForumKind(
  kind: ForumSpaceKind,
): { key: string; name: string }[] {
  if (kind === "CIRCLE") return DEFAULT_CIRCLE_ZONES;
  if (kind === "CITY") return DEFAULT_CITY_ZONES;
  if (kind === "ORG") return DEFAULT_ORG_ZONES;
  return DEFAULT_FORUM_ZONES;
}

export function forumSpaceListPath(kind: string | null | undefined): string {
  return FORUM_SPACE_LIST_PATH[parseForumSpaceKind(kind)];
}

export function studioForumSpaceEditPath(id: string): string {
  return `/studio/forum/${id}/edit`;
}

export function forumSpaceEmptyHint(kind: ForumSpaceKind): string {
  if (kind === "CIRCLE") return "这个圈子还没有帖子，登录后发第一篇吧。";
  if (kind === "CITY") return "这座城市还没有帖子，登录后发第一篇吧。";
  if (kind === "ORG") return "这个机构还没有帖子，登录后发第一篇吧。";
  return "这一栏还没有内容，认证本校后发第一篇吧。";
}

/**
 * 大学：该校认证或旧版加入。
 * 圈子/同城/单位：登录即可，不占用高校认证名额。
 */
export function canPostInForumSpace(
  session:
    | ({
        id?: string;
        forumUniversityId?: string | null;
        forumVerifiedUniversityIds?: string[] | null;
      } & RoleInput)
    | null
    | undefined,
  space: { id: string; kind?: string | null; enabled?: boolean },
): boolean {
  if (!session) return false;
  if (space.enabled === false) return false;
  if (isCampusForumSpace(space.kind)) {
    return canPostInUniversity(session, space.id);
  }
  if (isAdmin(session)) return true;
  return Boolean(session.id);
}

export async function ensureStarterForumSpaces(
  kind: Exclude<ForumSpaceKind, "UNIVERSITY">,
) {
  const count = await prisma.forumUniversity.count({ where: { kind } });
  if (count > 0) return;
  const starters = STARTERS[kind];
  const zones = defaultZonesForForumKind(kind);
  for (const [index, item] of starters.entries()) {
    const clash = await prisma.forumUniversity.findUnique({
      where: { slug: item.slug },
      select: { id: true },
    });
    if (clash) continue;
    await prisma.forumUniversity.create({
      data: {
        name: item.name,
        slug: item.slug,
        slogan: item.slogan,
        kind,
        region: "CHINA",
        enabled: true,
        sortOrder: index * 10,
        zones: {
          create: zones.map((zone, zoneIndex) => ({
            key: zone.key,
            name: zone.name,
            sortOrder: zoneIndex * 10,
          })),
        },
      },
    });
  }
}

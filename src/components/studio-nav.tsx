import Link from "next/link";
import { getSession } from "@andyyyds/shared/auth";
import { getStudioNavConfig } from "@andyyyds/shared/site-settings";
import {
  STUDIO_CREATOR_ADMIN_ONLY_KEYS,
} from "@andyyyds/shared/studio-nav-config";
import {
  AGENT_STUDIO_NAV_KEYS,
  canAccessStudio,
  canManageMarketing,
  hasRole,
  isAdmin,
} from "@andyyyds/shared/roles";

const CREATOR_ADMIN_ONLY = new Set<string>(STUDIO_CREATOR_ADMIN_ONLY_KEYS);

export async function StudioNav({
  current,
  /** creator=创作者中心；admin=站长管理（互不混排 Tab） */
  area = "creator",
}: {
  current:
    | "overview"
    | "media"
    | "courses"
    | "compose"
    | "distribution"
    | "marketing"
    | "orders"
    | "admin"
    | "users"
    | "merchants"
    | "products"
    | "shop"
    | "meetup"
    | "forum"
    | "decorate"
    /** @deprecated 页面模板已归入装修子导航；传入时高亮「装修」 */
    | "templates"
    | "cms"
    | "wechat-mp"
    | "person-social"
    | "bg-music"
    | "settings";
  area?: "creator" | "admin";
}) {
  const [session, nav] = await Promise.all([getSession(), getStudioNavConfig()]);
  // 用完整会话做权限：一人多角色时按「任一身份」判定
  const roles = session || "STUDENT";

  let links =
    area === "admin"
      ? isAdmin(roles)
        ? [...nav.topAdmin]
        : []
      : [...nav.topBase];

  if (area === "creator") {
    // 加盟代理导航收窄；若同时是站长则走站长全量导航
    if (hasRole(roles, "AGENT") && !isAdmin(roles)) {
      const allowed = new Set<string>(AGENT_STUDIO_NAV_KEYS);
      links = nav.topBase.filter((item) => allowed.has(item.key));
    } else if (!canAccessStudio(roles)) {
      links = [];
    } else if (!isAdmin(roles)) {
      // 非站长：创作者导航不含「订单查看」等站长侧入口
      links = links.filter((item) => !CREATOR_ADMIN_ONLY.has(item.key));
    }

    // 老师不可售：隐藏营销入口（菜单在 topBase，需按角色再滤一次）
    if (!canManageMarketing(roles)) {
      links = links.filter((item) => item.key !== "marketing");
    }
  }

  // compose → 课程中心；templates → 装修（页面模板已不再单独占顶栏）
  const activeKey =
    current === "compose"
      ? "courses"
      : current === "templates"
        ? "decorate"
        : current;

  return (
    // 窄屏横向滑动，避免站长 Tab 换行占满首屏；微信内同样可滑可点
    <nav
      className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label={area === "admin" ? "站长管理导航" : "创作者中心导航"}
    >
      {links.map((link) => {
        const active = activeKey === link.key;
        return (
          <Link
            key={link.key}
            href={link.href}
            className={`chip shrink-0 touch-manipulation whitespace-nowrap text-base ${
              active ? "chip-active" : "chip-idle"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

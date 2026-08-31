/**
 * 五角色权限矩阵（与现有功能对齐的默认约定）
 *
 * ADMIN  站长     — 全站后台：用户/角色、商家审核、CMS、装修、系统设置、分成比例、全部课程/订单/素材；可新建课程/专栏/商品出售
 * AGENT  加盟代理 — 推广+开店：概览/分销/素材/课程；可新建课程/专栏/商品并出售（归属本人 teacherId）；发展商家可拿平台抽成再分（Merchant.agentId）；邀请成交按代理比例；无系统设置
 * MERCHANT 入驻商家 — 开店卖课：可新建课程/专栏/商品并出售；课程/素材（可删自己的）；订单受平台抽成；无系统设置
 * TEACHER 老师    — 老师不是商家：不可新建课程/专栏/商品出售；仅维护已分配/名下课程的素材上传与编辑；可分销；不可删除素材/课程；无系统设置
 * STUDENT 用户    — 仅消费学习 + 分销推荐拿提成；无任何工作室管理
 *
 * 同一用户可同时拥有多种角色（User.roles）；权限按「任一角色满足」判定。
 * role 字段保存主角色（优先级最高），便于展示与分成比例取值。
 * 分成叠加上不封顶：商家平台抽成再分、推荐人分成、三级分销等可同时结算，无合计封顶。
 * 枚举值保持英文；中文仅展示。商家审核通过：DIRECT→MERCHANT，FRANCHISE→AGENT。
 */

export const ROLES = [
  "ADMIN",
  "AGENT",
  "MERCHANT",
  "TEACHER",
  "STUDENT",
] as const;

export type Role = (typeof ROLES)[number];

/** 主角色优先级：站长 > 代理 > 商家 > 老师 > 用户 */
export const ROLE_PRIORITY: Record<Role, number> = {
  ADMIN: 100,
  AGENT: 80,
  MERCHANT: 60,
  TEACHER: 40,
  STUDENT: 10,
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "站长",
  AGENT: "加盟代理",
  MERCHANT: "入驻商家",
  TEACHER: "老师",
  STUDENT: "用户",
};

/** 权限函数入参：单角色、角色数组、逗号串，或带 role/roles 的会话对象 */
export type RoleInput =
  | Role
  | string
  | Role[]
  | readonly string[]
  | { role?: string; roles?: string | string[] | null };

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function roleLabel(role: string): string {
  return isRole(role) ? ROLE_LABEL[role] : role;
}

/** 解析 DB / API 中的多角色为去重有序列表；空则回退到 role */
export function normalizeRoles(input: RoleInput | null | undefined): Role[] {
  if (input == null || input === "") return ["STUDENT"];

  if (Array.isArray(input)) {
    const list = input.filter(
      (r): r is Role => typeof r === "string" && isRole(r),
    );
    return list.length > 0 ? dedupeRoles(list) : ["STUDENT"];
  }

  if (typeof input === "object" && input !== null) {
    const obj = input as { role?: string; roles?: string | string[] | null };
    const fromRoles = obj.roles;
    if (Array.isArray(fromRoles) && fromRoles.length > 0) {
      return normalizeRoles(fromRoles);
    }
    if (typeof fromRoles === "string" && fromRoles.trim()) {
      return normalizeRoles(fromRoles);
    }
    if (typeof obj.role === "string" && obj.role.trim()) {
      return normalizeRoles(obj.role);
    }
    return ["STUDENT"];
  }

  const raw = String(input).trim();
  if (!raw) return ["STUDENT"];
  if (isRole(raw)) return [raw];

  const parts = raw
    .split(/[,|，\s]+/)
    .map((p) => p.trim().toUpperCase())
    .filter(isRole);
  return parts.length > 0 ? dedupeRoles(parts) : ["STUDENT"];
}

function dedupeRoles(list: Role[]): Role[] {
  const seen = new Set<Role>();
  const out: Role[] = [];
  for (const role of list) {
    if (seen.has(role)) continue;
    seen.add(role);
    out.push(role);
  }
  // 有特权身份时不再保留纯 STUDENT（避免展示「用户、老师」冗余）
  if (out.length > 1 && out.includes("STUDENT")) {
    return out.filter((r) => r !== "STUDENT");
  }
  return out;
}

/** 写入 DB 的逗号串 */
export function serializeRoles(roles: RoleInput): string {
  return normalizeRoles(roles).join(",");
}

/** 权限优先级最高的主角色 */
export function primaryRole(roles: RoleInput): Role {
  const list = normalizeRoles(roles);
  return list.reduce((best, cur) =>
    ROLE_PRIORITY[cur] > ROLE_PRIORITY[best] ? cur : best,
  );
}

export function hasRole(roles: RoleInput, target: Role): boolean {
  return normalizeRoles(roles).includes(target);
}

export function roleLabels(roles: RoleInput): string {
  return normalizeRoles(roles)
    .map((r) => ROLE_LABEL[r])
    .join("、");
}

/** 站长改角色时写入 role + roles 的一对字段 */
export function roleFieldsFromList(roles: RoleInput): {
  role: Role;
  roles: string;
} {
  const list = normalizeRoles(roles);
  return {
    role: primaryRole(list),
    roles: serializeRoles(list),
  };
}

export function isAdmin(roleOrRoles: RoleInput): boolean {
  return hasRole(roleOrRoles, "ADMIN");
}

/** 可进入 /studio（含加盟代理的分销后台） */
export function canAccessStudio(roleOrRoles: RoleInput): boolean {
  const roles = normalizeRoles(roleOrRoles);
  return (
    roles.includes("ADMIN") ||
    roles.includes("TEACHER") ||
    roles.includes("MERCHANT") ||
    roles.includes("AGENT")
  );
}

/**
 * 课程编辑与素材上传（站长 / 加盟代理 / 入驻商家 / 老师）。
 * 老师仅维护已分配或 teacherId 名下课程，不可新建可售产品。
 */
export function canManageCourses(roleOrRoles: RoleInput): boolean {
  const roles = normalizeRoles(roleOrRoles);
  return (
    roles.includes("ADMIN") ||
    roles.includes("AGENT") ||
    roles.includes("TEACHER") ||
    roles.includes("MERCHANT")
  );
}

/** 查看名下课程学员的学习进度 / 时长（站长看全站） */
export function canViewLearnerProgress(roleOrRoles: RoleInput): boolean {
  return canManageCourses(roleOrRoles);
}

export function canManageMedia(roleOrRoles: RoleInput): boolean {
  return canManageCourses(roleOrRoles);
}

/**
 * 新建可售课程 / 专栏 / 商品。
 * 站长、入驻商家、加盟代理可以；老师不是商家，不可创建出售。
 */
export function canCreateSellableProducts(roleOrRoles: RoleInput): boolean {
  const roles = normalizeRoles(roleOrRoles);
  return (
    roles.includes("ADMIN") ||
    roles.includes("MERCHANT") ||
    roles.includes("AGENT")
  );
}

/**
 * 删除素材 / 课程（破坏性）
 * 老师不可删；站长、入驻商家、加盟代理可删自己范围内的。
 */
export function canDeleteMedia(roleOrRoles: RoleInput): boolean {
  const roles = normalizeRoles(roleOrRoles);
  return (
    roles.includes("ADMIN") ||
    roles.includes("MERCHANT") ||
    roles.includes("AGENT")
  );
}

export function canDeleteCourses(roleOrRoles: RoleInput): boolean {
  return canDeleteMedia(roleOrRoles);
}

/** 站长可看全站课程/订单；其他人仅自己的 */
export function canViewAllStudioData(roleOrRoles: RoleInput): boolean {
  return isAdmin(roleOrRoles);
}

export function canManageUsers(roleOrRoles: RoleInput): boolean {
  return isAdmin(roleOrRoles);
}

export function canManageMerchants(roleOrRoles: RoleInput): boolean {
  return isAdmin(roleOrRoles);
}

/**
 * 站长后台管理全站约搭（/studio/meetup 增删改）。
 * 注意：前台「发起约搭」是任意登录用户（POST /api/meetup），不走本函数；
 * 发起人改自己的局走 /api/meetup/[id]，仅站长额外可改删他人的。
 */
export function canManageMeetups(roleOrRoles: RoleInput): boolean {
  return isAdmin(roleOrRoles);
}

/** 站长后台管理大学论坛高校分区（/studio/forum） */
export function canManageForum(roleOrRoles: RoleInput): boolean {
  return isAdmin(roleOrRoles);
}

export function canManageSiteSettings(roleOrRoles: RoleInput): boolean {
  return isAdmin(roleOrRoles);
}

export function canManageCms(roleOrRoles: RoleInput): boolean {
  return isAdmin(roleOrRoles);
}

export function canManageDecorate(roleOrRoles: RoleInput): boolean {
  return isAdmin(roleOrRoles);
}

/** 查看分销/邀请（工作室角色 + 普通用户用前台「我的学习」展示邀请码） */
export function canViewDistribution(roleOrRoles: RoleInput): boolean {
  return canAccessStudio(roleOrRoles);
}

/** 任意角色均可邀请；含站长（便于自测与自有邀请码推广） */
export function canReferForCommission(roleOrRoles: RoleInput): boolean {
  return normalizeRoles(roleOrRoles).length > 0;
}

/** 修改全局一二三级分销比例 / 平台抽成等 */
export function canManageDistributionSettings(roleOrRoles: RoleInput): boolean {
  return isAdmin(roleOrRoles);
}

/**
 * 营销中心（优惠券等）：可售角色可管。
 * 老师不可售，暂不开放；商家/代理后续可只管自己发的券。
 */
export function canManageMarketing(roleOrRoles: RoleInput): boolean {
  const roles = normalizeRoles(roleOrRoles);
  return (
    roles.includes("ADMIN") ||
    roles.includes("MERCHANT") ||
    roles.includes("AGENT")
  );
}

/** 与 canManageMarketing 同权限；预留独立扩展 */
export function canManageCoupons(roleOrRoles: RoleInput): boolean {
  return canManageMarketing(roleOrRoles);
}

/** Studio 顶部导航：加盟代理 = 概览 + 素材 + 课程 + 分销 + 营销（可开店卖课） */
export const AGENT_STUDIO_NAV_KEYS = [
  "overview",
  "media",
  "courses",
  "distribution",
  "marketing",
] as const;

/** 注册可选角色（不可自选站长）。申请状态流转见 src/lib/role-applications.ts */
export const APPLYABLE_ROLES = [
  "STUDENT",
  "AGENT",
  "MERCHANT",
  "TEACHER",
] as const;

export type ApplyableRole = (typeof APPLYABLE_ROLES)[number];

export const ROLE_HINT: Record<ApplyableRole, string> = {
  STUDENT: "用户学习消费",
  AGENT: "代理宣传分润",
  MERCHANT: "商家开课开店",
  TEACHER: "老师上传资料与分销",
};

/** 需站长审核的注册角色 */
export const ELEVATED_APPLY_ROLES = ["AGENT", "MERCHANT", "TEACHER"] as const;

export type ElevatedApplyRole = (typeof ELEVATED_APPLY_ROLES)[number];

export const ROLE_APPLICATION_STATUSES = [
  "NONE",
  "PENDING",
  "ACTIVE",
  "REJECTED",
] as const;

export type RoleApplicationStatus = (typeof ROLE_APPLICATION_STATUSES)[number];

export const ROLE_APPLICATION_STATUS_LABEL: Record<
  RoleApplicationStatus,
  string
> = {
  NONE: "无申请",
  PENDING: "待审核",
  ACTIVE: "已通过",
  REJECTED: "已拒绝",
};

export function isApplyableRole(value: string): value is ApplyableRole {
  return (APPLYABLE_ROLES as readonly string[]).includes(value);
}

export function isElevatedApplyRole(value: string): value is ElevatedApplyRole {
  return (ELEVATED_APPLY_ROLES as readonly string[]).includes(value);
}

export function isRoleApplicationStatus(
  value: string,
): value is RoleApplicationStatus {
  return (ROLE_APPLICATION_STATUSES as readonly string[]).includes(value);
}

export function isRoleApplicationPending(status: string): boolean {
  return status === "PENDING";
}

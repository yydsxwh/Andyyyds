/**
 * 五角色权限矩阵（与现有功能对齐的默认约定）
 *
 * ADMIN  站长     — 全站后台：用户/角色、商家审核、CMS、装修、系统设置、分成比例、全部课程/订单/素材；可新建课程/专栏/商品出售
 * AGENT  加盟代理 — 推广+开店：概览/分销/素材/课程；可新建课程/专栏/商品并出售（归属本人 teacherId）；发展商家可拿平台抽成再分（Merchant.agentId）；邀请成交按代理比例；无系统设置
 * MERCHANT 入驻商家 — 开店卖课：可新建课程/专栏/商品并出售；课程/素材（可删自己的）；订单受平台抽成；无系统设置
 * TEACHER 老师    — 老师不是商家：不可新建课程/专栏/商品出售；仅维护已分配/名下课程的素材上传与编辑；可分销；不可删除素材/课程；无系统设置
 * STUDENT 用户    — 仅消费学习 + 分销推荐拿提成；无任何工作室管理
 *
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

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "站长",
  AGENT: "加盟代理",
  MERCHANT: "入驻商家",
  TEACHER: "老师",
  STUDENT: "用户",
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function roleLabel(role: string): string {
  return isRole(role) ? ROLE_LABEL[role] : role;
}

export function isAdmin(role: string): boolean {
  return role === "ADMIN";
}

/** 可进入 /studio（含加盟代理的分销后台） */
export function canAccessStudio(role: string): boolean {
  return (
    role === "ADMIN" ||
    role === "TEACHER" ||
    role === "MERCHANT" ||
    role === "AGENT"
  );
}

/**
 * 课程编辑与素材上传（站长 / 加盟代理 / 入驻商家 / 老师）。
 * 老师仅维护已分配或 teacherId 名下课程，不可新建可售产品。
 */
export function canManageCourses(role: string): boolean {
  return (
    role === "ADMIN" ||
    role === "AGENT" ||
    role === "TEACHER" ||
    role === "MERCHANT"
  );
}

/** 查看名下课程学员的学习进度 / 时长（站长看全站） */
export function canViewLearnerProgress(role: string): boolean {
  return canManageCourses(role);
}

export function canManageMedia(role: string): boolean {
  return canManageCourses(role);
}

/**
 * 新建可售课程 / 专栏 / 商品。
 * 站长、入驻商家、加盟代理可以；老师不是商家，不可创建出售。
 */
export function canCreateSellableProducts(role: string): boolean {
  return role === "ADMIN" || role === "MERCHANT" || role === "AGENT";
}

/**
 * 删除素材 / 课程（破坏性）
 * 老师不可删；站长、入驻商家、加盟代理可删自己范围内的。
 */
export function canDeleteMedia(role: string): boolean {
  return role === "ADMIN" || role === "MERCHANT" || role === "AGENT";
}

export function canDeleteCourses(role: string): boolean {
  return role === "ADMIN" || role === "MERCHANT" || role === "AGENT";
}

/** 站长可看全站课程/订单；其他人仅自己的 */
export function canViewAllStudioData(role: string): boolean {
  return role === "ADMIN";
}

export function canManageUsers(role: string): boolean {
  return role === "ADMIN";
}

export function canManageMerchants(role: string): boolean {
  return role === "ADMIN";
}

export function canManageSiteSettings(role: string): boolean {
  return role === "ADMIN";
}

export function canManageCms(role: string): boolean {
  return role === "ADMIN";
}

export function canManageDecorate(role: string): boolean {
  return role === "ADMIN";
}

/** 查看分销/邀请（工作室角色 + 普通用户用前台「我的学习」展示邀请码） */
export function canViewDistribution(role: string): boolean {
  return canAccessStudio(role);
}

/** 任何登录用户都可做推荐分销（提成按角色比例） */
/** 任意角色均可邀请；含站长（便于自测与自有邀请码推广） */
export function canReferForCommission(role: string): boolean {
  return isRole(role);
}

/** 修改全局一二三级分销比例 / 平台抽成等 */
export function canManageDistributionSettings(role: string): boolean {
  return role === "ADMIN";
}

/**
 * 营销中心（优惠券等）：可售角色可管。
 * 老师不可售，暂不开放；商家/代理后续可只管自己发的券。
 */
export function canManageMarketing(role: string): boolean {
  return role === "ADMIN" || role === "MERCHANT" || role === "AGENT";
}

/** 与 canManageMarketing 同权限；预留独立扩展 */
export function canManageCoupons(role: string): boolean {
  return canManageMarketing(role);
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

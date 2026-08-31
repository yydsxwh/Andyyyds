/**
 * 角色申请业务规则（注册选角色 + 个人中心升级申请 + 站长审核）
 *
 * 规则摘要：
 * - STUDENT：注册即生效，role=STUDENT，无待审
 * - AGENT / MERCHANT / TEACHER（注册）：账号先建为 STUDENT + PENDING；
 *   通过前不可用后台特权；登录可成功，提示「账号待站长审核」
 * - 个人中心升级：保留当前 roles，仅写 requestedRole + PENDING；不可申请 ADMIN；
 *   不可申请已有角色；已有 PENDING 时不可再提
 * - 通过：把 requestedRole 并入 roles（多角色叠加），status=ACTIVE
 * - 拒绝：不改当前 roles（注册路径本就是 STUDENT；升级路径保留原身份），status=REJECTED
 * - 站长直接改角色：可一次勾选多种身份，同步清掉待审状态
 *
 * 权限矩阵仍以 packages/shared/src/roles.ts 为准；本模块只处理「申请字段怎么写」。
 */

import {
  ELEVATED_APPLY_ROLES,
  isElevatedApplyRole,
  normalizeRoles,
  ROLE_LABEL,
  roleFieldsFromList,
  type ApplyableRole,
  type ElevatedApplyRole,
  type Role,
  type RoleInput,
} from "./roles";

/**
 * 个人中心可申请的目标角色。
 * 多角色时：凡尚未拥有的高权限角色均可申请；站长不可再申请。
 */
const ACCOUNT_APPLY_TARGETS: ElevatedApplyRole[] = [
  "TEACHER",
  "MERCHANT",
  "AGENT",
];

/** 个人中心申请按钮文案 */
export const ACCOUNT_APPLY_LABEL: Record<ElevatedApplyRole, string> = {
  AGENT: "申请成为加盟代理",
  MERCHANT: "商家入驻",
  TEACHER: "成为老师",
};

/** 注册写入 User 的角色相关字段 */
export function fieldsForSignup(requestedRole: ApplyableRole) {
  if (isElevatedApplyRole(requestedRole)) {
    return {
      role: "STUDENT" as const,
      roles: "STUDENT",
      requestedRole,
      roleApplicationStatus: "PENDING" as const,
      roleApplicationNote: "",
    };
  }
  return {
    role: "STUDENT" as const,
    roles: "STUDENT",
    requestedRole: "",
    roleApplicationStatus: "NONE" as const,
    roleApplicationNote: "",
  };
}

/**
 * 已登录用户在个人中心提交角色申请。
 * 不改当前 role/roles，避免升级待审期间丢掉老师/商家等既有权限。
 */
export function fieldsForApplyFromAccount(requestedRole: ElevatedApplyRole) {
  return {
    requestedRole,
    roleApplicationStatus: "PENDING" as const,
    roleApplicationNote: "",
    roleReviewedAt: null,
    roleReviewedById: null,
  };
}

/** 站长「通过」申请：把申请角色叠到现有多角色上 */
export function fieldsForApprove(
  requestedRole: ElevatedApplyRole,
  reviewerId: string,
  note = "",
  currentRoles?: RoleInput,
) {
  const merged = [...normalizeRoles(currentRoles || "STUDENT")];
  if (!merged.includes(requestedRole)) merged.push(requestedRole);
  const pair = roleFieldsFromList(merged);
  return {
    ...pair,
    roleApplicationStatus: "ACTIVE" as const,
    roleApplicationNote: note.trim(),
    roleReviewedAt: new Date(),
    roleReviewedById: reviewerId,
  };
}

/**
 * 站长「拒绝」：不改 role/roles。
 * 注册待审时 role 本就是 STUDENT；个人中心升级被拒则保留原身份继续用。
 */
export function fieldsForReject(reviewerId: string, note?: string) {
  return {
    roleApplicationStatus: "REJECTED" as const,
    roleApplicationNote: note?.trim() || "未通过审核",
    roleReviewedAt: new Date(),
    roleReviewedById: reviewerId,
  };
}

/**
 * 站长在用户列表直接改角色（可多选）时，顺带收口申请状态，避免残留「待审核」。
 */
export function fieldsAfterManualRoleChange(
  rolesInput: RoleInput,
  reviewerId: string,
) {
  const pair = roleFieldsFromList(rolesInput);
  const list = normalizeRoles(pair.roles);
  const elevated = list.find((r) => r !== "STUDENT" && r !== "ADMIN");
  return {
    ...pair,
    requestedRole: elevated || "",
    roleApplicationStatus:
      pair.role === "STUDENT" ? ("NONE" as const) : ("ACTIVE" as const),
    roleApplicationNote: "",
    roleReviewedAt: new Date(),
    roleReviewedById: reviewerId,
  };
}

/**
 * 当前用户在个人中心还能申请哪些角色。
 * PENDING 中不可再提；已有角色与站长均不可申请。
 */
export function availableAccountApplyRoles(
  currentRoles: RoleInput,
  applicationStatus: string,
): ElevatedApplyRole[] {
  if (applicationStatus === "PENDING") return [];
  const owned = normalizeRoles(currentRoles);
  if (owned.includes("ADMIN")) return [];
  return ACCOUNT_APPLY_TARGETS.filter((role) => !owned.includes(role));
}

/** 校验个人中心提交的申请是否合法 */
export function validateAccountRoleApply(
  currentRoles: RoleInput,
  applicationStatus: string,
  requestedRole: string,
): { ok: true; role: ElevatedApplyRole } | { ok: false; error: string } {
  if (!isElevatedApplyRole(requestedRole)) {
    return { ok: false, error: "不可申请该角色" };
  }
  const owned = normalizeRoles(currentRoles);
  if (owned.includes("ADMIN")) {
    return { ok: false, error: "站长无需申请其他角色" };
  }
  if (applicationStatus === "PENDING") {
    return { ok: false, error: "已有待审核申请，请等待站长处理" };
  }
  if (owned.includes(requestedRole)) {
    return { ok: false, error: "你已是该角色，无需再申请" };
  }
  const allowed = availableAccountApplyRoles(currentRoles, applicationStatus);
  if (!allowed.includes(requestedRole)) {
    return {
      ok: false,
      error: `当前身份不可申请${ROLE_LABEL[requestedRole]}`,
    };
  }
  return { ok: true, role: requestedRole };
}

export function approveSuccessMessage(role: string): string {
  return `已通过，已加入身份：${ROLE_LABEL[role as Role] || role}`;
}

export const REJECT_SUCCESS_MESSAGE = "已拒绝该角色申请，账号保留原身份";
export const PENDING_REVIEW_MESSAGE = "账号待站长审核";
export const ACCOUNT_APPLY_SUCCESS_MESSAGE =
  "申请已提交，请等待站长审核";

/** 供前端展示：全部可申请高权限角色（不含 ADMIN） */
export const ACCOUNT_APPLYABLE_ROLES = ELEVATED_APPLY_ROLES;

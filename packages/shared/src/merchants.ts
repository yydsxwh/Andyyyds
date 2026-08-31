import type { MerchantJoinType, MerchantStatus, Role } from "./types";
import {
  normalizeRoles,
  roleFieldsFromList,
  type RoleInput,
} from "./roles";

export const MERCHANT_STATUSES = [
  "PENDING",
  "APPROVED",
  "SUSPENDED",
  "REJECTED",
] as const satisfies readonly MerchantStatus[];

export const MERCHANT_JOIN_TYPES = [
  "DIRECT",
  "FRANCHISE",
] as const satisfies readonly MerchantJoinType[];

export const MERCHANT_STATUS_LABEL: Record<MerchantStatus, string> = {
  PENDING: "待审核",
  APPROVED: "已入驻",
  SUSPENDED: "已停用",
  REJECTED: "已拒绝",
};

export const MERCHANT_JOIN_LABEL: Record<MerchantJoinType, string> = {
  DIRECT: "商家入驻",
  FRANCHISE: "加盟合作",
};

/**
 * 根据商家状态 / 入驻类型同步账号角色（不改动站长）。
 * 已入驻：DIRECT → 叠 MERCHANT，FRANCHISE → 叠 AGENT；保留老师等其它身份。
 * 未入驻：去掉商家管道带来的 MERCHANT/AGENT，其它角色保留。
 */
export function roleFieldsForMerchantStatus(
  status: MerchantStatus,
  current: RoleInput,
  joinType: MerchantJoinType = "DIRECT",
): { role: Role; roles: string } {
  const owned = normalizeRoles(current);
  if (owned.includes("ADMIN")) {
    return roleFieldsFromList(owned);
  }

  let next: Role[] = owned.filter((r) => r !== "MERCHANT" && r !== "AGENT");
  if (status === "APPROVED") {
    const pipeRole: Role = joinType === "FRANCHISE" ? "AGENT" : "MERCHANT";
    next.push(pipeRole);
  }
  if (next.length === 0) next = ["STUDENT"];
  return roleFieldsFromList(next);
}

/** @deprecated 请用 roleFieldsForMerchantStatus；保留单角色返回以兼容旧调用 */
export function roleForMerchantStatus(
  status: MerchantStatus,
  currentRole: Role,
  joinType: MerchantJoinType = "DIRECT",
): Role {
  return roleFieldsForMerchantStatus(status, currentRole, joinType).role;
}

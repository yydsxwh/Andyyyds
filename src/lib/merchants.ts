import type { MerchantJoinType, MerchantStatus, Role } from "./types";

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
 * 已入驻：DIRECT → MERCHANT，FRANCHISE → AGENT；否则降为用户。
 */
export function roleForMerchantStatus(
  status: MerchantStatus,
  currentRole: Role,
  joinType: MerchantJoinType = "DIRECT",
): Role {
  if (currentRole === "ADMIN") return "ADMIN";
  if (status === "APPROVED") {
    return joinType === "FRANCHISE" ? "AGENT" : "MERCHANT";
  }
  return "STUDENT";
}

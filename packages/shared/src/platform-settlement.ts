/**
 * 订单分成结算（支付成功后）
 *
 * ## 站长可配比例（系统设置，默认）
 * - merchantPlatformCutPercent = 10     入驻商家课平台抽成
 * - agentShareOfPlatformCutPercent = 30 发展该商家的代理：从平台抽成再分
 * - agentBuyerOrderPercent = 10         推荐人是加盟代理时的成交分成
 * - teacherDistributionPercent = 8      推荐人是老师时的成交分成
 * - userDistributionPercent = 5         推荐人是用户时的成交提成
 *
 * ## 单一推荐人归属（优先）
 * 1. 订单.referralCode → 对应用户
 * 2. 否则买家 User.referredById（注册邀请建立的上级）
 * 只认一位推荐人；按其 role 取上表对应比例发一笔 referrerShare。
 * ADMIN / MERCHANT 作为推荐人：MERCHANT 暂用 user 比例；ADMIN 不计推荐提成。
 *
 * ## 与商家抽成的关系
 * 入驻商家课另算 platformCut / merchantNet；发展该商家的加盟代理以
 * Merchant.agentId（显式归属）为准，再从 platformCut 分 agentMerchantShare
 *（与「买家推荐人」独立）。
 *
 * ## 叠加上不封顶
 * 平台抽成再分、单一推荐人分成、三级分销可同时结算，无合计封顶。
 *
 * ## 三级分销
 * 仍结算 L1–L3；若 L1 已是本单 referrerShare 受益人则跳过 L1，避免重复。
 *
 * Commission.level：91=商家抽成再分，93=单一推荐人成交分成
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { createCommissionsForOrder } from "./distribution";
import { hasRole, isRole, type Role } from "./roles";

type Db = PrismaClient | Prisma.TransactionClient;

export const COMMISSION_LEVEL_AGENT_MERCHANT = 91;
export const COMMISSION_LEVEL_REFERRER = 93;

export type PlatformSplitSettings = {
  merchantPlatformCutPercent: number;
  agentShareOfPlatformCutPercent: number;
  agentBuyerOrderPercent: number;
  teacherDistributionPercent: number;
  userDistributionPercent: number;
};

export const DEFAULT_PLATFORM_SPLIT: PlatformSplitSettings = {
  merchantPlatformCutPercent: 10,
  agentShareOfPlatformCutPercent: 30,
  agentBuyerOrderPercent: 10,
  teacherDistributionPercent: 8,
  userDistributionPercent: 5,
};

export function clampPercent(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.floor(n)));
}

export function validatePlatformSplitSettings(input: PlatformSplitSettings) {
  for (const [key, label] of [
    ["merchantPlatformCutPercent", "入驻商家平台抽成比例"],
    ["agentShareOfPlatformCutPercent", "加盟代理（商家抽成再分）比例"],
    ["agentBuyerOrderPercent", "加盟代理（用户成交）分成比例"],
    ["teacherDistributionPercent", "老师分销分成比例"],
    ["userDistributionPercent", "用户分销提成比例"],
  ] as const) {
    const n = input[key];
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      return `${label}需为 0–100 的整数`;
    }
  }
  return null;
}

export async function getPlatformSplitSettings(
  db: Db,
): Promise<PlatformSplitSettings> {
  const row = await db.siteSettings.findUnique({ where: { id: "default" } });
  if (!row) return { ...DEFAULT_PLATFORM_SPLIT };
  return {
    merchantPlatformCutPercent: clampPercent(
      row.merchantPlatformCutPercent ??
        DEFAULT_PLATFORM_SPLIT.merchantPlatformCutPercent,
    ),
    agentShareOfPlatformCutPercent: clampPercent(
      row.agentShareOfPlatformCutPercent ??
        DEFAULT_PLATFORM_SPLIT.agentShareOfPlatformCutPercent,
    ),
    agentBuyerOrderPercent: clampPercent(
      row.agentBuyerOrderPercent ??
        DEFAULT_PLATFORM_SPLIT.agentBuyerOrderPercent,
    ),
    teacherDistributionPercent: clampPercent(
      (row as { teacherDistributionPercent?: number })
        .teacherDistributionPercent ??
        DEFAULT_PLATFORM_SPLIT.teacherDistributionPercent,
    ),
    userDistributionPercent: clampPercent(
      (row as { userDistributionPercent?: number }).userDistributionPercent ??
        DEFAULT_PLATFORM_SPLIT.userDistributionPercent,
    ),
  };
}

/** 按推荐人角色取成交分成比例；站长不计；商家推荐暂用用户比例 */
export function referrerRateForRole(
  role: string,
  settings: PlatformSplitSettings,
): number {
  if (role === "AGENT") return settings.agentBuyerOrderPercent;
  if (role === "TEACHER") return settings.teacherDistributionPercent;
  if (role === "STUDENT" || role === "MERCHANT") {
    return settings.userDistributionPercent;
  }
  return 0;
}

export type OrderSettlement = {
  platformCutPercent: number;
  platformCutAmount: number;
  merchantNetAmount: number;
  agentMerchantShareAmount: number;
  agentMerchantId: string;
  referrerUserId: string;
  referrerRole: string;
  referrerSharePercent: number;
  referrerShareAmount: number;
};

async function resolveReferrer(
  db: Db,
  order: { userId: string; referralCode?: string | null },
): Promise<{ id: string; role: Role } | null> {
  const code = order.referralCode?.trim();
  if (code) {
    const byCode = await db.user.findFirst({
      where: { referralCode: code },
      select: { id: true, role: true },
    });
    if (byCode && isRole(byCode.role) && byCode.id !== order.userId) {
      return { id: byCode.id, role: byCode.role };
    }
  }

  const buyer = await db.user.findUnique({
    where: { id: order.userId },
    select: {
      referredBy: { select: { id: true, role: true } },
    },
  });
  if (
    buyer?.referredBy &&
    isRole(buyer.referredBy.role) &&
    buyer.referredBy.id !== order.userId
  ) {
    return { id: buyer.referredBy.id, role: buyer.referredBy.role };
  }
  return null;
}

/**
 * 计算并写入订单分成；给代理/推荐人记 Commission；再跑三级分销。
 */
export async function settlePaidOrderSplit(
  db: Db,
  order: {
    id: string;
    userId: string;
    amount: number;
    courseId: string;
    referralCode?: string | null;
  },
): Promise<OrderSettlement> {
  const empty: OrderSettlement = {
    platformCutPercent: 0,
    platformCutAmount: 0,
    merchantNetAmount: 0,
    agentMerchantShareAmount: 0,
    agentMerchantId: "",
    referrerUserId: "",
    referrerRole: "",
    referrerSharePercent: 0,
    referrerShareAmount: 0,
  };

  if (order.amount <= 0) {
    await db.order.update({ where: { id: order.id }, data: empty });
    return empty;
  }

  const settings = await getPlatformSplitSettings(db);
  const course = await db.course.findUnique({
    where: { id: order.courseId },
    select: {
      teacher: {
        select: {
          id: true,
          role: true,
          roles: true,
          merchant: { select: { agentId: true } },
        },
      },
    },
  });

  const settlement: OrderSettlement = { ...empty };
  const teacher = course?.teacher;

  // —— 入驻商家课：平台抽成 + 发展商家的代理再分 ——
  if (teacher && hasRole({ role: teacher.role, roles: teacher.roles || "" }, "MERCHANT")) {
    const cutPct = settings.merchantPlatformCutPercent;
    const platformCut = Math.floor((order.amount * cutPct) / 100);
    settlement.platformCutPercent = cutPct;
    settlement.platformCutAmount = platformCut;
    settlement.merchantNetAmount = order.amount - platformCut;

    // 归属以 Merchant.agentId 为准（站长可手工指定）；不再仅凭 referredBy 推断
    const agentId = teacher.merchant?.agentId || "";
    if (agentId && platformCut > 0) {
      const agent = await db.user.findUnique({
        where: { id: agentId },
        select: { id: true, role: true, roles: true },
      });
      if (agent && hasRole({ role: agent.role, roles: agent.roles || "" }, "AGENT")) {
        const sharePct = settings.agentShareOfPlatformCutPercent;
        settlement.agentMerchantId = agent.id;
        settlement.agentMerchantShareAmount = Math.floor(
          (platformCut * sharePct) / 100,
        );
      }
    }
  }

  // —— 单一推荐人成交分成 ——
  const referrer = await resolveReferrer(db, order);
  if (referrer) {
    const rate = referrerRateForRole(referrer.role, settings);
    settlement.referrerUserId = referrer.id;
    settlement.referrerRole = referrer.role;
    settlement.referrerSharePercent = rate;
    settlement.referrerShareAmount = Math.floor((order.amount * rate) / 100);
  }

  await db.order.update({
    where: { id: order.id },
    data: settlement,
  });

  if (
    settlement.agentMerchantId &&
    settlement.agentMerchantShareAmount > 0
  ) {
    const exists = await db.commission.count({
      where: {
        orderId: order.id,
        beneficiaryId: settlement.agentMerchantId,
        level: COMMISSION_LEVEL_AGENT_MERCHANT,
      },
    });
    if (!exists) {
      await db.commission.create({
        data: {
          orderId: order.id,
          beneficiaryId: settlement.agentMerchantId,
          buyerId: order.userId,
          level: COMMISSION_LEVEL_AGENT_MERCHANT,
          ratePercent: settings.agentShareOfPlatformCutPercent,
          amount: settlement.agentMerchantShareAmount,
          status: "SETTLED",
        },
      });
    }
  }

  if (settlement.referrerUserId && settlement.referrerShareAmount > 0) {
    const exists = await db.commission.count({
      where: {
        orderId: order.id,
        beneficiaryId: settlement.referrerUserId,
        level: COMMISSION_LEVEL_REFERRER,
      },
    });
    if (!exists) {
      await db.commission.create({
        data: {
          orderId: order.id,
          beneficiaryId: settlement.referrerUserId,
          buyerId: order.userId,
          level: COMMISSION_LEVEL_REFERRER,
          ratePercent: settlement.referrerSharePercent,
          amount: settlement.referrerShareAmount,
          status: "SETTLED",
        },
      });
    }
  }

  const skipL1Ids =
    settlement.referrerUserId && settlement.referrerShareAmount > 0
      ? new Set([settlement.referrerUserId])
      : undefined;

  await createCommissionsForOrder(
    db,
    {
      id: order.id,
      userId: order.userId,
      amount: order.amount,
    },
    skipL1Ids,
  );

  return settlement;
}

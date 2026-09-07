/**
 * 识图转 LaTeX 服务端账本：查额度、扣页、支付履约发页。
 * 站长跳过整套账本（不限次免费）。扣页发生在识别/转换成功之后，失败不扣。
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { isAdmin, type RoleInput } from "@andyyyds/shared/roles";
import {
  evaluateMathcodeQuota,
  MATHCODE_MEMBERSHIP_PAGES,
  MATHCODE_MEMBERSHIP_SLUG,
  MATHCODE_PAGE_SLUG,
  MATHCODE_PRICING,
  nextMembershipGrant,
  type MathcodeQuotaDecision,
  type MathcodeWalletView,
} from "@andyyyds/mathcode/lib/mathcode-quota";

type Db = PrismaClient | Prisma.TransactionClient;

export type MathcodeAccessSnapshot = {
  loggedIn: true;
  unlimited: boolean;
  memberActive: boolean;
  memberPages: number;
  guestPages: number;
  available: number;
  memberUntil: string | null;
  pricing: typeof MATHCODE_PRICING;
};

const EMPTY_WALLET: MathcodeWalletView = {
  memberPages: 0,
  memberUntil: null,
  guestPages: 0,
};

export async function getOrCreateMathcodeWallet(
  db: Db,
  userId: string,
): Promise<MathcodeWalletView> {
  const row = await db.mathcodeWallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  return {
    memberPages: row.memberPages,
    memberUntil: row.memberUntil,
    guestPages: row.guestPages,
  };
}

export function evaluateMathcodeAccess(input: {
  session: RoleInput;
  wallet: MathcodeWalletView;
  pageCount: number;
  now?: Date;
}): MathcodeQuotaDecision {
  return evaluateMathcodeQuota({
    unlimited: isAdmin(input.session),
    wallet: input.wallet,
    pageCount: input.pageCount,
    now: input.now,
  });
}

export async function loadMathcodeAccessSnapshot(
  db: Db,
  session: { id: string } & RoleInput,
): Promise<MathcodeAccessSnapshot> {
  if (isAdmin(session)) {
    return {
      loggedIn: true,
      unlimited: true,
      memberActive: false,
      memberPages: 0,
      guestPages: 0,
      available: 0,
      memberUntil: null,
      pricing: MATHCODE_PRICING,
    };
  }
  const wallet = await getOrCreateMathcodeWallet(db, session.id);
  const decision = evaluateMathcodeAccess({
    session,
    wallet,
    pageCount: 0,
  });
  return {
    loggedIn: true,
    unlimited: false,
    memberActive: decision.memberActive,
    memberPages: decision.memberPages,
    guestPages: decision.guestPages,
    available: Number.isFinite(decision.available) ? decision.available : 0,
    memberUntil: wallet.memberUntil
      ? new Date(wallet.memberUntil).toISOString()
      : null,
    pricing: MATHCODE_PRICING,
  };
}

export async function assertMathcodeCanConsume(
  db: Db,
  session: { id: string } & RoleInput,
  pageCount: number,
): Promise<MathcodeQuotaDecision> {
  if (isAdmin(session)) {
    return evaluateMathcodeAccess({
      session,
      wallet: EMPTY_WALLET,
      pageCount,
    });
  }
  const wallet = await getOrCreateMathcodeWallet(db, session.id);
  return evaluateMathcodeAccess({ session, wallet, pageCount });
}

export class MathcodeQuotaError extends Error {
  readonly decision: MathcodeQuotaDecision;

  constructor(decision: MathcodeQuotaDecision) {
    const message =
      !decision.ok && decision.code === "NEED_RENEW"
        ? "本月会员额度已用完，请再开通会员获得新的 150 页"
        : "余额不足，请先微信支付后再转换";
    super(message);
    this.name = "MathcodeQuotaError";
    this.decision = decision;
  }
}

/**
 * 识别/转换成功后扣 1 页。会员期内优先扣 memberPages，否则扣已买的 guestPages。
 */
async function runInTx<T>(
  db: Db,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if ("$transaction" in db && typeof db.$transaction === "function") {
    return (db as PrismaClient).$transaction(fn);
  }
  return fn(db as Prisma.TransactionClient);
}

export async function consumeMathcodePage(
  db: Db,
  session: { id: string } & RoleInput,
  unitLabel: string,
): Promise<void> {
  if (isAdmin(session)) return;

  await runInTx(db, async (tx) => {
    const wallet = await getOrCreateMathcodeWallet(tx, session.id);
    const decision = evaluateMathcodeAccess({
      session,
      wallet,
      pageCount: 1,
    });
    if (!decision.ok) {
      throw new MathcodeQuotaError(decision);
    }

    if (decision.memberActive && decision.memberPages > 0) {
      const updated = await tx.mathcodeWallet.updateMany({
        where: { userId: session.id, memberPages: { gt: 0 } },
        data: { memberPages: { decrement: 1 } },
      });
      if (updated.count !== 1) {
        throw new MathcodeQuotaError(decision);
      }
      await tx.mathcodeUsage.create({
        data: {
          userId: session.id,
          source: "MEMBER",
          unitLabel: unitLabel.slice(0, 180),
        },
      });
      return;
    }

    if (decision.guestPages > 0) {
      const updated = await tx.mathcodeWallet.updateMany({
        where: { userId: session.id, guestPages: { gt: 0 } },
        data: { guestPages: { decrement: 1 } },
      });
      if (updated.count !== 1) {
        throw new MathcodeQuotaError(decision);
      }
      await tx.mathcodeUsage.create({
        data: {
          userId: session.id,
          source: "GUEST",
          unitLabel: unitLabel.slice(0, 180),
        },
      });
      return;
    }

    throw new MathcodeQuotaError(decision);
  });
}

type PaidOrderLike = {
  id: string;
  userId: string;
  quantity: number;
  course?: { productType: string; slug: string } | null;
  courseId: string;
};

/**
 * 支付成功发页。用 MathcodeGrant.orderId 做幂等：回调重放不得再加 150 页。
 */
export async function grantMathcodePaidOrder(
  db: Db,
  order: PaidOrderLike,
): Promise<void> {
  const course =
    order.course ||
    (await db.course.findUnique({
      where: { id: order.courseId },
      select: { productType: true, slug: true },
    }));
  if (!course || course.productType !== "MATHCODE") return;

  const existing = await db.mathcodeGrant.findUnique({
    where: { orderId: order.id },
  });
  if (existing) return;

  await runInTx(db, async (tx) => {
    const replay = await tx.mathcodeGrant.findUnique({
      where: { orderId: order.id },
    });
    if (replay) return;

    const wallet = await getOrCreateMathcodeWallet(tx, order.userId);

    if (course.slug === MATHCODE_MEMBERSHIP_SLUG) {
      const next = nextMembershipGrant(wallet);
      try {
        await tx.mathcodeGrant.create({
          data: {
            orderId: order.id,
            userId: order.userId,
            kind: "MEMBERSHIP",
            pages: MATHCODE_MEMBERSHIP_PAGES,
          },
        });
      } catch (error) {
        if (isUniqueConstraint(error)) return;
        throw error;
      }
      await tx.mathcodeWallet.update({
        where: { userId: order.userId },
        data: {
          memberPages: next.memberPages,
          memberUntil: next.memberUntil,
        },
      });
      return;
    }

    if (course.slug === MATHCODE_PAGE_SLUG) {
      const pages = Math.max(1, Math.floor(order.quantity || 1));
      try {
        await tx.mathcodeGrant.create({
          data: {
            orderId: order.id,
            userId: order.userId,
            kind: "PAGES",
            pages,
          },
        });
      } catch (error) {
        if (isUniqueConstraint(error)) return;
        throw error;
      }
      await tx.mathcodeWallet.update({
        where: { userId: order.userId },
        data: { guestPages: { increment: pages } },
      });
    }
  });
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export function mathcodeQuotaHttpBody(decision: MathcodeQuotaDecision) {
  if (decision.ok) {
    return {
      ok: true as const,
      unlimited: decision.unlimited,
      memberActive: decision.memberActive,
      memberPages: decision.memberPages,
      guestPages: decision.guestPages,
      available: Number.isFinite(decision.available) ? decision.available : 0,
    };
  }
  return {
    ok: false as const,
    error:
      decision.code === "NEED_RENEW"
        ? "本月会员额度已用完，请再开通会员获得新的 150 页。会员期内不能按 0.5 元/页补差。"
        : `还差 ${decision.pagesNeeded} 页，请先微信支付 ¥${(decision.amountCents / 100).toFixed(2)}`,
    code: decision.code,
    memberActive: decision.memberActive,
    memberPages: decision.memberPages,
    guestPages: decision.guestPages,
    available: decision.available,
    ...(decision.code === "NEED_PAY"
      ? { pagesNeeded: decision.pagesNeeded, amountCents: decision.amountCents }
      : {}),
  };
}

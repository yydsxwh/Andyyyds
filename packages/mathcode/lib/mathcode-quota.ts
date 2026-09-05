/**
 * 识图转 LaTeX 定价与额度规则（可在客户端与服务端共用，勿引入 Prisma / 密钥）。
 *
 * 为什么集中在这里：改会员价、每页价、每月页数时只改这一处，
 * 下单、扣页、前台文案都读同一套常量，避免 0.5 / 0.2 / 30 元散落算错。
 */

/** 未开会员：每页（每张图 / PDF 每一页 / 每个转换块）50 分 = 0.5 元，先微信支付再识别 */
export const MATHCODE_GUEST_CENTS_PER_PAGE = 50;

/**
 * 会员价语义：0.2 元/页。只用来解释「30 元 = 150 页」，
 * 超额不能按 0.2 散买补差，必须再开通会员拿到新的 150 页。
 */
export const MATHCODE_MEMBER_CENTS_PER_PAGE = 20;

/** 包月会员：30 元 = 3000 分 */
export const MATHCODE_MEMBERSHIP_CENTS = 3000;

/** 30 ÷ 0.2 = 150 页（或 150 张图） */
export const MATHCODE_MEMBERSHIP_PAGES = 150;

/** 会员有效期：30 天；续费从当前到期日再延 30 天 */
export const MATHCODE_MEMBERSHIP_DAYS = 30;

export const MATHCODE_MEMBERSHIP_SLUG = "mathcode-membership";
export const MATHCODE_PAGE_SLUG = "mathcode-page";

export const MATHCODE_MAX_PAY_PAGES = 40;

export type MathcodeWalletView = {
  memberPages: number;
  memberUntil: Date | string | null;
  guestPages: number;
};

export type MathcodeQuotaOk = {
  ok: true;
  unlimited: boolean;
  memberActive: boolean;
  memberPages: number;
  guestPages: number;
  available: number;
};

export type MathcodeQuotaNeedPay = {
  ok: false;
  code: "NEED_PAY";
  memberActive: false;
  memberPages: number;
  guestPages: number;
  available: number;
  pagesNeeded: number;
  amountCents: number;
};

export type MathcodeQuotaNeedRenew = {
  ok: false;
  code: "NEED_RENEW";
  memberActive: true;
  memberPages: number;
  guestPages: number;
  available: number;
};

export type MathcodeQuotaDecision =
  | MathcodeQuotaOk
  | MathcodeQuotaNeedPay
  | MathcodeQuotaNeedRenew;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function parseWalletDate(
  value: Date | string | null | undefined,
): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 会员未到期才认 memberPages；过期后剩余会员页作废，不能继续用。 */
export function isMathcodeMemberActive(
  until: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  const date = parseWalletDate(until);
  return Boolean(date && date.getTime() > now.getTime());
}

export function usableMathcodePages(
  wallet: MathcodeWalletView,
  now: Date = new Date(),
): { memberActive: boolean; memberPages: number; guestPages: number; available: number } {
  const memberActive = isMathcodeMemberActive(wallet.memberUntil, now);
  const memberPages = memberActive ? Math.max(0, Math.floor(wallet.memberPages || 0)) : 0;
  const guestPages = Math.max(0, Math.floor(wallet.guestPages || 0));
  return {
    memberActive,
    memberPages,
    guestPages,
    available: memberPages + guestPages,
  };
}

/**
 * 判断这一批 n 页能不能直接转。
 * 会员期内额度不够：只能续费，不能再按 0.5 元补差（已买剩的 guestPages 仍可用）。
 */
export function evaluateMathcodeQuota(input: {
  unlimited?: boolean;
  wallet: MathcodeWalletView;
  pageCount: number;
  now?: Date;
}): MathcodeQuotaDecision {
  const now = input.now ?? new Date();
  const pageCount = Math.max(0, Math.floor(input.pageCount || 0));
  if (input.unlimited) {
    return {
      ok: true,
      unlimited: true,
      memberActive: false,
      memberPages: 0,
      guestPages: 0,
      available: Number.POSITIVE_INFINITY,
    };
  }

  const usable = usableMathcodePages(input.wallet, now);
  if (pageCount <= 0 || usable.available >= pageCount) {
    return { ok: true, unlimited: false, ...usable };
  }
  if (usable.memberActive) {
    return { ok: false, code: "NEED_RENEW", ...usable, memberActive: true };
  }
  const pagesNeeded = pageCount - usable.guestPages;
  return {
    ok: false,
    code: "NEED_PAY",
    ...usable,
    memberActive: false,
    pagesNeeded,
    amountCents: pagesNeeded * MATHCODE_GUEST_CENTS_PER_PAGE,
  };
}

/**
 * 开通/续费后的会员账本。
 * 过期再开：丢掉过期剩余页，重新给 150，从现在起 30 天。
 * 期内再开：叠加 150，到期日再延 30 天。
 */
export function nextMembershipGrant(
  wallet: MathcodeWalletView,
  now: Date = new Date(),
): { memberPages: number; memberUntil: Date } {
  const expired = !isMathcodeMemberActive(wallet.memberUntil, now);
  const currentUntil = parseWalletDate(wallet.memberUntil);
  const base = expired || !currentUntil ? now : currentUntil;
  return {
    memberPages: expired
      ? MATHCODE_MEMBERSHIP_PAGES
      : Math.max(0, Math.floor(wallet.memberPages || 0)) + MATHCODE_MEMBERSHIP_PAGES,
    memberUntil: addUtcDays(base, MATHCODE_MEMBERSHIP_DAYS),
  };
}

export const MATHCODE_PRICING = {
  guestCentsPerPage: MATHCODE_GUEST_CENTS_PER_PAGE,
  memberCentsPerPage: MATHCODE_MEMBER_CENTS_PER_PAGE,
  membershipCents: MATHCODE_MEMBERSHIP_CENTS,
  membershipPages: MATHCODE_MEMBERSHIP_PAGES,
  membershipDays: MATHCODE_MEMBERSHIP_DAYS,
} as const;

/**
 * 识图前台读额度 / 下单。纯 fetch，给工具页和计费条共用。
 */

import { MATHCODE_PRICING } from "@andyyyds/mathcode/lib/mathcode-quota";

export type MathcodePayChannels = {
  mode: string;
  wechat: boolean;
  alipay: boolean;
  mockOnly: boolean;
};

export type MathcodeAccessState = {
  loggedIn: boolean;
  unlimited: boolean;
  memberActive: boolean;
  memberPages: number;
  guestPages: number;
  available: number;
  memberUntil: string | null;
  pricing: typeof MATHCODE_PRICING;
  channels: MathcodePayChannels;
};

const EMPTY_CHANNELS: MathcodePayChannels = {
  mode: "mock",
  wechat: false,
  alipay: false,
  mockOnly: true,
};

export function emptyMathcodeAccess(): MathcodeAccessState {
  return {
    loggedIn: false,
    unlimited: false,
    memberActive: false,
    memberPages: 0,
    guestPages: 0,
    available: 0,
    memberUntil: null,
    pricing: MATHCODE_PRICING,
    channels: EMPTY_CHANNELS,
  };
}

export async function fetchMathcodeAccess(): Promise<MathcodeAccessState> {
  const res = await fetch("/api/mathcode/access", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as Partial<MathcodeAccessState> & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || "无法读取额度");
  }
  return {
    ...emptyMathcodeAccess(),
    ...data,
    pricing: data.pricing || MATHCODE_PRICING,
    channels: data.channels || EMPTY_CHANNELS,
  };
}

export type MathcodeGateResult =
  | { ok: true }
  | {
      ok: false;
      code: "NEED_PAY" | "NEED_RENEW" | "NEED_LOGIN";
      error: string;
      pagesNeeded?: number;
      amountCents?: number;
    };

export async function checkMathcodePages(pageCount: number): Promise<MathcodeGateResult> {
  const res = await fetch("/api/mathcode/access", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageCount }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    code?: string;
    pagesNeeded?: number;
    amountCents?: number;
  };
  if (res.status === 401) {
    return { ok: false, code: "NEED_LOGIN", error: data.error || "请先登录" };
  }
  if (res.ok && data.ok) return { ok: true };
  if (data.code === "NEED_RENEW" || data.code === "NEED_PAY") {
    return {
      ok: false,
      code: data.code,
      error: data.error || "额度不足",
      pagesNeeded: data.pagesNeeded,
      amountCents: data.amountCents,
    };
  }
  return {
    ok: false,
    code: "NEED_PAY",
    error: data.error || "额度不足，请先支付",
  };
}

export async function createMathcodeCheckout(
  kind: "membership" | "pages",
  pageCount?: number,
): Promise<{ orderId: string; amount: number }> {
  const res = await fetch("/api/mathcode/checkout", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, pageCount }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    orderId?: string;
    amount?: number;
    error?: string;
  };
  if (!res.ok || !data.orderId) {
    throw new Error(data.error || "下单失败");
  }
  return { orderId: data.orderId, amount: data.amount || 0 };
}

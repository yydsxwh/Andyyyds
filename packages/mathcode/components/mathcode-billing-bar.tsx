"use client";

import { formatPrice } from "@andyyyds/shared/utils";
import type { MathcodeAccessState } from "@andyyyds/mathcode/lib/mathcode-access-client";
import {
  MATHCODE_GUEST_CENTS_PER_PAGE,
  MATHCODE_MEMBERSHIP_CENTS,
  MATHCODE_MEMBERSHIP_PAGES,
} from "@andyyyds/mathcode/lib/mathcode-quota";

type Props = {
  access: MathcodeAccessState;
  loading?: boolean;
  onBuyMembership: () => void;
};

function memberUntilLabel(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}月${date.getDate()}日到期`;
}

export function MathcodeBillingBar({ access, loading, onBuyMembership }: Props) {
  if (loading) {
    return (
      <section className="surface rounded-[28px] p-5 sm:p-6">
        <p className="text-sm text-[var(--muted)]">正在读取转换额度…</p>
      </section>
    );
  }
  if (access.unlimited) {
    return (
      <section className="surface rounded-[28px] p-5 sm:p-6">
        <p className="text-sm font-medium text-[var(--brand)]">站长免费 · 不限次数</p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          你正在用站长账号，识别和转换不扣页、不收费。
        </p>
      </section>
    );
  }

  const remain = access.available;
  return (
    <section className="surface rounded-[28px] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--ink)]">转换额度</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            未开会员 {formatPrice(MATHCODE_GUEST_CENTS_PER_PAGE)} / 页（1 张图或 PDF 1 页）。
            会员 {formatPrice(MATHCODE_MEMBERSHIP_CENTS)} / 月，含 {MATHCODE_MEMBERSHIP_PAGES}{" "}
            页（相当于 0.2 元/页）。额度用完须再开通，不能按 0.5 元补差。
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary min-h-11 px-4"
          onClick={onBuyMembership}
        >
          {access.memberActive ? "再开通会员" : "开通会员"} {formatPrice(MATHCODE_MEMBERSHIP_CENTS)}
        </button>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-2xl bg-[var(--bg)] px-3 py-2">
          <dt className="text-xs text-[var(--muted)]">剩余可转</dt>
          <dd className="mt-0.5 text-lg font-semibold">{remain} 页</dd>
        </div>
        <div className="rounded-2xl bg-[var(--bg)] px-3 py-2">
          <dt className="text-xs text-[var(--muted)]">会员页</dt>
          <dd className="mt-0.5 font-medium">
            {access.memberActive ? `${access.memberPages} 页` : "未开通"}
          </dd>
          {access.memberActive && access.memberUntil ? (
            <dd className="text-xs text-[var(--muted)]">
              {memberUntilLabel(access.memberUntil)}
            </dd>
          ) : null}
        </div>
        <div className="rounded-2xl bg-[var(--bg)] px-3 py-2">
          <dt className="text-xs text-[var(--muted)]">已买按页</dt>
          <dd className="mt-0.5 font-medium">{access.guestPages} 页</dd>
        </div>
      </dl>
    </section>
  );
}

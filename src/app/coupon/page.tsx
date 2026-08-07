/**
 * 优惠券分享落地页：?coupon=券码
 * 展示优惠信息与可用商品入口；券码写入本地后跳转商品页可预填。
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCouponBenefit, normalizeCouponCode } from "@/lib/coupons";
import { prisma } from "@/lib/db";
import { productDetailPath, productTypeLabel } from "@/lib/product-types";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ coupon?: string; couponCode?: string }>;
};

export default async function CouponClaimPage({ searchParams }: Props) {
  const params = await searchParams;
  const code = normalizeCouponCode(params.coupon || params.couponCode || "");
  if (!code) {
    return (
      <div className="container py-12">
        <div className="surface mx-auto max-w-lg rounded-[28px] p-6 text-center">
          <h1 className="text-2xl font-semibold">优惠券</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">链接缺少券码</p>
          <Link href="/courses" className="btn btn-primary mt-6 inline-flex min-h-11">
            去课程广场
          </Link>
        </div>
      </div>
    );
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code },
    include: {
      products: {
        include: {
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              productType: true,
              status: true,
              price: true,
            },
          },
        },
      },
    },
  });

  if (!coupon || !coupon.isActive) {
    return (
      <div className="container py-12">
        <div className="surface mx-auto max-w-lg rounded-[28px] p-6 text-center">
          <h1 className="text-2xl font-semibold">优惠券不可用</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            券码 {code} 不存在或已停用
          </p>
          <Link href="/courses" className="btn btn-primary mt-6 inline-flex min-h-11">
            去课程广场
          </Link>
        </div>
      </div>
    );
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return (
      <div className="container py-12">
        <div className="surface mx-auto max-w-lg rounded-[28px] p-6 text-center">
          <h1 className="text-2xl font-semibold">优惠券尚未开始</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">券码 {code}</p>
        </div>
      </div>
    );
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    return (
      <div className="container py-12">
        <div className="surface mx-auto max-w-lg rounded-[28px] p-6 text-center">
          <h1 className="text-2xl font-semibold">优惠券已过期</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">券码 {code}</p>
        </div>
      </div>
    );
  }

  const scope = coupon.productScope || "ALL";
  const selectedProducts = coupon.products
    .map((p) => p.course)
    .filter((c) => c && c.status === "PUBLISHED");

  // 单品券：直达商品详情并带券码，减少一步跳转
  if (scope === "SELECTED" && selectedProducts.length === 1) {
    const p = selectedProducts[0]!;
    redirect(
      `${productDetailPath(p.slug, p.productType)}?coupon=${encodeURIComponent(code)}`,
    );
  }

  return (
    <div className="container space-y-6 py-12">
      <div className="surface mx-auto max-w-lg space-y-4 rounded-[28px] p-6">
        <div>
          <p className="text-sm text-[var(--muted)]">你收到一张优惠券</p>
          <h1 className="mt-1 text-2xl font-semibold">{coupon.title}</h1>
        </div>
        <div className="rounded-2xl bg-[var(--brand-soft)] px-4 py-3">
          <div className="text-lg font-semibold text-[var(--fire)]">
            {formatCouponBenefit(coupon)}
          </div>
          <div className="mt-1 font-mono text-sm tracking-wide text-[var(--brand)]">
            券码 {coupon.code}
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            {coupon.minAmount > 0
              ? `满 ${formatPrice(coupon.minAmount)} 可用`
              : "无门槛"}
            {scope === "ALL" ? " · 全站商品" : " · 指定商品"}
          </div>
        </div>
        <p className="text-sm text-[var(--muted)]">
          打开下方商品并购买时，将自动填入此券码（也可手动输入）。
        </p>

        {scope === "ALL" ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/courses?coupon=${encodeURIComponent(code)}`}
              className="btn btn-primary min-h-11 flex-1 text-center"
            >
              去课程广场使用
            </Link>
            <Link
              href={`/materials?coupon=${encodeURIComponent(code)}`}
              className="btn btn-secondary min-h-11 flex-1 text-center"
            >
              去资料广场
            </Link>
          </div>
        ) : selectedProducts.length > 0 ? (
          <ul className="space-y-2">
            {selectedProducts.map((p) => (
              <li key={p!.id}>
                <Link
                  href={`${productDetailPath(p!.slug, p!.productType)}?coupon=${encodeURIComponent(code)}`}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm hover:border-[var(--brand)]"
                >
                  <span>
                    <span className="mr-2 text-xs text-[var(--muted)]">
                      {productTypeLabel(p!.productType)}
                    </span>
                    {p!.title}
                  </span>
                  <span className="shrink-0 text-[var(--brand)]">去使用</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            适用商品暂未上架，请稍后再试。
          </p>
        )}
      </div>
    </div>
  );
}

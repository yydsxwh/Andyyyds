import Link from "next/link";
import { redirect } from "next/navigation";
import { ShopBottomNav } from "@/components/shop-bottom-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { productDetailPath } from "@/lib/product-types";
import { resolveStoredAccessUrl } from "@/lib/storage";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "我的订单",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "待支付",
  PAID: "已完成",
  CANCELLED: "已取消",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/orders");

  const params = await searchParams;
  const statusFilter = params.status?.trim().toUpperCase();

  const orders = await prisma.order.findMany({
    where: {
      userId: session.id,
      ...(statusFilter && ["PENDING", "PAID", "CANCELLED"].includes(statusFilter)
        ? { status: statusFilter }
        : {}),
    },
    include: {
      course: {
        select: {
          title: true,
          slug: true,
          coverUrl: true,
          productType: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const withCovers = await Promise.all(
    orders.map(async (o) => ({
      ...o,
      coverUrl: await resolveStoredAccessUrl(o.course.coverUrl),
    })),
  );

  const tabs = [
    { key: "", label: "全部" },
    { key: "PENDING", label: "待支付" },
    { key: "PAID", label: "已完成" },
  ];

  return (
    <div className="container max-w-lg py-4 pb-24 sm:py-8">
      <h1 className="mb-4 text-2xl font-semibold">我的订单</h1>

      <div className="mb-4 flex border-b border-[var(--line)]">
        {tabs.map((tab) => {
          const active = (statusFilter || "") === tab.key;
          const href = tab.key ? `/orders?status=${tab.key}` : "/orders";
          return (
            <Link
              key={tab.key || "all"}
              href={href}
              className={`min-h-11 flex-1 text-center text-sm leading-[2.75rem] ${
                active
                  ? "border-b-2 border-[var(--fire)] font-semibold text-[var(--fire)]"
                  : "text-[var(--muted)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {withCovers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-16 text-center">
          <p className="text-[var(--muted)]">暂无订单</p>
          <Link href="/shop" className="btn btn-primary mt-4 inline-flex min-h-11">
            去商城逛逛
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {withCovers.map((order) => (
            <div
              key={order.id}
              className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-3"
            >
              <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                <span>{order.orderNo}</span>
                <span
                  className={
                    order.status === "PENDING"
                      ? "text-[var(--fire)]"
                      : order.status === "PAID"
                        ? "text-emerald-700"
                        : ""
                  }
                >
                  {STATUS_LABEL[order.status] || order.status}
                </span>
              </div>
              <Link href={`/orders/${order.id}`} className="mt-3 flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={order.coverUrl}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-medium">
                    {order.course.title}
                  </div>
                  {order.specLabel ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {order.specLabel}
                    </p>
                  ) : null}
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-[var(--muted)]">×{order.quantity}</span>
                    <span className="font-semibold text-[var(--fire)]">
                      {formatPrice(order.amount)}
                    </span>
                  </div>
                </div>
              </Link>
              <div className="mt-3 flex justify-end gap-2">
                <Link
                  href={productDetailPath(
                    order.course.slug,
                    order.course.productType,
                  )}
                  className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs"
                >
                  再看看
                </Link>
                {order.status === "PENDING" ? (
                  <Link
                    href={`/checkout/${order.id}`}
                    className="rounded-full bg-[var(--fire)] px-3 py-1.5 text-xs text-white"
                  >
                    去支付
                  </Link>
                ) : (
                  <Link
                    href={`/orders/${order.id}`}
                    className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs"
                  >
                    详情
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ShopBottomNav />
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShopBottomNav } from "@/components/shop-bottom-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseStoredAnswers } from "@/lib/order-form";
import { productDetailPath } from "@/lib/product-types";
import { resolveStoredAccessUrl } from "@/lib/storage";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "待支付",
  PAID: "已支付",
  CANCELLED: "已取消",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/orders");

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      course: true,
      coupon: { select: { code: true, title: true } },
    },
  });
  if (!order || order.userId !== session.id) notFound();

  const coverUrl = await resolveStoredAccessUrl(order.course.coverUrl);
  const answers = parseStoredAnswers(order.formAnswersJson);
  const answerEntries = Object.entries(answers.values);

  return (
    <div className="container max-w-lg py-4 pb-24 sm:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">订单详情</h1>
        <Link href="/orders" className="text-sm text-[var(--brand)]">
          返回列表
        </Link>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--muted)]">{order.orderNo}</span>
          <span
            className={`text-sm font-medium ${
              order.status === "PENDING" ? "text-[var(--fire)]" : ""
            }`}
          >
            {STATUS_LABEL[order.status] || order.status}
          </span>
        </div>

        <Link
          href={productDetailPath(order.course.slug, order.course.productType)}
          className="mt-4 flex gap-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt=""
            className="h-20 w-20 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{order.course.title}</div>
            {order.specLabel ? (
              <p className="mt-1 text-xs text-[var(--muted)]">{order.specLabel}</p>
            ) : null}
            <p className="mt-2 text-sm text-[var(--muted)]">数量 ×{order.quantity}</p>
          </div>
        </Link>

        <dl className="mt-4 space-y-2 border-t border-[var(--line)] pt-4 text-sm">
          {order.discount > 0 ? (
            <div className="flex justify-between">
              <dt>优惠</dt>
              <dd className="text-[var(--fire)]">-{formatPrice(order.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-semibold">
            <dt>实付</dt>
            <dd className="text-[var(--fire)]">{formatPrice(order.amount)}</dd>
          </div>
          {order.payChannel ? (
            <div className="flex justify-between text-[var(--muted)]">
              <dt>支付方式</dt>
              <dd>{order.payChannel}</dd>
            </div>
          ) : null}
          <div className="flex justify-between text-[var(--muted)]">
            <dt>下单时间</dt>
            <dd>{order.createdAt.toLocaleString("zh-CN")}</dd>
          </div>
          {order.paidAt ? (
            <div className="flex justify-between text-[var(--muted)]">
              <dt>支付时间</dt>
              <dd>{order.paidAt.toLocaleString("zh-CN")}</dd>
            </div>
          ) : null}
        </dl>

        {answerEntries.length > 0 ? (
          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <h2 className="text-sm font-medium">下单信息</h2>
            <dl className="mt-2 space-y-2 text-sm">
              {answerEntries.map(([fieldId, value]) => (
                <div key={fieldId} className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">
                    {answers.labels[fieldId] || fieldId}
                  </dt>
                  <dd className="text-right font-medium">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {order.status === "PENDING" ? (
          <Link
            href={`/checkout/${order.id}`}
            className="btn btn-primary mt-6 flex min-h-12 w-full items-center justify-center !bg-[var(--fire)]"
          >
            去支付 {formatPrice(order.amount)}
          </Link>
        ) : null}
      </div>

      <ShopBottomNav />
    </div>
  );
}

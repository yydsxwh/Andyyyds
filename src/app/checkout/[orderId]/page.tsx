import { notFound, redirect } from "next/navigation";
import { CheckoutOrderForm } from "@/components/checkout-order-form";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseStoredAnswers } from "@/lib/order-form";
import { getPaymentChannels } from "@/lib/payments";
import { getOrderFormConfig } from "@/lib/site-settings";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { course: true, coupon: true },
  });
  if (!order || order.userId !== session.id) notFound();

  if (order.status === "PAID") {
    redirect(`/learn/${order.course.slug}`);
  }

  const [channels, orderForm] = await Promise.all([
    getPaymentChannels(),
    getOrderFormConfig(),
  ]);
  const initialAnswers = parseStoredAnswers(order.formAnswersJson).values;

  return (
    <div className="container py-16">
      <div className="surface mx-auto max-w-lg rounded-[28px] p-8">
        <h1 className="text-2xl font-semibold">确认订单</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">订单号 {order.orderNo}</p>
        <div className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span>课程</span>
            <span className="text-right font-medium">{order.course.title}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>优惠</span>
            <span>-{formatPrice(order.discount)}</span>
          </div>
          <div className="flex justify-between gap-4 text-lg font-semibold">
            <span>应付</span>
            <span className="text-[var(--brand)]">{formatPrice(order.amount)}</span>
          </div>
        </div>
        <div className="mt-8">
          <CheckoutOrderForm
            orderId={order.id}
            amount={order.amount}
            channels={channels}
            orderForm={orderForm}
            initialAnswers={initialAnswers}
          />
        </div>
      </div>
    </div>
  );
}

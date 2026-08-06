import { redirect } from "next/navigation";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseStoredAnswers } from "@/lib/order-form";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "待支付",
  PAID: "已支付",
  CANCELLED: "已取消",
};

export default async function StudioOrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/studio");

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { name: true, email: true } },
      course: { select: { title: true } },
    },
  });

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="orders" />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">订单查看</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          查看用户下单信息采集填写内容（最近 50 单）。
        </p>
      </div>

      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="surface rounded-[28px] p-8 text-sm text-[var(--muted)]">
            暂无订单
          </div>
        ) : (
          orders.map((order) => {
            const answers = parseStoredAnswers(order.formAnswersJson);
            const entries = Object.entries(answers.values);
            return (
              <div
                key={order.id}
                className="surface rounded-[28px] p-5 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{order.course.title}</div>
                    <div className="mt-1 text-[var(--muted)]">
                      {order.orderNo} · {order.user.name || order.user.email}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-[var(--brand)]">
                      {formatPrice(order.amount)}
                    </div>
                    <div className="mt-1 text-[var(--muted)]">
                      {STATUS_LABEL[order.status] || order.status}
                      {order.payChannel ? ` · ${order.payChannel}` : ""}
                    </div>
                  </div>
                </div>
                {entries.length > 0 ? (
                  <dl className="mt-4 grid gap-2 border-t border-[var(--line)] pt-4 sm:grid-cols-2">
                    {entries.map(([fieldId, value]) => (
                      <div key={fieldId}>
                        <dt className="text-[var(--muted)]">
                          {answers.labels[fieldId] || fieldId}
                        </dt>
                        <dd className="font-medium">{value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-4 border-t border-[var(--line)] pt-4 text-[var(--muted)]">
                    未填写采集信息
                  </p>
                )}
                <p className="mt-3 text-xs text-[var(--muted)]">
                  {order.createdAt.toLocaleString("zh-CN")}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

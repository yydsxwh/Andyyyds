import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";

export const dynamic = "force-dynamic";

/** 支付宝同步跳回：若订单已支付则进入学习，否则提示等待异步回调 */
export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const orderNoRaw = sp.out_trade_no;
  const orderNo = Array.isArray(orderNoRaw) ? orderNoRaw[0] : orderNoRaw;

  if (orderNo) {
    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: { course: true },
    });
    if (order && order.userId === session.id) {
      if (order.status === "PAID") {
        redirect(`/learn/${order.course.slug}`);
      }
      return (
        <div className="container py-16">
          <div className="surface mx-auto max-w-lg rounded-[28px] p-8 text-center">
            <h1 className="text-2xl font-semibold">支付结果确认中</h1>
            <p className="mt-3 text-sm text-[var(--muted)]">
              若已付款，课程将在数秒内开通。也可稍后在「我的学习」查看。
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href={`/checkout/${order.id}`} className="btn btn-primary">
                返回订单
              </Link>
              <Link href="/learn" className="btn btn-secondary">
                我的学习
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="container py-16">
      <div className="surface mx-auto max-w-lg rounded-[28px] p-8 text-center">
        <h1 className="text-2xl font-semibold">支付已返回</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">请到「我的学习」查看已购课程。</p>
        <Link href="/learn" className="btn btn-primary mt-6 inline-flex">
          我的学习
        </Link>
      </div>
    </div>
  );
}

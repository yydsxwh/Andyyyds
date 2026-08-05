import { redirect } from "next/navigation";
import { MerchantPanel } from "@/components/merchant-panel";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MERCHANT_STATUSES } from "@/lib/merchants";
import type { MerchantStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StudioMerchantsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") {
    redirect("/studio");
  }

  const merchants = await prisma.merchant.findMany({
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          _count: { select: { courses: true } },
          courses: {
            select: {
              orders: {
                where: { status: "PAID" },
                select: { amount: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const grouped = await prisma.merchant.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const counts = Object.fromEntries(
    MERCHANT_STATUSES.map((s) => [
      s,
      grouped.find((c) => c.status === s)?._count._all || 0,
    ]),
  ) as Record<MerchantStatus, number>;

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="merchants" />
      <div>
        <h1 className="text-3xl font-semibold">商家管理</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          管理入驻卖课商家与加盟合作方：审核、启用/停用、维护联系资料，并查看其课程与营收概况。
        </p>
      </div>
      <MerchantPanel
        initialCounts={counts}
        initialMerchants={merchants.map((m) => ({
          id: m.id,
          storeName: m.storeName,
          contactName: m.contactName,
          contactPhone: m.contactPhone,
          contactWechat: m.contactWechat,
          joinType: m.joinType,
          status: m.status,
          notes: m.notes,
          approvedAt: m.approvedAt?.toISOString() ?? null,
          createdAt: m.createdAt.toISOString(),
          user: m.user,
          courseCount: m.user._count.courses,
          revenue: m.user.courses
            .flatMap((c) => c.orders)
            .reduce((sum, o) => sum + o.amount, 0),
        }))}
      />
    </div>
  );
}

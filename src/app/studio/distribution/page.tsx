import { redirect } from "next/navigation";
import { DistributionPanel } from "@/components/distribution-panel";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDistributionSettings } from "@/lib/distribution";

export const dynamic = "force-dynamic";

export default async function StudioDistributionPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "TEACHER" && session.role !== "ADMIN") {
    redirect("/studio");
  }

  const settings = await getDistributionSettings(prisma);
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  const teamCount = await prisma.user.count({ where: { referredById: session.id } });

  const myEarningsAgg = await prisma.commission.aggregate({
    where: { beneficiaryId: session.id },
    _sum: { amount: true },
  });

  const commissions = await prisma.commission.findMany({
    where: session.role === "ADMIN" ? undefined : undefined,
    include: {
      buyer: { select: { name: true, email: true } },
      beneficiary: { select: { name: true, email: true } },
      order: { include: { course: { select: { title: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.yydsxwh.com";
  const inviteCode = user?.referralCode || "";
  const inviteUrl = `${siteUrl.replace(/\/$/, "")}/register?ref=${inviteCode}`;

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="distribution" />
      <div>
        <h1 className="text-3xl font-semibold">分销管理</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          设置一 / 二 / 三级分销比例。用户通过邀请码建立上下级，下级付费后自动结算佣金。
        </p>
      </div>
      <DistributionPanel
        initialSettings={settings}
        inviteCode={inviteCode}
        inviteUrl={inviteUrl}
        myEarnings={myEarningsAgg._sum.amount || 0}
        teamCount={teamCount}
        commissions={commissions.map((c) => ({
          id: c.id,
          level: c.level,
          ratePercent: c.ratePercent,
          amount: c.amount,
          status: c.status,
          createdAt: c.createdAt.toISOString(),
          buyer: c.buyer,
          beneficiary: c.beneficiary,
          order: {
            orderNo: c.order.orderNo,
            amount: c.order.amount,
            course: c.order.course,
          },
        }))}
      />
    </div>
  );
}

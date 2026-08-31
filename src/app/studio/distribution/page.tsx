import { redirect } from "next/navigation";
import { AdminReferralCodesPanel } from "@/components/admin-referral-codes-panel";
import { DistributionPanel } from "@/components/distribution-panel";
import { InviteSharePanel } from "@/components/invite-share-panel";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { getDistributionSettings } from "@andyyyds/shared/distribution";
import {
  canManageDistributionSettings,
  canViewDistribution,
  canViewAllStudioData,
  isAdmin,
} from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

export default async function StudioDistributionPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canViewDistribution(session.role)) {
    redirect("/studio");
  }

  const settings = await getDistributionSettings(prisma);
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  const teamCount = await prisma.user.count({
    where: { referredById: session.id },
  });

  const myEarningsAgg = await prisma.commission.aggregate({
    where: { beneficiaryId: session.id },
    _sum: { amount: true },
  });

  const seeAll = canViewAllStudioData(session.role);
  const commissions = await prisma.commission.findMany({
    where: seeAll ? undefined : { beneficiaryId: session.id },
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
          {canManageDistributionSettings(session.role)
            ? "设置一 / 二 / 三级分销比例。用户通过邀请码建立上下级，下级付费后自动结算佣金。"
            : "查看邀请链接与自己的佣金。分销比例由站长统一配置。"}
        </p>
      </div>
      <DistributionPanel
        initialSettings={settings}
        canEditSettings={canManageDistributionSettings(session.role)}
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

      {inviteCode ? (
        <section className="surface rounded-[28px] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">邀请海报与分享</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            生成带二维码的宣传海报，或复制链接发给微信好友。
          </p>
          <div className="mt-4">
            <InviteSharePanel inviteCode={inviteCode} />
          </div>
        </section>
      ) : null}

      {isAdmin(session.role) ? <AdminReferralSection /> : null}
    </div>
  );
}

async function AdminReferralSection() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      referralCode: true,
      referredBy: { select: { name: true, referralCode: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return (
    <AdminReferralCodesPanel
      initialUsers={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        referralCode: u.referralCode,
        referredByName: u.referredBy?.name || "",
        referredByCode: u.referredBy?.referralCode || "",
      }))}
    />
  );
}

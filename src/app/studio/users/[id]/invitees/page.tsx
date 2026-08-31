import { notFound, redirect } from "next/navigation";
import { InviteesAdminPanel } from "@/components/invitees-admin-panel";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { isAdmin } from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

export default async function StudioUserInviteesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.role)) redirect("/studio");

  const { id } = await params;
  const inviter = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      referralCode: true,
      role: true,
    },
  });
  if (!inviter) notFound();

  const invitees = await prisma.user.findMany({
    where: { referredById: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      referralCode: true,
      createdAt: true,
      _count: {
        select: { orders: true, enrollments: true },
      },
    },
  });

  const paidGrouped =
    invitees.length === 0
      ? []
      : await prisma.order.groupBy({
          by: ["userId"],
          where: {
            userId: { in: invitees.map((u) => u.id) },
            status: "PAID",
          },
          _count: { _all: true },
        });
  const paidByUser = new Map(
    paidGrouped.map((g) => [g.userId, g._count._all]),
  );

  const byRole: Record<string, number> = {};
  let withPaidOrders = 0;
  let withEnrollments = 0;
  let totalPaidOrders = 0;
  let totalEnrollments = 0;

  const rows = invitees.map((u) => {
    const paidOrderCount = paidByUser.get(u.id) || 0;
    const orderCount = u._count.orders;
    const enrollmentCount = u._count.enrollments;
    byRole[u.role] = (byRole[u.role] || 0) + 1;
    if (paidOrderCount > 0) withPaidOrders += 1;
    if (enrollmentCount > 0) withEnrollments += 1;
    totalPaidOrders += paidOrderCount;
    totalEnrollments += enrollmentCount;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone || "",
      role: u.role,
      referralCode: u.referralCode,
      createdAt: u.createdAt.toISOString(),
      orderCount,
      enrollmentCount,
      paidOrderCount,
    };
  });

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="users" area="admin" />
      <InviteesAdminPanel
        inviter={inviter}
        invitees={rows}
        stats={{
          total: rows.length,
          byRole,
          withPaidOrders,
          withEnrollments,
          totalPaidOrders,
          totalEnrollments,
        }}
      />
    </div>
  );
}

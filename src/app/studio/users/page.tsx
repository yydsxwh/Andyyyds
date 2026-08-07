import { redirect } from "next/navigation";
import { StudioNav } from "@/components/studio-nav";
import { UserAdminPanel } from "@/components/user-admin-panel";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

function mapUser(u: {
  id: string;
  name: string;
  email: string;
  role: string;
  requestedRole: string;
  roleApplicationStatus: string;
  roleApplicationNote: string;
  roleReviewedAt: Date | null;
  referralCode: string;
  wechatOpenId: string;
  createdAt: Date;
  referredBy: { id: string; name: string; referralCode: string } | null;
  /** 其邀请进来的下级（注册时 referredBy 指向此人） */
  referrals: Array<{
    id: string;
    name: string;
    email: string;
    referralCode: string;
    role: string;
    createdAt: Date;
  }>;
  _count: {
    orders: number;
    enrollments: number;
    courses: number;
    referrals: number;
  };
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    requestedRole: u.requestedRole,
    roleApplicationStatus: u.roleApplicationStatus,
    roleApplicationNote: u.roleApplicationNote,
    roleReviewedAt: u.roleReviewedAt?.toISOString() ?? null,
    referralCode: u.referralCode,
    referredById: u.referredBy?.id || "",
    referredByName: u.referredBy?.name || "",
    referredByCode: u.referredBy?.referralCode || "",
    hasWechat: Boolean(u.wechatOpenId?.trim()),
    createdAt: u.createdAt.toISOString(),
    orderCount: u._count.orders,
    enrollmentCount: u._count.enrollments,
    courseCount: u._count.courses,
    referralCount: u._count.referrals,
    invitees: u.referrals.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      referralCode: r.referralCode,
      role: r.role,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export default async function StudioUsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.role)) redirect("/studio");

  const select = {
    id: true,
    name: true,
    email: true,
    role: true,
    requestedRole: true,
    roleApplicationStatus: true,
    roleApplicationNote: true,
    roleReviewedAt: true,
    referralCode: true,
    wechatOpenId: true,
    createdAt: true,
    referredBy: { select: { id: true, name: true, referralCode: true } },
    referrals: {
      select: {
        id: true,
        name: true,
        email: true,
        referralCode: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    },
    _count: {
      select: {
        orders: true,
        enrollments: true,
        courses: true,
        referrals: true,
      },
    },
  } as const;

  const [users, pending] = await Promise.all([
    prisma.user.findMany({
      select,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.user.findMany({
      where: { roleApplicationStatus: "PENDING" },
      select,
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ]);

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="users" area="admin" />
      <div>
        <h1 className="text-3xl font-semibold">用户管理</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          查看注册用户、邀请关系（被谁邀请 / 邀请了谁）、审核角色申请，调整身份。至少保留一位站长。
        </p>
      </div>
      <UserAdminPanel
        initialUsers={users.map(mapUser)}
        initialPending={pending.map(mapUser)}
      />
    </div>
  );
}

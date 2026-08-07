import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountAuthPanel } from "@/components/account-auth-panel";
import { AccountProfilePanel } from "@/components/account-profile-panel";
import { InviteSharePanel } from "@/components/invite-share-panel";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { RoleApplyPanel } from "@/components/role-apply-panel";
import { getSession } from "@/lib/auth";
import { isPlaceholderEmail } from "@/lib/auth-email";
import { prisma } from "@/lib/db";
import {
  availableAccountApplyRoles,
} from "@/lib/role-applications";
import {
  canAccessStudio,
  canCreateSellableProducts,
  canManageCourses,
  canReferForCommission,
  canViewAllStudioData,
  isAdmin,
  ROLE_APPLICATION_STATUS_LABEL,
  ROLE_LABEL,
  roleLabel,
  type Role,
  type RoleApplicationStatus,
} from "@/lib/roles";
import { resolveStoredAccessUrl } from "@/lib/storage";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * 统一个人中心：按角色展示学习 / 分销 / 工作室入口，以及申请代理·商家·老师。
 * /learn 仍为「我的学习」列表；本页为登录后主入口。
 */
export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account");

  const teacherScope = canViewAllStudioData(session.role)
    ? undefined
    : session.id;

  const [
    user,
    enrollments,
    myOrders,
    earnings,
    courseCount,
    paidOrdersAgg,
    teamCount,
    recruitedMerchants,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: {
        referralCode: true,
        roleApplicationNote: true,
        roleApplicationStatus: true,
        requestedRole: true,
        email: true,
        phone: true,
        wechatOpenId: true,
        avatarUrl: true,
        passwordSet: true,
      },
    }),
    prisma.enrollment.findMany({
      where: { userId: session.id },
      include: {
        course: { select: { title: true, slug: true, coverUrl: true } },
        progress: { select: { completed: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.order.findMany({
      where: { userId: session.id },
      include: { course: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.commission.aggregate({
      where: { beneficiaryId: session.id },
      _sum: { amount: true },
    }),
    canManageCourses(session.role)
      ? prisma.course.count({
          where: teacherScope ? { teacherId: teacherScope } : undefined,
        })
      : Promise.resolve(0),
    canManageCourses(session.role)
      ? prisma.order.aggregate({
          where: {
            status: "PAID",
            ...(teacherScope ? { course: { teacherId: teacherScope } } : {}),
          },
          _sum: {
            amount: true,
            merchantNetAmount: true,
            platformCutAmount: true,
          },
          _count: true,
        })
      : Promise.resolve(null),
    session.role === "AGENT"
      ? prisma.user.count({ where: { referredById: session.id } })
      : Promise.resolve(0),
    session.role === "AGENT"
      ? prisma.merchant.findMany({
          where: { agentId: session.id },
          include: {
            user: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
  ]);

  const inviteCode = user?.referralCode || "";
  const showRefer = canReferForCommission(session.role);
  const applyRoles = availableAccountApplyRoles(
    session.role,
    user?.roleApplicationStatus || session.roleApplicationStatus,
  );
  const status = user?.roleApplicationStatus || "NONE";
  const statusLabel =
    ROLE_APPLICATION_STATUS_LABEL[status as RoleApplicationStatus] || status;
  const requestedLabel = user?.requestedRole
    ? ROLE_LABEL[user.requestedRole as Role] || user.requestedRole
    : "";

  const studioHref = "/studio";
  const studioLabel =
    session.role === "AGENT"
      ? "代理中心"
      : "创作者中心";
  const avatarDisplayUrl = user?.avatarUrl
    ? await resolveStoredAccessUrl(user.avatarUrl)
    : "";
  const accountEmail = user?.email || session.email || "";
  // 微信/手机自动注册的占位邮箱不展示，避免误以为可登录
  const headerContact = !isPlaceholderEmail(accountEmail)
    ? accountEmail
    : user?.phone
      ? user.phone
      : user?.wechatOpenId
        ? "微信登录"
        : "未绑定邮箱";

  return (
    <NavPageTemplateShell type="account">
    <div className="container space-y-6 py-10 sm:py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">个人中心</h1>
        <p className="text-[var(--muted)]">
          {session.name}
          <span className="mx-2 text-[var(--line)]">·</span>
          {roleLabel(session.role)}
          <span className="mx-2 text-[var(--line)]">·</span>
          <span className="break-all text-sm">{headerContact}</span>
        </p>
      </header>

      {/* 申请状态总览（待审 / 拒绝原因） */}
      {session.rolePending ? (
        <div className="rounded-[28px] border border-amber-200 bg-amber-50/80 p-5">
          <h2 className="text-lg font-semibold text-amber-950">账号待站长审核</h2>
          <p className="mt-1 text-sm text-amber-900/80">
            你已申请成为{requestedLabel || "特殊角色"}，当前「{statusLabel}」。
            通过前可正常学习与消费；对应后台权限暂不可用。
          </p>
        </div>
      ) : null}

      {status === "REJECTED" ? (
        <div className="surface rounded-[28px] border border-[var(--line)] p-5">
          <h2 className="text-lg font-semibold">角色申请未通过</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {user?.roleApplicationNote ||
              "站长未通过你的角色申请。可在下方重新提交申请。"}
          </p>
        </div>
      ) : null}

      {/* —— 按角色的快捷入口 —— */}
      <RoleQuickLinks
        role={session.role}
        studioHref={studioHref}
        studioLabel={studioLabel}
        canStudio={canAccessStudio(session.role)}
        canCreate={canCreateSellableProducts(session.role)}
      />

      {/* —— 头像 / 昵称 —— */}
      <AccountProfilePanel
        initialName={session.name}
        initialAvatarDisplayUrl={avatarDisplayUrl}
      />

      {/* —— 邮箱 / 手机 / 微信绑定（三种登录共用同一账号） —— */}
      <AccountAuthPanel
        email={accountEmail}
        phone={user?.phone || ""}
        hasWechat={Boolean(user?.wechatOpenId)}
        passwordSet={user?.passwordSet !== false}
      />

      {/* —— STUDENT / 通用：学习与订单 —— */}
      <section className="surface rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">我的学习与订单</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/shop" className="btn btn-secondary min-h-10 px-3 text-sm">
              商城
            </Link>
            <Link href="/cart" className="btn btn-secondary min-h-10 px-3 text-sm">
              购物车
            </Link>
            <Link href="/orders" className="btn btn-secondary min-h-10 px-3 text-sm">
              全部订单
            </Link>
            <Link href="/learn" className="btn btn-secondary min-h-10 px-3 text-sm">
              全部课程
            </Link>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs text-[var(--muted)]">已购课程</div>
            <div className="mt-1 text-2xl font-semibold">{enrollments.length}</div>
            <ul className="mt-3 space-y-2">
              {enrollments.slice(0, 3).map((item) => {
                const done = item.progress.filter((p) => p.completed).length;
                return (
                  <li key={item.id}>
                    <Link
                      href={`/learn/${item.course.slug}`}
                      className="block truncate text-sm hover:text-[var(--brand)]"
                    >
                      {item.course.title}
                      <span className="ml-2 text-xs text-[var(--muted)]">
                        已学 {done} 节
                      </span>
                    </Link>
                  </li>
                );
              })}
              {enrollments.length === 0 ? (
                <li className="text-sm text-[var(--muted)]">
                  还没有课程，
                  <Link href="/courses" className="text-[var(--brand)]">
                    去课程广场
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)]">最近订单</div>
            <div className="mt-1 text-2xl font-semibold">{myOrders.length}</div>
            <ul className="mt-3 space-y-2">
              {myOrders.slice(0, 3).map((order) => (
                <li key={order.id}>
                  <Link
                    href={
                      order.status === "PENDING"
                        ? `/checkout/${order.id}`
                        : `/orders/${order.id}`
                    }
                    className="flex items-center justify-between gap-2 text-sm hover:text-[var(--brand)]"
                  >
                    <span className="truncate">{order.course.title}</span>
                    <span className="shrink-0 text-[var(--muted)]">
                      {order.status === "PAID"
                        ? formatPrice(order.amount)
                        : order.status === "PENDING"
                          ? "待支付"
                          : order.status}
                    </span>
                  </Link>
                </li>
              ))}
              {myOrders.length === 0 ? (
                <li className="text-sm text-[var(--muted)]">暂无订单</li>
              ) : null}
            </ul>
          </div>
        </div>
      </section>

      {/* —— 邀请分销：链接 / 海报 / 微信分享 —— */}
      {showRefer && inviteCode ? (
        <section className="surface rounded-[28px] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">邀请与宣传海报</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            用邀请码、分享链接或带二维码的海报邀请好友；对方注册后绑定为你的下级，购买后按规则分成。
            累计提成 {formatPrice(earnings._sum.amount || 0)}。
          </p>
          <div className="mt-4">
            <InviteSharePanel inviteCode={inviteCode} />
          </div>
          {canAccessStudio(session.role) ? (
            <Link
              href="/studio/distribution"
              className="btn btn-secondary mt-4 inline-flex min-h-10"
            >
              查看分销明细
            </Link>
          ) : null}
        </section>
      ) : null}

      {/* —— TEACHER：素材入口 —— */}
      {session.role === "TEACHER" ? (
        <section className="surface rounded-[28px] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">老师工作台</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            老师可维护已分配课程的素材与内容；不可新建可售商品。名下课程{" "}
            <strong>{courseCount}</strong> 门。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/studio/media" className="btn btn-primary min-h-11">
              上传 / 管理素材
            </Link>
            <Link href="/studio/courses" className="btn btn-secondary min-h-11">
              我的课程
            </Link>
          </div>
        </section>
      ) : null}

      {/* —— MERCHANT：课程与结算摘要 —— */}
      {session.role === "MERCHANT" ? (
        <section className="surface rounded-[28px] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">商家经营摘要</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            管理课程与商品；订单结算按平台抽成规则入账。
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StatCard label="我的课程" value={String(courseCount)} />
            <StatCard
              label="已支付订单"
              value={String(paidOrdersAgg?._count || 0)}
            />
            <StatCard
              label="商家实得（累计）"
              value={formatPrice(paidOrdersAgg?._sum.merchantNetAmount || 0)}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/studio/courses" className="btn btn-primary min-h-11">
              我的课程 / 资料
            </Link>
            <Link href="/studio/shop" className="btn btn-secondary min-h-11">
              商城商品
            </Link>
            {canCreateSellableProducts(session.role) ? (
              <Link
                href="/studio/courses/compose"
                className="btn btn-secondary min-h-11"
              >
                开课 / 上架资料
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* —— AGENT：推广、名下商家、开课 —— */}
      {session.role === "AGENT" ? (
        <section className="surface rounded-[28px] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">加盟代理工作台</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            推广获客、发展入驻商家，并可开课出售。
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StatCard label="直推人数" value={String(teamCount)} />
            <StatCard
              label="累计佣金"
              value={formatPrice(earnings._sum.amount || 0)}
            />
            <StatCard
              label="名下商家"
              value={String(recruitedMerchants.length)}
            />
          </div>
          {recruitedMerchants.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {recruitedMerchants.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] px-3 py-2 text-sm"
                >
                  <span>
                    {m.storeName}
                    <span className="ml-2 text-[var(--muted)]">
                      {m.user.name}
                    </span>
                  </span>
                  <span className="text-xs text-[var(--muted)]">{m.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              暂无归属商家。邀请好友以商家身份入驻后，可从平台抽成中再分。
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/studio" className="btn btn-primary min-h-11">
              代理中心
            </Link>
            <Link
              href="/studio/distribution"
              className="btn btn-secondary min-h-11"
            >
              分销数据
            </Link>
            <Link
              href="/studio/courses/compose"
              className="btn btn-secondary min-h-11"
            >
              开课 / 上架资料
            </Link>
          </div>
        </section>
      ) : null}

      {/* —— ADMIN：站长快捷链 —— */}
      {isAdmin(session.role) ? (
        <section className="surface rounded-[28px] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">站长管理</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            审核角色申请、管理系统与内容。
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <AdminLink href="/studio/admin" label="站长管理总览" />
            <AdminLink href="/studio" label="创作者中心" />
            <AdminLink href="/studio/users" label="用户 / 角色审核" />
            <AdminLink href="/studio/merchants" label="商家管理" />
            <AdminLink href="/studio/products" label="产品管理" />
            <AdminLink href="/studio/decorate" label="装修" />
            <AdminLink href="/studio/cms" label="内容管理" />
            <AdminLink href="/studio/settings" label="系统设置" />
          </div>
        </section>
      ) : null}

      {/* —— 申请成为代理 / 商家 / 老师 —— */}
      {!isAdmin(session.role) ? (
        <RoleApplyPanel
          availableRoles={applyRoles}
          applicationStatus={status}
          requestedRole={user?.requestedRole || ""}
          applicationNote={user?.roleApplicationNote || ""}
        />
      ) : null}
    </div>
    </NavPageTemplateShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function AdminLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center rounded-2xl border border-[var(--line)] px-4 text-sm font-medium hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/5"
    >
      {label}
    </Link>
  );
}

function RoleQuickLinks({
  role,
  studioHref,
  studioLabel,
  canStudio,
  canCreate,
}: {
  role: Role;
  studioHref: string;
  studioLabel: string;
  canStudio: boolean;
  canCreate: boolean;
}) {
  const links: { href: string; label: string }[] = [
    { href: "/learn", label: "我的学习" },
    { href: "/courses", label: "课程广场" },
  ];
  if (canStudio) {
    links.push({ href: studioHref, label: studioLabel });
  }
  if (canCreate) {
    links.push({ href: "/studio/courses/compose", label: "开课 / 上架资料" });
  }
  if (role === "TEACHER") {
    links.push({ href: "/studio/media", label: "素材管理" });
  }
  if (isAdmin(role)) {
    links.push({ href: "/studio/users", label: "用户审核" });
  }

  return (
    <nav className="flex flex-wrap gap-2" aria-label="个人中心快捷入口">
      {links.map((link) => (
        <Link
          key={link.href + link.label}
          href={link.href}
          className="btn btn-secondary min-h-11 px-4"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

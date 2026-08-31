import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import {
  canReferForCommission,
  ROLE_LABEL,
  roleLabel,
  type Role,
} from "@andyyyds/shared/roles";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";
import { formatPrice } from "@andyyyds/shared/utils";

export const dynamic = "force-dynamic";

export default async function LearnHomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [enrollmentsRaw, user, earnings] = await Promise.all([
    prisma.enrollment.findMany({
      where: {
        userId: session.id,
        // 约搭/商城不是网课：学习页只列单课/专栏/资料，活动看约搭报名
        course: { productType: { in: ["COURSE", "COLUMN", "MATERIAL"] } },
      },
      include: {
        course: { include: { teacher: true, category: true } },
        progress: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: session.id },
      select: {
        referralCode: true,
        roleApplicationNote: true,
        roleApplicationStatus: true,
      },
    }),
    prisma.commission.aggregate({
      where: { beneficiaryId: session.id },
      _sum: { amount: true },
    }),
  ]);
  const enrollments = await Promise.all(
    enrollmentsRaw.map(async (item) => ({
      ...item,
      course: {
        ...item.course,
        coverUrl: await resolveStoredAccessUrl(item.course.coverUrl),
      },
    })),
  );

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.yydsxwh.com";
  const inviteCode = user?.referralCode || "";
  const inviteUrl = inviteCode
    ? `${siteUrl.replace(/\/$/, "")}/register?ref=${inviteCode}`
    : "";
  const showRefer = canReferForCommission(session.role);
  const requestedLabel = session.requestedRole
    ? ROLE_LABEL[session.requestedRole as Role] || session.requestedRole
    : "";

  return (
    <div className="container py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">我的学习</h1>
          <p className="mt-2 text-[var(--muted)]">
            继续上次的进度，或打开已购课程
          </p>
        </div>
        <Link href="/account" className="btn btn-secondary min-h-10 px-4 text-sm">
          返回个人中心
        </Link>
      </div>

      {session.rolePending ? (
        <div className="surface mt-6 rounded-[28px] border border-amber-200 bg-amber-50/80 p-5">
          <h2 className="text-lg font-semibold text-amber-950">账号待站长审核</h2>
          <p className="mt-1 text-sm text-amber-900/80">
            你已申请成为{requestedLabel || "特殊角色"}，当前状态「待审核」。
            审核通过前可正常学习与消费，暂不可使用对应后台权限。
          </p>
        </div>
      ) : null}

      {user?.roleApplicationStatus === "REJECTED" ? (
        <div className="surface mt-6 rounded-[28px] border border-[var(--line)] p-5">
          <h2 className="text-lg font-semibold">角色申请未通过</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {user.roleApplicationNote ||
              "站长未通过你的角色申请，账号已按普通用户开通，可继续学习与消费。"}
          </p>
        </div>
      ) : null}

      {showRefer && inviteCode ? (
        <div className="surface mt-6 rounded-[28px] p-5">
          <h2 className="text-lg font-semibold">我的推荐分销</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            当前身份：{roleLabel(session.role)}。好友通过你的邀请码注册并购买后，可按站长设定的比例获得提成。
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs text-[var(--muted)]">邀请码</div>
              <div className="mt-1 text-xl font-semibold text-[var(--brand)]">
                {inviteCode}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--muted)]">累计提成</div>
              <div className="mt-1 text-xl font-semibold">
                {formatPrice(earnings._sum.amount || 0)}
              </div>
            </div>
          </div>
          <p className="mt-3 break-all text-sm text-[var(--muted)]">{inviteUrl}</p>
        </div>
      ) : null}

      <div className="mt-8 grid gap-5">
        {enrollments.map((item) => {
          const done = item.progress.filter((p) => p.completed).length;
          return (
            <Link
              key={item.id}
              href={`/learn/${item.course.slug}`}
              className="surface flex flex-col gap-4 rounded-[28px] p-5 sm:flex-row sm:items-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.course.coverUrl}
                alt={item.course.title}
                className="h-28 w-full rounded-2xl object-cover sm:h-24 sm:w-40"
              />
              <div className="flex-1">
                <h2 className="text-lg font-semibold">{item.course.title}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {item.course.teacher.name} ·{" "}
                  {item.course.productType === "MATERIAL"
                    ? `已查看 ${done} 个文件`
                    : `已完成 ${done} 课节`}
                </p>
              </div>
              <span className="btn btn-primary">
                {item.course.productType === "MATERIAL"
                  ? "查看资料"
                  : "继续学习"}
              </span>
            </Link>
          );
        })}
      </div>

      {enrollments.length === 0 ? (
        <div className="surface mt-8 rounded-[28px] p-10 text-center">
          <p className="text-[var(--muted)]">还没有课程，去广场挑一门吧</p>
          <Link href="/courses" className="btn btn-primary mt-4 inline-flex">
            去课程广场
          </Link>
        </div>
      ) : null}
    </div>
  );
}

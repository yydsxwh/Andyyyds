import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateCourseForm } from "@/components/create-course-form";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "TEACHER" && session.role !== "ADMIN") {
    return (
      <div className="container py-16">
        <div className="surface mx-auto max-w-lg rounded-[28px] p-8 text-center">
          <h1 className="text-2xl font-semibold">创作者中心</h1>
          <p className="mt-3 text-[var(--muted)]">
            当前账号是学员。请使用讲师账号登录：teacher@yyds.local / 123456
          </p>
          <Link href="/login" className="btn btn-primary mt-6 inline-flex">
            切换登录
          </Link>
        </div>
      </div>
    );
  }

  const teacherId = session.role === "ADMIN" ? undefined : session.id;
  const courses = await prisma.course.findMany({
    where: teacherId ? { teacherId } : undefined,
    include: { _count: { select: { enrollments: true, orders: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      ...(teacherId ? { course: { teacherId } } : {}),
    },
    include: { course: true, user: true },
    orderBy: { paidAt: "desc" },
    take: 12,
  });

  const revenue = orders.reduce((sum, o) => sum + o.amount, 0);
  const user = await prisma.user.findUnique({ where: { id: session.id } });

  return (
    <div className="container space-y-8 py-12">
      <StudioNav current="overview" />
      <div>
        <h1 className="text-3xl font-semibold">创作者中心</h1>
        <p className="mt-2 text-[var(--muted)]">
          管理课程、素材与订单。你的邀请码：
          <span className="ml-2 font-semibold text-[var(--brand)]">{user?.referralCode}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface rounded-[24px] p-5">
          <div className="text-sm text-[var(--muted)]">课程/专栏</div>
          <div className="mt-2 text-3xl font-semibold">{courses.length}</div>
        </div>
        <div className="surface rounded-[24px] p-5">
          <div className="text-sm text-[var(--muted)]">已支付订单</div>
          <div className="mt-2 text-3xl font-semibold">{orders.length}</div>
        </div>
        <div className="surface rounded-[24px] p-5">
          <div className="text-sm text-[var(--muted)]">演示营收</div>
          <div className="mt-2 text-3xl font-semibold">{formatPrice(revenue)}</div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/studio/media" className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5">
          <div className="text-lg font-semibold">素材中心</div>
          <p className="mt-2 text-sm text-[var(--muted)]">上传视频、自由分类与长命名，多选后可组课售卖</p>
        </Link>
        <Link href="/studio/courses" className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5">
          <div className="text-lg font-semibold">课程中心</div>
          <p className="mt-2 text-sm text-[var(--muted)]">管理课程/专栏，或用素材一键生成可售产品</p>
        </Link>
        <Link href="/studio/distribution" className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5">
          <div className="text-lg font-semibold">分销管理</div>
          <p className="mt-2 text-sm text-[var(--muted)]">设置一/二/三级分销比例，查看佣金与邀请链接</p>
        </Link>
        {session.role === "ADMIN" ? (
          <>
            <Link
              href="/studio/merchants"
              className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
            >
              <div className="text-lg font-semibold">商家管理</div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                审核入驻/加盟商家，启用或停用卖课权限，维护联系资料
              </p>
            </Link>
            <Link
              href="/studio/decorate"
              className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
            >
              <div className="text-lg font-semibold">店铺装修</div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                配置 Logo、首页主视觉与 Banner 等视觉门面
              </p>
            </Link>
            <Link
              href="/studio/cms"
              className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
            >
              <div className="text-lg font-semibold">内容管理</div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                后台文案与下单信息采集字段配置
              </p>
            </Link>
            <Link
              href="/studio/settings"
              className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
            >
              <div className="text-lg font-semibold">系统设置</div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                配置微信/支付宝支付与本地或阿里云 OSS 存储
              </p>
            </Link>
          </>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <CreateCourseForm />
        <div className="surface rounded-[28px] p-6">
          <h2 className="text-lg font-semibold">我的课程 / 专栏</h2>
          <div className="mt-4 space-y-3">
            {courses.map((course) => (
              <div
                key={course.id}
                className="flex flex-col gap-2 rounded-2xl bg-white/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">
                    <span className="mr-2 rounded-full bg-[rgba(15,107,92,0.12)] px-2 py-0.5 text-xs text-[var(--brand)]">
                      {course.productType === "COLUMN" ? "专栏" : "课程"}
                    </span>
                    {course.title}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {course.status === "PUBLISHED" ? "已上架" : "草稿"} ·{" "}
                    {formatPrice(course.price)} · 报名 {course._count.enrollments}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <Link
                    href={`/studio/courses/${course.id}/edit`}
                    className="font-medium text-[var(--brand)]"
                  >
                    编辑
                  </Link>
                  <Link
                    href={`/courses/${course.slug}`}
                    className="text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    查看前台
                  </Link>
                </div>
              </div>
            ))}
            {courses.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">还没有课程，先创建一门吧</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="surface rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">最近订单</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="py-2 font-medium">订单号</th>
                <th className="py-2 font-medium">课程</th>
                <th className="py-2 font-medium">学员</th>
                <th className="py-2 font-medium">金额</th>
                <th className="py-2 font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-[var(--line)]">
                  <td className="py-3">{order.orderNo}</td>
                  <td className="py-3">{order.course.title}</td>
                  <td className="py-3">{order.user.name}</td>
                  <td className="py-3">{formatPrice(order.amount)}</td>
                  <td className="py-3">
                    {order.paidAt ? order.paidAt.toLocaleString("zh-CN") : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">暂无已支付订单</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

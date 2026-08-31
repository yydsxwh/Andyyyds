import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateCourseForm } from "@andyyyds/courses/components/create-course-form";
import { StudioNav } from "@/components/studio-nav";
import { StudioProductDeleteButton } from "@andyyyds/courses/components/studio-product-delete-button";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import {
  courseStudioProductTypeWhere,
  productDetailPath,
  productTypeLabel,
} from "@andyyyds/shared/product-types";
import {
  canAccessStudio,
  canCreateSellableProducts,
  canDeleteCourses,
  canManageCourses,
  canViewAllStudioData,
  hasRole,
  isAdmin,
  roleLabel,
  roleLabels,
} from "@andyyyds/shared/roles";
import { formatPrice } from "@andyyyds/shared/utils";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canAccessStudio(session)) {
    return (
      <div className="container py-16">
        <div className="surface mx-auto max-w-lg rounded-[28px] p-8 text-center">
          <h1 className="text-2xl font-semibold">创作者中心</h1>
          <p className="mt-3 text-[var(--muted)]">
            {session.rolePending
              ? `账号待站长审核。你已申请「${roleLabel(session.requestedRole || session.role)}」，通过前暂不可使用后台权限，可先去学习与消费。`
              : `当前账号是${roleLabels(session)}，暂无后台权限。可在个人中心申请加盟代理、商家入驻或成为老师。`}
          </p>
          <Link href="/account" className="btn btn-primary mt-6 inline-flex">
            去个人中心
          </Link>
        </div>
      </div>
    );
  }

  const isAgent = hasRole(session, "AGENT");
  const canCreate = canCreateSellableProducts(session);
  const canDelete = canDeleteCourses(session);
  const teacherId = canViewAllStudioData(session) ? undefined : session.id;
  // 约搭壳/商城商品不是课程：总览「我的课程」必须与 /studio/courses 同样排除，否则会出现「编辑章节」误入口
  const courses = canManageCourses(session)
    ? await prisma.course.findMany({
        where: {
          ...(teacherId ? { teacherId } : {}),
          ...courseStudioProductTypeWhere("all"),
        },
        include: { _count: { select: { enrollments: true, orders: true } } },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const orders = canManageCourses(session)
    ? await prisma.order.findMany({
        where: {
          status: "PAID",
          ...(teacherId ? { course: { teacherId } } : {}),
        },
        include: { course: true, user: true },
        orderBy: { paidAt: "desc" },
        take: 12,
      })
    : [];

  const revenue = orders.reduce((sum, o) => sum + o.amount, 0);
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  const teamCount = isAgent
    ? await prisma.user.count({ where: { referredById: session.id } })
    : 0;
  const myEarnings = isAgent
    ? (
        await prisma.commission.aggregate({
          where: { beneficiaryId: session.id },
          _sum: { amount: true },
        })
      )._sum.amount || 0
    : 0;
  const recruitedMerchants = isAgent
    ? await prisma.merchant.findMany({
        where: { agentId: session.id },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="container space-y-8 py-12">
      <StudioNav current="overview" />
      <div>
        <h1 className="text-3xl font-semibold">
          {isAgent ? "代理中心" : "创作者中心"}
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          {isAgent
            ? "管理邀请、佣金与自己的课程售卖。你的邀请码："
            : "管理课程、素材与订单。你的邀请码："}
          <span className="ml-2 font-semibold text-[var(--brand)]">
            {user?.referralCode}
          </span>
          <span className="ml-3 text-sm">（{roleLabels(session)}）</span>
        </p>
      </div>

      {isAgent ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="surface rounded-[24px] p-5">
              <div className="text-sm text-[var(--muted)]">直推人数</div>
              <div className="mt-2 text-3xl font-semibold">{teamCount}</div>
            </div>
            <div className="surface rounded-[24px] p-5">
              <div className="text-sm text-[var(--muted)]">累计佣金</div>
              <div className="mt-2 text-3xl font-semibold">
                {formatPrice(myEarnings)}
              </div>
            </div>
            <div className="surface rounded-[24px] p-5">
              <div className="text-sm text-[var(--muted)]">归属入驻商家</div>
              <div className="mt-2 text-3xl font-semibold">
                {recruitedMerchants.length}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              href="/studio/media"
              className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
            >
              <div className="text-lg font-semibold">素材中心</div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                上传视频/文档，多选后可组课或组资料售卖
              </p>
            </Link>
            <Link
              href="/studio/courses"
              className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
            >
              <div className="text-lg font-semibold">课程与资料</div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                创建单课/专栏/资料并出售，管理自己的可售产品
              </p>
            </Link>
            <Link
              href="/studio/courses/compose?type=MATERIAL"
              className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
            >
              <div className="text-lg font-semibold">创建资料</div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                用素材打包成资料包，上架后出现在资料广场
              </p>
            </Link>
            <Link
              href="/studio/distribution"
              className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
            >
              <div className="text-lg font-semibold">分销管理</div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                查看邀请链接与佣金明细
              </p>
            </Link>
          </div>

          <div className="surface rounded-[28px] p-6">
            <h2 className="text-lg font-semibold">我发展的入驻商家</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              由站长绑定归属到你的商家（Merchant.agentId），其课程平台抽成再分计入你的佣金。
            </p>
            <div className="mt-4 space-y-3">
              {recruitedMerchants.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col gap-1 rounded-2xl bg-white/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">{m.storeName}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {m.user.name} · {m.user.email} · {m.status}
                    </div>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {new Date(m.createdAt).toLocaleDateString("zh-CN")}
                  </div>
                </div>
              ))}
              {recruitedMerchants.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  暂无归属商家。站长可在「商家管理」中为你绑定入驻商家。
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            {canCreate ? <CreateCourseForm /> : null}
            <div className="surface rounded-[28px] p-6">
              <h2 className="text-lg font-semibold">我的课程 / 专栏 / 资料</h2>
              <div className="mt-4 space-y-3">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex flex-col gap-2 rounded-2xl bg-white/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium">
                        <span className="mr-2 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs text-[var(--brand)]">
                          {productTypeLabel(course.productType)}
                        </span>
                        {course.title}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {course.status === "PUBLISHED" ? "已上架" : "草稿"} ·{" "}
                        {formatPrice(course.price)} · 报名{" "}
                        {course._count.enrollments}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <Link
                        href={`/learn/${course.slug}`}
                        className="font-medium text-[var(--brand)]"
                      >
                        预览网课
                      </Link>
                      <Link
                        href={`/studio/courses/${course.id}/edit`}
                        className="font-medium text-[var(--brand)]"
                      >
                        编辑课程
                      </Link>
                      <Link
                        href={`/studio/courses/${course.id}/content`}
                        className="font-medium text-[var(--brand)]"
                      >
                        编辑章节
                      </Link>
                      {course.productType === "COURSE" ||
                      course.productType === "COLUMN" ? (
                        <Link
                          href={`/studio/courses/${course.id}/progress`}
                          className="font-medium text-[var(--brand)]"
                        >
                          学习进度
                        </Link>
                      ) : null}
                      <Link
                        href={productDetailPath(course.slug, course.productType)}
                        className="text-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        查看前台
                      </Link>
                      {canDelete ? (
                        <StudioProductDeleteButton
                          productId={course.id}
                          title={course.title}
                          productType={course.productType}
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
                {courses.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    还没有产品，可在「课程与资料」创建单课/专栏/资料
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="surface rounded-[24px] p-5">
              <div className="text-sm text-[var(--muted)]">课程/专栏/资料</div>
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
            <Link
              href="/studio/media"
              className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
            >
              <div className="text-lg font-semibold">素材中心</div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                上传视频、自由分类与长命名，多选后可组课售卖
              </p>
            </Link>
            <Link
              href="/studio/courses"
              className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
            >
              <div className="text-lg font-semibold">课程与资料</div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {canCreate
                  ? "管理单课/专栏/资料，或用素材一键生成可售产品"
                  : "维护已分配课程与资料的素材与内容"}
              </p>
            </Link>
            {canCreate ? (
              <Link
                href="/studio/courses/compose?type=MATERIAL"
                className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
              >
                <div className="text-lg font-semibold">创建资料</div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  用素材打包成资料包，上架后出现在资料广场
                </p>
              </Link>
            ) : null}
            <Link
              href="/studio/distribution"
              className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
            >
              <div className="text-lg font-semibold">分销管理</div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {isAdmin(session)
                  ? "设置一/二/三级分销比例，查看佣金与邀请链接"
                  : "查看佣金与邀请链接"}
              </p>
            </Link>
            {isAdmin(session) ? (
              <Link
                href="/studio/admin"
                className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
              >
                <div className="text-lg font-semibold">站长管理</div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  用户、商家、店铺装修、内容管理与系统设置（与创作者中心分离）
                </p>
              </Link>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            {canCreate ? <CreateCourseForm /> : null}
            <div className="surface rounded-[28px] p-6">
              <h2 className="text-lg font-semibold">我的课程 / 专栏 / 资料</h2>
              <div className="mt-4 space-y-3">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex flex-col gap-2 rounded-2xl bg-white/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium">
                        <span className="mr-2 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs text-[var(--brand)]">
                          {productTypeLabel(course.productType)}
                        </span>
                        {course.title}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {course.status === "PUBLISHED" ? "已上架" : "草稿"} ·{" "}
                        {formatPrice(course.price)} · 报名{" "}
                        {course._count.enrollments}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <Link
                        href={`/learn/${course.slug}`}
                        className="font-medium text-[var(--brand)]"
                      >
                        预览网课
                      </Link>
                      <Link
                        href={`/studio/courses/${course.id}/edit`}
                        className="font-medium text-[var(--brand)]"
                      >
                        编辑课程
                      </Link>
                      <Link
                        href={`/studio/courses/${course.id}/content`}
                        className="font-medium text-[var(--brand)]"
                      >
                        编辑章节
                      </Link>
                      {course.productType === "COURSE" ||
                      course.productType === "COLUMN" ? (
                        <Link
                          href={`/studio/courses/${course.id}/progress`}
                          className="font-medium text-[var(--brand)]"
                        >
                          学习进度
                        </Link>
                      ) : null}
                      <Link
                        href={productDetailPath(course.slug, course.productType)}
                        className="text-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        查看前台
                      </Link>
                      {canDelete ? (
                        <StudioProductDeleteButton
                          productId={course.id}
                          title={course.title}
                          productType={course.productType}
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
                {courses.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    {canCreate
                      ? "还没有课程，先创建一门吧"
                      : "暂无已分配课程。老师不可新建可售产品。"}
                  </p>
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
        </>
      )}
    </div>
  );
}

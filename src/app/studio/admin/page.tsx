import Link from "next/link";
import { redirect } from "next/navigation";
import { StudioNav } from "@/components/studio-nav";
import { shanghaiDayBounds } from "@/lib/admin-dashboard";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { getStudioNavConfig } from "@/lib/site-settings";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** 站长管理模块说明（不含概览自身） */
const ADMIN_HUB_BLURBS: Record<string, string> = {
  users: "查看注册用户、审核角色申请，调整学员 / 老师 / 商家 / 代理。",
  merchants: "审核入驻/加盟商家，绑定加盟代理归属，维护联系资料。",
  products: "管理全站单课/专栏/资料：展示次序、置顶、精华与上下架。",
  shop: "管理商城商品：规格、多图、上下架。",
  meetup: "管理全站约搭活动：创建、编辑、取消与删除。",
  decorate: "网站装扮（主题/配色/门面）与页面模板 DIY，同属装修。",
  cms: "后台文案、门户导航与下单信息采集字段配置。",
  "wechat-mp": "同步公众号已发表图文与主页合集，展示在公司介绍页。",
  settings: "配置站点地址、支付、短信与本地或阿里云存储。",
};

/** 快捷入口：站长高频操作，一屏直达 */
const QUICK_LINKS: { href: string; label: string; hint: string }[] = [
  {
    href: "/studio/users",
    label: "用户 / 角色审核",
    hint: "处理待审申请",
  },
  {
    href: "/studio/merchants",
    label: "商家管理",
    hint: "入驻与代理归属",
  },
  {
    href: "/studio/orders",
    label: "订单查看",
    hint: "全站已付订单",
  },
  {
    href: "/studio/products",
    label: "产品管理",
    hint: "次序 / 置顶 / 精华",
  },
  {
    href: "/studio/meetup",
    label: "约搭管理",
    hint: "活动增删改",
  },
  {
    href: "/studio/courses/compose",
    label: "创建课程/资料",
    hint: "组课并上架",
  },
  {
    href: "/studio/media",
    label: "素材中心",
    hint: "上传音视频文档",
  },
  {
    href: "/studio/distribution",
    label: "分销管理",
    hint: "分成与邀请码",
  },
  {
    href: "/studio/marketing/coupons",
    label: "优惠券",
    hint: "营销减免",
  },
  {
    href: "/studio/decorate",
    label: "装修",
    hint: "装扮与页面模板",
  },
  {
    href: "/studio/cms",
    label: "内容管理",
    hint: "导航与文案",
  },
  {
    href: "/studio/wechat-mp",
    label: "公众号宣传",
    hint: "图文与合集同步",
  },
  {
    href: "/studio/settings",
    label: "系统设置",
    hint: "支付与存储",
  },
  {
    href: "/studio",
    label: "创作者中心",
    hint: "课程与素材运营",
  },
  {
    href: "/courses",
    label: "前台课程广场",
    hint: "查看学员端",
  },
];

/**
 * 站长工作台：数据概览 + 快捷入口 + 管理模块。
 * 顶栏「站长管理」落到此处；子页仍挂站长 Tab。
 */
export default async function StudioAdminHubPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.role)) redirect("/studio");

  const today = shanghaiDayBounds(0);
  const yesterday = shanghaiDayBounds(1);

  const [
    nav,
    userTotal,
    usersToday,
    salesToday,
    salesYesterday,
    ordersToday,
    ordersYesterday,
    commissionToday,
    commissionYesterday,
    platformCutTotal,
    pendingRoles,
    pendingMerchants,
    publishedCourses,
    publishedMaterials,
  ] = await Promise.all([
    getStudioNavConfig(),
    prisma.user.count(),
    prisma.user.count({
      where: { createdAt: { gte: today.start, lt: today.end } },
    }),
    prisma.order.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: today.start, lt: today.end },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: yesterday.start, lt: yesterday.end },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.order.count({
      where: {
        status: "PAID",
        paidAt: { gte: today.start, lt: today.end },
      },
    }),
    prisma.order.count({
      where: {
        status: "PAID",
        paidAt: { gte: yesterday.start, lt: yesterday.end },
      },
    }),
    prisma.commission.aggregate({
      where: { createdAt: { gte: today.start, lt: today.end } },
      _sum: { amount: true },
    }),
    prisma.commission.aggregate({
      where: { createdAt: { gte: yesterday.start, lt: yesterday.end } },
      _sum: { amount: true },
    }),
    prisma.order.aggregate({
      where: { status: "PAID" },
      _sum: { platformCutAmount: true, amount: true },
    }),
    prisma.user.count({ where: { roleApplicationStatus: "PENDING" } }),
    prisma.merchant.count({ where: { status: "PENDING" } }),
    // 上架课程统计不含约搭壳/商城：那些有独立运营入口，勿把活动算进「课程数」
    prisma.course.count({
      where: {
        status: "PUBLISHED",
        productType: { in: ["COURSE", "COLUMN"] },
      },
    }),
    prisma.course.count({
      where: { status: "PUBLISHED", productType: "MATERIAL" },
    }),
  ]);

  const cards = nav.topAdmin.filter((item) => item.key !== "admin");

  return (
    <div className="container space-y-8 py-10 sm:py-12">
      <StudioNav current="admin" area="admin" />

      <div>
        <h1 className="text-3xl font-semibold">站长工作台</h1>
        <p className="mt-2 text-[var(--muted)]">
          全站数据概览与常用入口。统计按北京时间自然日；创作者侧功能请到「创作者中心」。
        </p>
      </div>

      {/* —— 运营数据 —— */}
      <section aria-label="运营数据">
        <h2 className="mb-3 text-lg font-semibold">运营数据</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="今日新增用户"
            value={String(usersToday)}
            sub={`用户总数 ${userTotal}`}
            tone="brand"
          />
          <StatCard
            label="今日销售额"
            value={formatPrice(salesToday._sum.amount || 0)}
            sub={`昨日 ${formatPrice(salesYesterday._sum.amount || 0)}`}
            tone="fire"
          />
          <StatCard
            label="今日已付订单"
            value={String(ordersToday)}
            sub={`昨日 ${ordersYesterday} 笔`}
            tone="brand"
          />
          <StatCard
            label="今日分销佣金"
            value={formatPrice(commissionToday._sum.amount || 0)}
            sub={`昨日 ${formatPrice(commissionYesterday._sum.amount || 0)}`}
            tone="fire"
          />
          <StatCard
            label="待审核角色"
            value={String(pendingRoles)}
            sub="代理 / 商家 / 老师申请"
            href="/studio/users"
          />
          <StatCard
            label="待审商家"
            value={String(pendingMerchants)}
            sub="入驻待处理"
            href="/studio/merchants"
          />
          <StatCard
            label="已上架课程"
            value={String(publishedCourses)}
            sub={`资料 ${publishedMaterials} 份`}
            href="/studio/courses"
          />
          <StatCard
            label="累计成交 / 平台抽成"
            value={formatPrice(platformCutTotal._sum.amount || 0)}
            sub={`抽成 ${formatPrice(platformCutTotal._sum.platformCutAmount || 0)}`}
            href="/studio/orders"
          />
        </div>
      </section>

      {/* —— 快捷入口 —— */}
      <section aria-label="快捷入口">
        <h2 className="mb-3 text-lg font-semibold">快捷入口</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {QUICK_LINKS.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className="surface flex min-h-[5.5rem] flex-col justify-center rounded-[22px] px-4 py-3 transition hover:-translate-y-0.5 hover:border-[var(--brand)]/35"
            >
              <span className="font-semibold text-[var(--ink)]">{item.label}</span>
              <span className="mt-1 text-xs text-[var(--muted)]">{item.hint}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* —— 管理模块 —— */}
      <section aria-label="管理模块">
        <h2 className="mb-3 text-lg font-semibold">管理模块</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="surface rounded-[24px] p-5 transition hover:-translate-y-0.5"
            >
              <div className="text-lg font-semibold">{item.label}</div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {ADMIN_HUB_BLURBS[item.key] || "进入管理"}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "brand" | "fire";
  href?: string;
}) {
  const accent =
    tone === "fire"
      ? "border-[var(--fire)]/25 bg-[var(--fire)]/[0.04]"
      : tone === "brand"
        ? "border-[var(--brand)]/25 bg-[var(--brand)]/[0.04]"
        : "";
  const body = (
    <>
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-[var(--muted)]">{sub}</div>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className={`surface block rounded-[22px] px-4 py-3.5 transition hover:-translate-y-0.5 ${accent}`}
      >
        {body}
      </Link>
    );
  }
  return (
    <div className={`surface rounded-[22px] px-4 py-3.5 ${accent}`}>{body}</div>
  );
}

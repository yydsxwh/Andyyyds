import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const courses = await prisma.course.findMany({
    where: { status: "PUBLISHED" },
    include: { teacher: true, category: true },
    orderBy: { studentCount: "desc" },
    take: 6,
  });

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="container grid min-h-[78vh] items-center gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="fade-up space-y-6">
            <p className="brand-mark text-5xl text-[var(--brand)] sm:text-6xl md:text-7xl">
              YYDS
            </p>
            <h1 className="max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">
              把你的经验，做成一门真正能卖出去的课
            </h1>
            <p className="max-w-lg text-base leading-7 text-[var(--muted)]">
              课程上架、支付购买、在线学习、创作者后台、优惠券与邀请分销，一站备齐。
              先跑通卖课闭环，再按你的业务升级改造。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/courses" className="btn btn-primary">
                逛课程广场
              </Link>
              <Link href="/studio" className="btn btn-secondary">
                进入创作者中心
              </Link>
            </div>
          </div>
          <div className="fade-up-delay relative">
            <div className="float-soft surface overflow-hidden rounded-[36px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1400&q=80"
                alt="学员在线学习"
                className="aspect-[4/5] w-full object-cover sm:aspect-[5/4] lg:aspect-[4/5]"
              />
            </div>
            <div className="absolute -bottom-4 left-4 right-4 rounded-2xl border border-[var(--line)] bg-[rgba(255,252,246,0.92)] px-4 py-3 text-sm shadow-[var(--shadow)] sm:left-auto sm:right-6 sm:w-64">
              已上线课程交易、微信支付与学习进度
            </div>
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="container">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">热门课程</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">先学一门，感受完整购买到学习的路径</p>
            </div>
            <Link href="/courses" className="text-sm text-[var(--brand)]">
              查看全部
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

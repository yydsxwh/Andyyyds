import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import { DEFAULT_LOGO_URL, resolveHeroImage } from "@/lib/decorate";
import { prisma } from "@/lib/db";
import { getDecorateConfig, getPortalConfig } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [courses, decorate, portal] = await Promise.all([
    prisma.course.findMany({
      where: { status: "PUBLISHED" },
      include: { teacher: true, category: true },
      orderBy: { studentCount: "desc" },
      take: 6,
    }),
    getDecorateConfig(),
    getPortalConfig(),
  ]);

  const modules = portal.nav.filter(
    (item) => item.enabled !== false && item.key !== "home",
  );

  const logoUrl = decorate.logoUrl || DEFAULT_LOGO_URL;
  const heroImage = resolveHeroImage(decorate);
  const heroAlt = decorate.banners[0]?.alt || "品牌主视觉";

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="container grid min-h-[78vh] items-center gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="fade-up space-y-6">
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={decorate.brandName || "歪歪艾斯"}
                className="h-20 w-auto max-w-[min(100%,420px)] object-contain sm:h-24 md:h-28"
              />
              {decorate.showBrandText ? (
                <p className="brand-mark text-3xl text-[var(--ink)] sm:text-4xl">
                  {decorate.brandName}
                </p>
              ) : null}
            </div>
            <h1 className="max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">
              {decorate.heroHeadline}
            </h1>
            <p className="max-w-lg text-base leading-7 text-[var(--muted)]">
              {decorate.heroSubtext}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/courses" className="btn btn-primary">
                进入知识付费
              </Link>
              <Link href="/about/company" className="btn btn-secondary">
                了解公司
              </Link>
            </div>
          </div>
          <div className="fade-up-delay relative">
            <div className="float-soft surface overflow-hidden rounded-[36px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt={heroAlt}
                className="aspect-[4/5] w-full object-cover sm:aspect-[5/4] lg:aspect-[4/5]"
              />
            </div>
          </div>
        </div>
      </section>

      {decorate.banners.length > 1 ? (
        <section className="pb-8">
          <div className="container">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {decorate.banners.slice(1).map((banner) => (
                <div
                  key={banner.id}
                  className="surface overflow-hidden rounded-[28px]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={banner.url}
                    alt={banner.alt || decorate.brandName}
                    className="aspect-[16/10] w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="pb-14">
        <div className="container">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">门户入口</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              多功能站点正在扩展：介绍、知识付费已可用，商城 / 论坛 / 游戏陆续开放
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="surface group rounded-[28px] p-5 transition hover:-translate-y-0.5"
              >
                <div className="text-lg font-semibold group-hover:text-[var(--brand)]">
                  {item.label}
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {item.comingSoon ? "即将开放，先了解规划" : "点击进入"}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="container">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">热门课程</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                先学一门，感受完整购买到学习的路径
              </p>
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

import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import { DEFAULT_LOGO_URL, resolveHeroImage } from "@/lib/decorate";
import { prisma } from "@/lib/db";
import { getDecorateConfig } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [courses, decorate] = await Promise.all([
    prisma.course.findMany({
      where: { status: "PUBLISHED" },
      include: { teacher: true, category: true },
      orderBy: { studentCount: "desc" },
      take: 6,
    }),
    getDecorateConfig(),
  ]);

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

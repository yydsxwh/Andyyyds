import { CourseCard } from "@/components/course-card";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { PlazaSwitcher } from "@/components/plaza-switcher";
import { prisma } from "@/lib/db";
import { PRODUCT_PLAZA_ORDER_BY } from "@/lib/product-display-order";
import { typoRoleClass, typoRoleStyle } from "@/lib/site-typography";
import { withSignedCoverUrls } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim();
  const category = params.category?.trim();

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  // 课程广场只展示单课/专栏；资料走同页家族的 /materials Tab
  const courses = await withSignedCoverUrls(
    await prisma.course.findMany({
      where: {
        status: "PUBLISHED",
        productType: { in: ["COURSE", "COLUMN"] },
        ...(category ? { category: { slug: category } } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { subtitle: { contains: q } },
                { description: { contains: q } },
              ],
            }
          : {}),
      },
      include: { teacher: true, category: true },
      // 站长产品管理：置顶优先，再 sortOrder，再人气/时间
      orderBy: PRODUCT_PLAZA_ORDER_BY,
    }),
  );

  return (
    <NavPageTemplateShell type="courses">
    <div className="container py-12">
      <PlazaSwitcher
        active="courses"
        subtitle="按分类浏览，或搜索你想学的主题"
      />

      <form className="mb-6 flex flex-col gap-3 sm:flex-row" action="/courses">
        <input
          className="field min-h-11"
          name="q"
          defaultValue={q}
          placeholder="搜索课程，例如：AI、沟通、变现"
        />
        <button className="btn btn-primary min-h-11" type="submit">
          搜索
        </button>
      </form>

      {/* 与约搭等共用「筛选标签」角色，后台一处调节多广场胶囊 */}
      <div className="mb-8 flex flex-wrap gap-2">
        <a
          href="/courses"
          className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 touch-manipulation ${typoRoleClass("filterTag")} ${!category ? "bg-[var(--brand)] text-white" : "border border-[var(--line)] bg-white/70"}`}
          style={typoRoleStyle("filterTag")}
        >
          全部
        </a>
        {categories.map((c) => (
          <a
            key={c.id}
            href={`/courses?category=${c.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 touch-manipulation ${typoRoleClass("filterTag")} ${category === c.slug ? "bg-[var(--brand)] text-white" : "border border-[var(--line)] bg-white/70"}`}
            style={typoRoleStyle("filterTag")}
          >
            {c.name}
          </a>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
      {courses.length === 0 ? (
        <p className="py-16 text-center text-[var(--muted)]">没有找到相关课程</p>
      ) : null}
    </div>
    </NavPageTemplateShell>
  );
}

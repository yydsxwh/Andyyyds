import { CourseCard } from "@/components/course-card";
import { prisma } from "@/lib/db";

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
  const courses = await prisma.course.findMany({
    where: {
      status: "PUBLISHED",
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
    orderBy: [{ studentCount: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="container py-12">
      <div className="mb-8 space-y-3">
        <h1 className="text-3xl font-semibold">课程广场</h1>
        <p className="text-[var(--muted)]">按分类浏览，或搜索你想学的主题</p>
      </div>

      <form className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          className="field"
          name="q"
          defaultValue={q}
          placeholder="搜索课程，例如：AI、沟通、变现"
        />
        <button className="btn btn-primary" type="submit">
          搜索
        </button>
      </form>

      <div className="mb-8 flex flex-wrap gap-2">
        <a
          href="/courses"
          className={`rounded-full px-4 py-2 text-sm ${!category ? "bg-[var(--brand)] text-white" : "bg-white/70 border border-[var(--line)]"}`}
        >
          全部
        </a>
        {categories.map((c) => (
          <a
            key={c.id}
            href={`/courses?category=${c.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full px-4 py-2 text-sm ${category === c.slug ? "bg-[var(--brand)] text-white" : "bg-white/70 border border-[var(--line)]"}`}
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
  );
}

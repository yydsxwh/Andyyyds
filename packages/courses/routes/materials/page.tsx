import { CourseCard } from "@andyyyds/courses/components/course-card";
import { PlazaSwitcher } from "@andyyyds/courses/components/plaza-switcher";
import { prisma } from "@andyyyds/shared/db";
import { PRODUCT_PLAZA_ORDER_BY } from "@andyyyds/shared/product-display-order";
import { getHideAllPricesFlag } from "@andyyyds/shared/site-settings";
import { typoRoleClass, typoRoleStyle } from "@andyyyds/shared/site-typography";
import { withSignedCoverUrls } from "@andyyyds/shared/storage";

export const dynamic = "force-dynamic";

/** 资料广场：仅展示 productType=MATERIAL；与课程广场共用同级 Tab 壳 */
export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim();
  const category = params.category?.trim();

  const [categories, materialsRaw, hideAllPrices] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.course.findMany({
      where: {
        status: "PUBLISHED",
        productType: "MATERIAL",
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
      orderBy: PRODUCT_PLAZA_ORDER_BY,
    }),
    getHideAllPricesFlag(),
  ]);
  const materials = await withSignedCoverUrls(materialsRaw);

  return (
    <div className="container py-12">
      <PlazaSwitcher
        active="materials"
        subtitle="按分类浏览，或搜索你需要的网课资料"
      />

      <form className="mb-6 flex flex-col gap-3 sm:flex-row" action="/materials">
        <input
          className="field min-h-11"
          name="q"
          defaultValue={q}
          placeholder="搜索资料，例如：真题、讲义、笔记"
        />
        <button className="btn btn-primary min-h-11" type="submit">
          搜索
        </button>
      </form>

      {/* 与课程/约搭等共用「筛选标签」角色 */}
      <div className="mb-8 flex flex-wrap gap-2">
        <a
          href="/materials"
          className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 touch-manipulation ${typoRoleClass("filterTag")} ${!category ? "bg-[var(--brand)] text-white" : "border border-[var(--line)] bg-white/70"}`}
          style={typoRoleStyle("filterTag")}
        >
          全部
        </a>
        {categories.map((c) => (
          <a
            key={c.id}
            href={`/materials?category=${c.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 touch-manipulation ${typoRoleClass("filterTag")} ${category === c.slug ? "bg-[var(--brand)] text-white" : "border border-[var(--line)] bg-white/70"}`}
            style={typoRoleStyle("filterTag")}
          >
            {c.name}
          </a>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {materials.map((item) => (
          <CourseCard
            key={item.id}
            course={item}
            hideAllPrices={hideAllPrices}
          />
        ))}
      </div>
      {materials.length === 0 ? (
        <p className="py-16 text-center text-[var(--muted)]">没有找到相关资料</p>
      ) : null}
    </div>
  );
}

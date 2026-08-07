import Link from "next/link";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { ShopBottomNav } from "@/components/shop-bottom-nav";
import { ShopProductCard } from "@/components/shop-product-card";
import { prisma } from "@/lib/db";
import {
  isShopSort,
  shopListOrderBy,
  SHOP_PRODUCT_TYPE,
  SHOP_SORT_LABEL,
  type ShopSort,
} from "@/lib/shop";
import { withSignedCoverUrls } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "商城",
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim();
  const category = params.category?.trim();
  const sort: ShopSort = isShopSort(params.sort) ? params.sort : "default";

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  const products = await withSignedCoverUrls(
    await prisma.course.findMany({
      where: {
        status: "PUBLISHED",
        productType: SHOP_PRODUCT_TYPE,
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
      include: { category: true },
      orderBy: shopListOrderBy(sort),
    }),
  );

  function hrefFor(next: { category?: string; sort?: string; q?: string }) {
    const sp = new URLSearchParams();
    const qq = next.q ?? q;
    const cat = next.category === "" ? "" : (next.category ?? category);
    const s = next.sort ?? sort;
    if (qq) sp.set("q", qq);
    if (cat) sp.set("category", cat);
    if (s && s !== "default") sp.set("sort", s);
    const qs = sp.toString();
    return qs ? `/shop?${qs}` : "/shop";
  }

  return (
    <NavPageTemplateShell type="shop">
      <div className="min-h-[70vh] bg-gradient-to-b from-[var(--bg-deep)]/80 to-transparent pb-24">
        <div className="container pt-4 sm:pt-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                商城
              </h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                精选好物 · 搜索 · 分类 · 一键加购
              </p>
            </div>
            <Link
              href="/cart"
              className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-[var(--card)] px-4 text-sm"
            >
              购物车
            </Link>
          </div>

          <form className="mb-4 flex gap-2" action="/shop">
            <input
              className="field min-h-11 flex-1 rounded-full"
              name="q"
              defaultValue={q}
              placeholder="搜索商城商品"
              enterKeyHint="search"
            />
            {category ? <input type="hidden" name="category" value={category} /> : null}
            {sort !== "default" ? (
              <input type="hidden" name="sort" value={sort} />
            ) : null}
            <button className="btn btn-primary min-h-11 shrink-0 rounded-full px-5" type="submit">
              搜索
            </button>
          </form>

          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            <Link
              href={hrefFor({ category: "" })}
              className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-3.5 text-sm ${
                !category
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--line)] bg-[var(--card)]"
              }`}
            >
              全部
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={hrefFor({ category: c.slug })}
                className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-3.5 text-sm ${
                  category === c.slug
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--line)] bg-[var(--card)]"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>

          <div className="mb-4 flex gap-1 border-b border-[var(--line)]">
            {(Object.keys(SHOP_SORT_LABEL) as ShopSort[]).map((key) => (
              <Link
                key={key}
                href={hrefFor({ sort: key })}
                className={`min-h-11 flex-1 text-center text-sm leading-[2.75rem] ${
                  sort === key
                    ? "border-b-2 border-[var(--fire)] font-semibold text-[var(--fire)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {SHOP_SORT_LABEL[key]}
              </Link>
            ))}
          </div>

          {products.length === 0 ? (
            <p className="py-20 text-center text-[var(--muted)]">
              暂无商品，站长可在工作室「商城商品」上架
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
              {products.map((product) => (
                <ShopProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
      <ShopBottomNav />
    </NavPageTemplateShell>
  );
}

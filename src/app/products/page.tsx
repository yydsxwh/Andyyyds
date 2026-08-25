import Link from "next/link";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import {
  SOFTWARE_PRODUCTS,
  SOFTWARE_PRODUCTS_PAGE,
  type SoftwareProduct,
} from "@/lib/software-products";

export const metadata = {
  title: "软件产品",
  description: "颗秒会议、颗秒网盘等自研软件产品",
};

function ProductCard({ product }: { product: SoftwareProduct }) {
  const inner = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {product.badge ? (
          <span className="rounded-full bg-[var(--brand)]/12 px-2.5 py-0.5 text-xs font-medium text-[var(--brand)]">
            {product.badge}
          </span>
        ) : null}
        <span className="text-xs text-[var(--muted)]">{product.tagline}</span>
      </div>
      <h2 className="mt-3 text-xl font-semibold text-[var(--ink)] sm:text-2xl">
        {product.name}
      </h2>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
        {product.description}
      </p>
      {product.href ? (
        <span className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-[var(--brand)]">
          了解更多 →
        </span>
      ) : (
        <p className="mt-4 text-xs text-[var(--muted)]">上线后可在此进入产品</p>
      )}
    </>
  );

  const className =
    "surface block rounded-[28px] p-5 transition hover:-translate-y-0.5 sm:p-6";

  if (product.href) {
    const external = /^https?:\/\//i.test(product.href);
    return (
      <Link
        href={product.href}
        className={className}
        {...(external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {inner}
      </Link>
    );
  }

  return <article className={className}>{inner}</article>;
}

export default function SoftwareProductsPage() {
  return (
    <NavPageTemplateShell type="products">
      <div className="container py-10 sm:py-12">
        <header className="mb-8 max-w-2xl">
          <h1 className="brand-mark text-3xl font-semibold sm:text-4xl">
            {SOFTWARE_PRODUCTS_PAGE.title}
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base">
            {SOFTWARE_PRODUCTS_PAGE.subtitle}
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
          {SOFTWARE_PRODUCTS.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-[var(--muted)]">
          更多颗秒系列产品将陆续加入本专栏。
        </p>
      </div>
    </NavPageTemplateShell>
  );
}

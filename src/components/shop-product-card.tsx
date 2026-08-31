import Link from "next/link";
import { shouldHideProductPrice } from "@andyyyds/shared/product-price-display";
import { formatPrice } from "@andyyyds/shared/utils";

type Props = {
  product: {
    id: string;
    title: string;
    slug: string;
    subtitle: string;
    coverUrl: string;
    price: number;
    originalPrice: number;
    studentCount: number;
    rating: number;
    isFree: boolean;
    hidePrice?: boolean;
    isPinned?: boolean;
    isFeatured?: boolean;
    category: { name: string } | null;
  };
  hideAllPrices?: boolean;
};

/** 淘宝式双列商品卡：图 + 标题 + 价 + 销量占位 */
export function ShopProductCard({ product, hideAllPrices = false }: Props) {
  const hidePrice = shouldHideProductPrice({
    hideAllPrices,
    hidePrice: product.hidePrice,
  });
  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)] transition active:scale-[0.99]"
    >
      <div className="relative aspect-square overflow-hidden bg-[var(--bg-deep)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.coverUrl}
          alt={product.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        {product.isPinned || product.isFeatured ? (
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {product.isPinned ? (
              <span className="rounded bg-[var(--fire)] px-1.5 py-0.5 text-[10px] font-medium text-white">
                置顶
              </span>
            ) : null}
            {product.isFeatured ? (
              <span className="rounded bg-[var(--brand)] px-1.5 py-0.5 text-[10px] font-medium text-white">
                精选
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-[var(--ink)]">
          {product.title}
        </h3>
        {product.subtitle ? (
          <p className="line-clamp-1 text-xs text-[var(--muted)]">
            {product.subtitle}
          </p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          {hidePrice ? (
            <div className="text-right text-[10px] text-[var(--muted)]">
              <div>{product.category?.name || "综合"}</div>
              <div>已售 {product.studentCount}</div>
            </div>
          ) : (
            <>
              <div>
                <div className="text-base font-semibold text-[var(--fire)]">
                  {product.isFree ? "免费" : formatPrice(product.price)}
                </div>
                {!product.isFree && product.originalPrice > product.price ? (
                  <div className="text-[10px] text-[var(--muted)] line-through">
                    {formatPrice(product.originalPrice)}
                  </div>
                ) : null}
              </div>
              <div className="text-right text-[10px] text-[var(--muted)]">
                <div>{product.category?.name || "综合"}</div>
                <div>已售 {product.studentCount}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

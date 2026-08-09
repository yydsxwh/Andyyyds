import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StartConsultChatButton } from "@/components/chat/start-consult-chat-button";
import { ShopBottomNav } from "@/components/shop-bottom-nav";
import { ShopGallery } from "@/components/shop-gallery";
import { ShopPurchaseBar } from "@/components/shop-purchase-bar";
import { getSession } from "@/lib/auth";
import { CHAT_SOURCE } from "@/lib/chat/constants";
import { prisma } from "@/lib/db";
import {
  parseSpecs,
  resolveShopImages,
  SHOP_PRODUCT_TYPE,
} from "@/lib/shop";
import { shouldHideProductPrice } from "@/lib/product-price-display";
import {
  getHideAllPricesFlag,
  getOrderFormConfig,
} from "@/lib/site-settings";
import { resolveStoredAccessUrl } from "@/lib/storage";
import { decodeRouteSlug, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ShopProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteSlug(rawSlug);

  const [product, hideAllPrices, session] = await Promise.all([
    prisma.course.findUnique({
      where: { slug },
      include: {
        category: true,
        teacher: { select: { id: true, name: true } },
      },
    }),
    getHideAllPricesFlag(),
    getSession(),
  ]);

  if (!product || product.status !== "PUBLISHED") notFound();

  // 非商城类型走各自详情，避免 URL 混用
  if (product.productType !== SHOP_PRODUCT_TYPE) {
    if (product.productType === "MATERIAL") {
      redirect(`/materials/${encodeURIComponent(slug)}`);
    }
    redirect(`/courses/${encodeURIComponent(slug)}`);
  }

  const hidePriceDisplay = shouldHideProductPrice({
    hideAllPrices,
    hidePrice: product.hidePrice,
  });
  const orderForm = await getOrderFormConfig();
  const specs = parseSpecs(product.specsJson);
  const rawImages = resolveShopImages(product.coverUrl, product.galleryJson);
  const images = await Promise.all(
    rawImages.map((url) => resolveStoredAccessUrl(url)),
  );

  return (
    <div className="pb-28">
      <div className="mx-auto max-w-lg">
        <ShopGallery images={images} title={product.title} />

        <div className="space-y-3 px-4 py-4">
          <div className="rounded-xl bg-[var(--card)] p-4 shadow-sm">
            {hidePriceDisplay ? null : (
              <div className="flex items-end gap-2">
                <span className="text-2xl font-semibold text-[var(--fire)]">
                  {product.isFree ? "免费" : formatPrice(product.price)}
                </span>
                {!product.isFree && product.originalPrice > product.price ? (
                  <span className="pb-0.5 text-sm text-[var(--muted)] line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                ) : null}
              </div>
            )}
            <h1 className="mt-2 text-lg font-semibold leading-snug">
              {product.title}
            </h1>
            {product.subtitle ? (
              <p className="mt-1 text-sm text-[var(--muted)]">{product.subtitle}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
              <span>已售 {product.studentCount}</span>
              <span>评价 ★ {product.rating.toFixed(1)}</span>
              <span>{product.category?.name || "综合"}</span>
              <span>{product.teacher.name}</span>
            </div>
          </div>

          {specs.options.length > 0 ? (
            <div className="rounded-xl bg-[var(--card)] p-4 text-sm shadow-sm">
              <div className="font-medium">可选规格</div>
              <p className="mt-1 text-[var(--muted)]">
                {specs.options.map((o) => o.name).join(" / ")}（购买时选择）
              </p>
            </div>
          ) : null}

          <div className="rounded-xl bg-[var(--card)] p-4 shadow-sm">
            <h2 className="font-medium">商品详情</h2>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]/90">
              {product.description || "暂无详情"}
            </div>
          </div>

          {session?.id !== product.teacherId ? (
            <StartConsultChatButton
              peerUserId={product.teacherId}
              source={CHAT_SOURCE.PRODUCT_CONSULT}
              relatedCourseId={product.id}
            >
              私聊咨询卖家
            </StartConsultChatButton>
          ) : null}

          <div className="flex gap-3 text-sm">
            <Link href="/shop" className="text-[var(--brand)]">
              ← 返回商城
            </Link>
            <Link href="/orders" className="text-[var(--muted)]">
              我的订单
            </Link>
          </div>
        </div>
      </div>

      <ShopPurchaseBar
        courseId={product.id}
        slug={product.slug}
        price={product.price}
        isFree={product.isFree || product.price <= 0}
        specs={specs}
        orderForm={orderForm}
        hidePriceDisplay={hidePriceDisplay}
      />
      <ShopBottomNav />
    </div>
  );
}

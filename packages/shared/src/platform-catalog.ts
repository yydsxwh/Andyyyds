/**
 * 产品目录兼容适配层。
 *
 * 唯一机器可读来源是 platform Catalog：有哪些产品、状态、正式页面地址、支持哪些端。
 * 本仓库只保留运营文案（描述、角标、卡片入口），按 productId 与目录合并。
 *
 * 渐进迁移：PLATFORM_CATALOG_ENABLED 未开启时，完全使用本地静态列表，
 * 行为与迁移前一致；platform 不可达时也自动回落，不让产品页整页挂掉。
 */

import type { CatalogProduct } from "@yydsxwh/shared/contracts/catalog";
import type { SoftwareProduct } from "@yydsxwh/shared/types/software-product";

import { getPlatformClient } from "./platform-storage";
import { SOFTWARE_PRODUCTS } from "./software-products";

export function platformCatalogEnabled(): boolean {
  if (process.env.PLATFORM_CATALOG_ENABLED !== "true") return false;
  return getPlatformClient() !== null;
}

/** 本地运营文案：描述、角标、卡片上的多个入口 */
type ProductCopy = Pick<SoftwareProduct, "description" | "badge" | "actions" | "adminOnly">;

function localCopy(): Map<string, ProductCopy> {
  return new Map(
    SOFTWARE_PRODUCTS.map((p) => [
      p.id,
      {
        description: p.description,
        badge: p.badge,
        actions: p.actions,
        adminOnly: p.adminOnly,
      },
    ]),
  );
}

const STATUS_MAP: Record<CatalogProduct["status"], SoftwareProduct["status"]> = {
  PLANNED: "coming_soon",
  COMING_SOON: "coming_soon",
  BETA: "beta",
  LIVE: "live",
  // 已下线的产品不再展示，调用方会先过滤掉
  SUNSET: "coming_soon",
};

export function mergeCatalogWithCopy(
  products: CatalogProduct[],
  copy: Map<string, ProductCopy> = localCopy(),
): SoftwareProduct[] {
  return products
    .filter((p) => p.status !== "SUNSET")
    .map((product) => {
      const local = copy.get(product.productId);
      return {
        id: product.productId,
        name: product.name,
        tagline: product.tagline,
        // 目录不存营销文案，缺本地文案时退到 tagline，总比空白强
        description: local?.description ?? product.tagline,
        status: STATUS_MAP[product.status],
        href: product.webUrl ?? undefined,
        badge: local?.badge,
        adminOnly: local?.adminOnly,
        actions: local?.actions,
      };
    });
}

/**
 * 取软件产品列表。
 * platform 未启用或不可达时返回本地静态列表。
 */
export async function loadSoftwareProducts(): Promise<SoftwareProduct[]> {
  if (!platformCatalogEnabled()) return SOFTWARE_PRODUCTS;
  const client = getPlatformClient();
  if (!client) return SOFTWARE_PRODUCTS;
  try {
    const products = await client.catalog.listProducts();
    if (products.length === 0) return SOFTWARE_PRODUCTS;
    return mergeCatalogWithCopy(products);
  } catch (error) {
    console.error(
      `[platform-catalog] 读取产品目录失败，回落到本地列表：${(error as Error)?.message}`,
    );
    return SOFTWARE_PRODUCTS;
  }
}

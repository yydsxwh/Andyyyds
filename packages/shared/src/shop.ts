/**
 * 商城业务规则（对标淘宝信息架构，落地在 Course.productType=PRODUCT）
 * - 列表：搜索 / 分类 / 排序（综合、销量、价格）
 * - 详情：多图 + 简化规格 + 加购 / 立即购买
 * - 购物车与订单 quantity / specLabel 配合本模块
 */

import { PRODUCT_PLAZA_ORDER_BY } from "@andyyyds/shared/product-display-order";

export const SHOP_PRODUCT_TYPE = "PRODUCT" as const;

export const SHOP_SORTS = ["default", "sales", "price_asc", "price_desc"] as const;
export type ShopSort = (typeof SHOP_SORTS)[number];

export const SHOP_SORT_LABEL: Record<ShopSort, string> = {
  default: "综合",
  sales: "销量",
  price_asc: "价格升序",
  price_desc: "价格降序",
};

export function isShopSort(value: string | null | undefined): value is ShopSort {
  return (SHOP_SORTS as readonly string[]).includes(value || "");
}

/** Prisma orderBy：综合沿用广场置顶规则；销量用人气；价格单独排 */
export function shopListOrderBy(sort: ShopSort) {
  if (sort === "sales") {
    return [{ studentCount: "desc" as const }, { createdAt: "desc" as const }];
  }
  if (sort === "price_asc") {
    return [{ price: "asc" as const }, { sortOrder: "asc" as const }];
  }
  if (sort === "price_desc") {
    return [{ price: "desc" as const }, { sortOrder: "asc" as const }];
  }
  return PRODUCT_PLAZA_ORDER_BY;
}

export type ShopSpecOption = {
  name: string;
  values: string[];
};

export type ShopSpecsConfig = {
  options: ShopSpecOption[];
};

export function parseGallery(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((u) => String(u || "").trim())
      .filter(Boolean)
      .slice(0, 12);
  } catch {
    return [];
  }
}

export function stringifyGallery(urls: string[]) {
  return JSON.stringify(
    urls.map((u) => u.trim()).filter(Boolean).slice(0, 12),
  );
}

export function parseSpecs(raw: string | null | undefined): ShopSpecsConfig {
  if (!raw?.trim()) return { options: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<ShopSpecsConfig>;
    const options = Array.isArray(parsed.options)
      ? parsed.options
          .filter((o) => o && typeof o === "object")
          .map((o) => ({
            name: String(o.name || "").trim().slice(0, 20),
            values: Array.isArray(o.values)
              ? o.values
                  .map((v) => String(v).trim().slice(0, 40))
                  .filter(Boolean)
                  .slice(0, 30)
              : [],
          }))
          .filter((o) => o.name && o.values.length > 0)
          .slice(0, 5)
      : [];
    return { options };
  } catch {
    return { options: [] };
  }
}

export function stringifySpecs(config: ShopSpecsConfig) {
  return JSON.stringify({
    options: config.options
      .filter((o) => o.name.trim() && o.values.length > 0)
      .slice(0, 5),
  });
}

/**
 * 将用户点选的规格拼成订单/购物车快照文案。
 * 所有规格维度都必须选齐，否则返回错误（淘宝式必选规格）。
 */
export function buildSpecLabel(
  config: ShopSpecsConfig,
  selected: Record<string, string> | null | undefined,
): { ok: true; label: string } | { ok: false; error: string } {
  if (config.options.length === 0) {
    return { ok: true, label: "" };
  }
  const parts: string[] = [];
  for (const opt of config.options) {
    const value = String(selected?.[opt.name] || "").trim();
    if (!value) {
      return { ok: false, error: `请选择「${opt.name}」` };
    }
    if (!opt.values.includes(value)) {
      return { ok: false, error: `「${opt.name}」选项无效` };
    }
    parts.push(`${opt.name}:${value}`);
  }
  return { ok: true, label: parts.join(" / ") };
}

/** 详情页主图列表：gallery 优先，否则用封面 */
export function resolveShopImages(coverUrl: string, galleryJson: string) {
  const gallery = parseGallery(galleryJson);
  if (gallery.length > 0) return gallery;
  return coverUrl ? [coverUrl] : [];
}

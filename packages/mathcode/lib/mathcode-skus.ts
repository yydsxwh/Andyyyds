/**
 * 识图转 LaTeX 可售壳：挂在 Course 上，才能走现有微信/支付宝订单与履约。
 * 不进课程广场；价格以 mathcode-quota 常量为准，每次确保时回写，避免后台误改。
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_COURSE_COVER_URL } from "@andyyyds/shared/cover-images";
import { MATHCODE_PRODUCT_TYPE } from "@andyyyds/shared/product-types";
import { isAdmin } from "@andyyyds/shared/roles";
import {
  MATHCODE_GUEST_CENTS_PER_PAGE,
  MATHCODE_MEMBERSHIP_CENTS,
  MATHCODE_MEMBERSHIP_PAGES,
  MATHCODE_MEMBERSHIP_SLUG,
  MATHCODE_PAGE_SLUG,
} from "@andyyyds/mathcode/lib/mathcode-quota";

type Db = PrismaClient | Prisma.TransactionClient;

export type MathcodeSkuPair = {
  membership: { id: string; slug: string; price: number; title: string };
  page: { id: string; slug: string; price: number; title: string };
};

async function resolveSkuTeacherId(db: Db): Promise<string> {
  const byRole = await db.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (byRole) return byRole.id;

  const candidates = await db.user.findMany({
    where: { roles: { contains: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { id: true, role: true, roles: true },
  });
  const admin = candidates.find((row) => isAdmin(row));
  if (admin) return admin.id;

  throw new Error("MATHCODE_SKU_NO_ADMIN");
}

async function upsertMathcodeSku(
  db: Db,
  input: {
    slug: string;
    title: string;
    subtitle: string;
    description: string;
    price: number;
    teacherId: string;
  },
) {
  const data = {
    title: input.title,
    subtitle: input.subtitle,
    description: input.description,
    coverUrl: DEFAULT_COURSE_COVER_URL,
    price: input.price,
    originalPrice: input.price,
    isFree: false,
    hidePrice: false,
    status: "PUBLISHED",
    productType: MATHCODE_PRODUCT_TYPE,
    teacherId: input.teacherId,
  };
  const existing = await db.course.findUnique({ where: { slug: input.slug } });
  if (existing) {
    await db.course.update({
      where: { id: existing.id },
      data,
    });
    return { id: existing.id, slug: input.slug, price: input.price, title: input.title };
  }
  const created = await db.course.create({
    data: {
      ...data,
      slug: input.slug,
    },
  });
  return { id: created.id, slug: input.slug, price: input.price, title: input.title };
}

export async function ensureMathcodeSkus(db: Db): Promise<MathcodeSkuPair> {
  const teacherId = await resolveSkuTeacherId(db);
  const membership = await upsertMathcodeSku(db, {
    slug: MATHCODE_MEMBERSHIP_SLUG,
    title: "MathCode 包月会员",
    subtitle: `¥30/月 · ${MATHCODE_MEMBERSHIP_PAGES}页`,
    description:
      "识图转 LaTeX 包月会员：30 元开通 30 天，含 150 页（或 150 张图）。额度用完须再开通，获得新的 150 页，不能按 0.5 元/页补差。",
    price: MATHCODE_MEMBERSHIP_CENTS,
    teacherId,
  });
  const page = await upsertMathcodeSku(db, {
    slug: MATHCODE_PAGE_SLUG,
    title: "MathCode 按页转换",
    subtitle: "¥0.5/页",
    description:
      "未开通会员时按页付费：0.5 元转换 1 页（1 张图或 PDF 的 1 页）。须先微信支付再识别。",
    price: MATHCODE_GUEST_CENTS_PER_PAGE,
    teacherId,
  });
  return { membership, page };
}

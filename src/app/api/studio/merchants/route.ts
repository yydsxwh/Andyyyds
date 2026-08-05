import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, makeReferralCode } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  MERCHANT_JOIN_TYPES,
  MERCHANT_STATUSES,
  roleForMerchantStatus,
} from "@/lib/merchants";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";
import type { MerchantStatus, Role } from "@/lib/types";

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72).optional(),
  name: z.string().min(1).max(80),
  storeName: z.string().min(1).max(120),
  contactName: z.string().max(80).optional().default(""),
  contactPhone: z.string().max(40).optional().default(""),
  contactWechat: z.string().max(80).optional().default(""),
  joinType: z.enum(MERCHANT_JOIN_TYPES).optional().default("DIRECT"),
  status: z.enum(MERCHANT_STATUSES).optional().default("APPROVED"),
  notes: z.string().max(1000).optional().default(""),
});

function serializeMerchant(
  merchant: {
    id: string;
    storeName: string;
    contactName: string;
    contactPhone: string;
    contactWechat: string;
    joinType: string;
    status: string;
    notes: string;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      _count: { courses: number };
      courses: { orders: { amount: number }[] }[];
    };
  },
) {
  const paidOrders = merchant.user.courses.flatMap((c) => c.orders);
  const revenue = paidOrders.reduce((sum, o) => sum + o.amount, 0);
  return {
    id: merchant.id,
    storeName: merchant.storeName,
    contactName: merchant.contactName,
    contactPhone: merchant.contactPhone,
    contactWechat: merchant.contactWechat,
    joinType: merchant.joinType,
    status: merchant.status,
    notes: merchant.notes,
    approvedAt: merchant.approvedAt?.toISOString() ?? null,
    createdAt: merchant.createdAt.toISOString(),
    updatedAt: merchant.updatedAt.toISOString(),
    user: {
      id: merchant.user.id,
      email: merchant.user.email,
      name: merchant.user.name,
      role: merchant.user.role,
    },
    courseCount: merchant.user._count.courses,
    revenue,
  };
}

const merchantInclude = {
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      _count: { select: { courses: true } },
      courses: {
        select: {
          orders: {
            where: { status: "PAID" },
            select: { amount: true },
          },
        },
      },
    },
  },
} as const;

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const q = (searchParams.get("q") || "").trim();

    const merchants = await prisma.merchant.findMany({
      where: {
        ...(status && MERCHANT_STATUSES.includes(status as MerchantStatus)
          ? { status }
          : {}),
        ...(q
          ? {
              OR: [
                { storeName: { contains: q } },
                { contactName: { contains: q } },
                { contactPhone: { contains: q } },
                { user: { email: { contains: q } } },
                { user: { name: { contains: q } } },
              ],
            }
          : {}),
      },
      include: merchantInclude,
      orderBy: { createdAt: "desc" },
    });

    const counts = await prisma.merchant.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    return NextResponse.json({
      merchants: merchants.map(serializeMerchant),
      counts: Object.fromEntries(
        MERCHANT_STATUSES.map((s) => [
          s,
          counts.find((c) => c.status === s)?._count._all || 0,
        ]),
      ),
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = createSchema.parse(await req.json());
    const email = body.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email },
      include: { merchant: true },
    });

    if (existing?.merchant) {
      return NextResponse.json({ error: "该账号已是入驻商家" }, { status: 400 });
    }
    if (existing?.role === "ADMIN") {
      return NextResponse.json({ error: "不能把站长账号设为商家" }, { status: 400 });
    }

    const status = body.status as MerchantStatus;
    const approvedAt = status === "APPROVED" ? new Date() : null;

    if (!existing && !body.password) {
      return NextResponse.json(
        { error: "新建商家账号时请设置不少于 6 位的登录密码" },
        { status: 400 },
      );
    }

    const merchant = await prisma.$transaction(async (tx) => {
      let userId: string;

      if (existing) {
        const nextRole = roleForMerchantStatus(status, existing.role as Role);
        await tx.user.update({
          where: { id: existing.id },
          data: {
            name: body.name,
            role: nextRole,
          },
        });
        userId = existing.id;
      } else {
        const created = await tx.user.create({
          data: {
            email,
            name: body.name,
            passwordHash: await hashPassword(body.password!),
            role: roleForMerchantStatus(status, "STUDENT"),
            referralCode: makeReferralCode(),
            bio: `${body.storeName} 入驻商家`,
          },
        });
        userId = created.id;
      }

      return tx.merchant.create({
        data: {
          userId,
          storeName: body.storeName.trim(),
          contactName: body.contactName?.trim() || "",
          contactPhone: body.contactPhone?.trim() || "",
          contactWechat: body.contactWechat?.trim() || "",
          joinType: body.joinType,
          status,
          notes: body.notes?.trim() || "",
          approvedAt,
        },
        include: merchantInclude,
      });
    });

    return NextResponse.json({ merchant: serializeMerchant(merchant) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "请检查商家信息填写是否完整" }, { status: 400 });
    }
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, makeReferralCode } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  MERCHANT_JOIN_TYPES,
  MERCHANT_STATUSES,
  roleFieldsForMerchantStatus,
} from "@/lib/merchants";
import { hasRole } from "@/lib/roles";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";
import type { MerchantJoinType, MerchantStatus, Role } from "@/lib/types";

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
  // 业务规则：归属加盟代理用于平台抽成再分；站长可手工指定，须为 AGENT 角色
  agentId: z.string().nullable().optional(),
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
    agentId: string | null;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    agent: { id: string; name: string; email: string } | null;
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
    agentId: merchant.agentId,
    agent: merchant.agent,
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
  agent: { select: { id: true, name: true, email: true } },
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

/** 校验 agentId 指向加盟代理；空/null 表示无归属 */
async function resolveAgentId(
  raw: string | null,
): Promise<{ ok: true; agentId: string | null } | { ok: false; error: string }> {
  if (raw === null || raw === "") {
    return { ok: true, agentId: null };
  }
  const agent = await prisma.user.findUnique({
    where: { id: raw },
    select: { id: true, role: true, roles: true },
  });
  if (!agent || !hasRole({ role: agent.role, roles: agent.roles || "" }, "AGENT")) {
    return { ok: false, error: "所选用户不是加盟代理" };
  }
  return { ok: true, agentId: agent.id };
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const q = (searchParams.get("q") || "").trim();

    const [merchants, agents] = await Promise.all([
      prisma.merchant.findMany({
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
      }),
      prisma.user.findMany({
        where: { role: "AGENT" },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const counts = await prisma.merchant.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    return NextResponse.json({
      merchants: merchants.map(serializeMerchant),
      agents,
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
    if (existing && hasRole({ role: existing.role, roles: existing.roles || "" }, "ADMIN")) {
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

    // 显式指定优先；未传时若注册上级是加盟代理则自动归属
    let agentId: string | null = null;
    if (body.agentId !== undefined) {
      const resolved = await resolveAgentId(body.agentId);
      if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      agentId = resolved.agentId;
    }

    const merchant = await prisma.$transaction(async (tx) => {
      let userId: string;

      if (existing) {
        const nextRoles = roleFieldsForMerchantStatus(
          status,
          { role: existing.role as Role, roles: existing.roles || "" },
          body.joinType as MerchantJoinType,
        );
        await tx.user.update({
          where: { id: existing.id },
          data: {
            name: body.name,
            role: nextRoles.role,
            roles: nextRoles.roles,
          },
        });
        userId = existing.id;
      } else {
        const createdRoles = roleFieldsForMerchantStatus(
          status,
          "STUDENT",
          body.joinType as MerchantJoinType,
        );
        const created = await tx.user.create({
          data: {
            email,
            name: body.name,
            passwordHash: await hashPassword(body.password!),
            role: createdRoles.role,
            roles: createdRoles.roles,
            referralCode: makeReferralCode(),
            bio: `${body.storeName} 入驻商家`,
          },
        });
        userId = created.id;
      }

      if (body.agentId === undefined) {
        const u = await tx.user.findUnique({
          where: { id: userId },
          select: {
            referredById: true,
            referredBy: { select: { role: true, roles: true } },
          },
        });
        agentId =
          u?.referredBy &&
          hasRole(
            { role: u.referredBy.role, roles: u.referredBy.roles || "" },
            "AGENT",
          )
            ? u.referredById
            : null;
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
          agentId,
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

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@andyyyds/shared/db";
import {
  MERCHANT_JOIN_TYPES,
  MERCHANT_STATUSES,
  roleFieldsForMerchantStatus,
} from "@andyyyds/shared/merchants";
import { hasRole } from "@andyyyds/shared/roles";
import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";
import type { MerchantJoinType, MerchantStatus, Role } from "@andyyyds/shared/types";

const patchSchema = z.object({
  storeName: z.string().min(1).max(120).optional(),
  contactName: z.string().max(80).optional(),
  contactPhone: z.string().max(40).optional(),
  contactWechat: z.string().max(80).optional(),
  joinType: z.enum(MERCHANT_JOIN_TYPES).optional(),
  status: z.enum(MERCHANT_STATUSES).optional(),
  notes: z.string().max(1000).optional(),
  name: z.string().min(1).max(80).optional(),
  /** 发展该商家的加盟代理 User.id；空字符串或 null 表示清空 */
  agentId: z.string().nullable().optional(),
});

const merchantInclude = {
  agent: { select: { id: true, name: true, email: true } },
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      roles: true,
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

async function resolveAgentId(
  raw: string | null | undefined,
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

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.merchant.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "商家不存在" }, { status: 404 });
    }

    let nextAgentId: string | null | undefined;
    if (body.agentId !== undefined) {
      const resolved = await resolveAgentId(body.agentId);
      if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      nextAgentId = resolved.agentId;
    }

    const nextStatus = (body.status || existing.status) as MerchantStatus;
    const nextJoinType = (body.joinType || existing.joinType) as MerchantJoinType;

    const merchant = await prisma.$transaction(async (tx) => {
      if (body.name || body.status || body.joinType) {
        const nextRoleFields = roleFieldsForMerchantStatus(
          nextStatus,
          {
            role: existing.user.role as Role,
            roles: existing.user.roles || "",
          },
          nextJoinType,
        );
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            ...(body.name ? { name: body.name } : {}),
            ...(body.status || body.joinType
              ? {
                  role: nextRoleFields.role,
                  roles: nextRoleFields.roles,
                }
              : {}),
          },
        });
      }

      return tx.merchant.update({
        where: { id },
        data: {
          ...(body.storeName !== undefined
            ? { storeName: body.storeName.trim() }
            : {}),
          ...(body.contactName !== undefined
            ? { contactName: body.contactName.trim() }
            : {}),
          ...(body.contactPhone !== undefined
            ? { contactPhone: body.contactPhone.trim() }
            : {}),
          ...(body.contactWechat !== undefined
            ? { contactWechat: body.contactWechat.trim() }
            : {}),
          ...(body.joinType !== undefined ? { joinType: body.joinType } : {}),
          ...(body.notes !== undefined ? { notes: body.notes.trim() } : {}),
          ...(nextAgentId !== undefined ? { agentId: nextAgentId } : {}),
          ...(body.status !== undefined
            ? {
                status: body.status,
                approvedAt:
                  body.status === "APPROVED"
                    ? existing.approvedAt ?? new Date()
                    : existing.approvedAt,
              }
            : {}),
        },
        include: merchantInclude,
      });
    });

    return NextResponse.json({ merchant: serializeMerchant(merchant) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

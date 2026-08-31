/**
 * GET /api/studio/users/:id/invitees
 * - 默认 JSON：邀请下级列表 + 统计
 * - ?format=csv | xls：导出文件（Excel 可打开）
 */

import { NextResponse } from "next/server";
import { prisma } from "@andyyyds/shared/db";
import {
  inviteesToCsv,
  inviteesToExcelXml,
  safeExportFilename,
  type InviteeExportRow,
} from "@andyyyds/shared/invitee-export";
import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";

async function loadInvitees(inviterId: string) {
  const inviter = await prisma.user.findUnique({
    where: { id: inviterId },
    select: {
      id: true,
      name: true,
      email: true,
      referralCode: true,
      role: true,
    },
  });
  if (!inviter) return null;

  const invitees = await prisma.user.findMany({
    where: { referredById: inviterId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      referralCode: true,
      createdAt: true,
      _count: {
        select: {
          orders: true,
          enrollments: true,
        },
      },
    },
  });

  // 已支付订单数单独聚合，避免每人拉一整份订单 id
  const paidGrouped =
    invitees.length === 0
      ? []
      : await prisma.order.groupBy({
          by: ["userId"],
          where: {
            userId: { in: invitees.map((u) => u.id) },
            status: "PAID",
          },
          _count: { _all: true },
        });
  const paidByUser = new Map(
    paidGrouped.map((g) => [g.userId, g._count._all]),
  );

  const rows: InviteeExportRow[] = invitees.map((u) => ({
    name: u.name,
    email: u.email,
    phone: u.phone || "",
    role: u.role,
    referralCode: u.referralCode,
    createdAt: u.createdAt,
    orderCount: u._count.orders,
    enrollmentCount: u._count.enrollments,
    paidOrderCount: paidByUser.get(u.id) || 0,
  }));

  const byRole: Record<string, number> = {};
  let withPaidOrders = 0;
  let withEnrollments = 0;
  let totalPaidOrders = 0;
  let totalEnrollments = 0;
  for (const r of rows) {
    byRole[r.role] = (byRole[r.role] || 0) + 1;
    if (r.paidOrderCount > 0) withPaidOrders += 1;
    if (r.enrollmentCount > 0) withEnrollments += 1;
    totalPaidOrders += r.paidOrderCount;
    totalEnrollments += r.enrollmentCount;
  }

  return {
    inviter,
    invitees: invitees.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone || "",
      role: u.role,
      referralCode: u.referralCode,
      createdAt: u.createdAt.toISOString(),
      orderCount: u._count.orders,
      enrollmentCount: u._count.enrollments,
      paidOrderCount: paidByUser.get(u.id) || 0,
    })),
    rows,
    stats: {
      total: rows.length,
      byRole,
      withPaidOrders,
      withEnrollments,
      totalPaidOrders,
      totalEnrollments,
    },
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const data = await loadInvitees(id);
    if (!data) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const url = new URL(req.url);
    const format = (url.searchParams.get("format") || "").toLowerCase();

    if (format === "csv") {
      const body = inviteesToCsv(data.rows, data.inviter.name);
      const filename = safeExportFilename(data.inviter.name, "csv");
      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    }

    if (format === "xls" || format === "excel") {
      const body = inviteesToExcelXml(data.rows, data.inviter.name);
      const filename = safeExportFilename(data.inviter.name, "xls");
      return new NextResponse(body, {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    }

    return NextResponse.json({
      inviter: data.inviter,
      invitees: data.invitees,
      stats: data.stats,
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

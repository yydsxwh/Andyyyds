import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getDistributionSettings,
  validateDistributionRates,
} from "@/lib/distribution";
import {
  canManageDistributionSettings,
  canViewDistribution,
} from "@/lib/roles";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (!canViewDistribution(session.role)) {
    return NextResponse.json({ error: "仅后台可查看" }, { status: 403 });
  }

  const settings = await getDistributionSettings(prisma);
  return NextResponse.json({ settings });
}

const patchSchema = z.object({
  enabled: z.boolean(),
  level1Percent: z.number().int(),
  level2Percent: z.number().int(),
  level3Percent: z.number().int(),
});

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (!canManageDistributionSettings(session.role)) {
    return NextResponse.json({ error: "仅站长可修改分销比例" }, { status: 403 });
  }

  try {
    const body = patchSchema.parse(await req.json());
    const err = validateDistributionRates(body);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const settings = await prisma.distributionConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        enabled: body.enabled,
        level1Percent: body.level1Percent,
        level2Percent: body.level2Percent,
        level3Percent: body.level3Percent,
      },
      update: {
        enabled: body.enabled,
        level1Percent: body.level1Percent,
        level2Percent: body.level2Percent,
        level3Percent: body.level3Percent,
      },
    });

    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ error: "保存失败" }, { status: 400 });
  }
}

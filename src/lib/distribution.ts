import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type DistributionSettings = {
  enabled: boolean;
  level1Percent: number;
  level2Percent: number;
  level3Percent: number;
};

const DEFAULTS: DistributionSettings = {
  enabled: true,
  level1Percent: 20,
  level2Percent: 10,
  level3Percent: 5,
};

export async function getDistributionSettings(db: Db): Promise<DistributionSettings> {
  const row = await db.distributionConfig.upsert({
    where: { id: "default" },
    create: { id: "default", ...DEFAULTS },
    update: {},
  });
  return {
    enabled: row.enabled,
    level1Percent: row.level1Percent,
    level2Percent: row.level2Percent,
    level3Percent: row.level3Percent,
  };
}

/** Walk referredBy chain: [一级上级, 二级上级, 三级上级] */
export async function getUplineChain(db: Db, buyerId: string) {
  const chain: Array<{ id: string; name: string; level: 1 | 2 | 3 }> = [];
  let currentId: string | null = buyerId;

  for (let level = 1; level <= 3; level++) {
    if (!currentId) break;
    const row: { referredById: string | null } | null = await db.user.findUnique({
      where: { id: currentId },
      select: { referredById: true },
    });
    if (!row?.referredById) break;

    const parent: { id: string; name: string } | null = await db.user.findUnique({
      where: { id: row.referredById },
      select: { id: true, name: true },
    });
    if (!parent) break;

    chain.push({
      id: parent.id,
      name: parent.name,
      level: level as 1 | 2 | 3,
    });
    currentId = parent.id;
  }

  return chain;
}

export async function createCommissionsForOrder(
  db: Db,
  order: { id: string; userId: string; amount: number },
) {
  if (order.amount <= 0) return [];

  const existing = await db.commission.count({ where: { orderId: order.id } });
  if (existing > 0) return [];

  const settings = await getDistributionSettings(db);
  if (!settings.enabled) return [];

  const rates = [
    settings.level1Percent,
    settings.level2Percent,
    settings.level3Percent,
  ];
  const upline = await getUplineChain(db, order.userId);
  const created = [];

  for (const person of upline) {
    const rate = rates[person.level - 1] || 0;
    if (rate <= 0) continue;
    const amount = Math.floor((order.amount * rate) / 100);
    if (amount <= 0) continue;

    const row = await db.commission.create({
      data: {
        orderId: order.id,
        beneficiaryId: person.id,
        buyerId: order.userId,
        level: person.level,
        ratePercent: rate,
        amount,
        status: "SETTLED",
      },
    });
    created.push(row);
  }

  return created;
}

export function validateDistributionRates(input: {
  level1Percent: number;
  level2Percent: number;
  level3Percent: number;
}) {
  const { level1Percent, level2Percent, level3Percent } = input;
  for (const n of [level1Percent, level2Percent, level3Percent]) {
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      return "每一级比例需为 0–100 的整数";
    }
  }
  if (level1Percent + level2Percent + level3Percent > 100) {
    return "三级比例合计不能超过 100%";
  }
  return null;
}

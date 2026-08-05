const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

function makeReferralCode() {
  return `YY${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function main() {
  const p = new PrismaClient();
  try {
    const teacher = await p.user.findUnique({
      where: { email: "teacher@yyds.local" },
      include: { merchant: true },
    });
    if (teacher && !teacher.merchant) {
      await p.merchant.create({
        data: {
          userId: teacher.id,
          storeName: "知夏知识工作室",
          contactName: "林知夏",
          contactPhone: "13800001111",
          contactWechat: "zhixia-studio",
          joinType: "DIRECT",
          status: "APPROVED",
          notes: "演示已入驻商家",
          approvedAt: new Date(),
        },
      });
      console.log("linked teacher merchant");
    }

    let pending = await p.user.findUnique({
      where: { email: "merchant@yyds.local" },
      include: { merchant: true },
    });
    if (!pending) {
      pending = await p.user.create({
        data: {
          email: "merchant@yyds.local",
          name: "待审商家",
          passwordHash: await bcrypt.hash("123456", 10),
          role: "STUDENT",
          bio: "待审核入驻商家",
          referralCode: makeReferralCode(),
        },
        include: { merchant: true },
      });
      console.log("created pending user");
    }
    if (pending && !pending.merchant) {
      await p.merchant.create({
        data: {
          userId: pending.id,
          storeName: "星火成长课堂",
          contactName: "王加盟",
          contactPhone: "13900002222",
          contactWechat: "xinghuo-join",
          joinType: "FRANCHISE",
          status: "PENDING",
          notes: "演示待审核加盟申请",
        },
      });
      console.log("created pending merchant");
    }

    console.log("merchant_count", await p.merchant.count());
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

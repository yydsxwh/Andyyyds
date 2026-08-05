const { PrismaClient } = require("@prisma/client");

async function main() {
  const p = new PrismaClient();
  const row = await p.distributionConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      enabled: true,
      level1Percent: 20,
      level2Percent: 10,
      level3Percent: 5,
    },
    update: {},
  });
  console.log(row);
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

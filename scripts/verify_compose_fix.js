const { SignJWT } = require("jose");
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const text = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[m[1].trim()] = v;
  }
  return env;
}

(async () => {
  const env = loadEnv();
  const p = new PrismaClient();
  const user = await p.user.findUnique({
    where: { id: "cmsgnei4i000011uxy1myjxpk" },
  });
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(env.AUTH_SECRET));

  const cases = [
    {
      name: "short-desc-now-ok",
      body: {
        productType: "COLUMN",
        title: "高数平时班",
        subtitle: "",
        description: "短描述",
        price: 99,
        publish: false,
        groupByCategory: true,
        assetIds: ["cmsgrpha80001kh080sasf2jj", "cmsgrpunp0003kh0876j8f1o1"],
      },
    },
    {
      name: "too-short-desc-clear-error",
      body: {
        productType: "COURSE",
        title: "高数平时班",
        subtitle: "",
        description: "一",
        price: 99,
        publish: false,
        groupByCategory: true,
        assetIds: ["cmsgrpha80001kh080sasf2jj"],
      },
    },
  ];

  for (const sample of cases) {
    const res = await fetch("http://127.0.0.1:3000/api/studio/compose", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `yyds_session=${token}`,
      },
      body: JSON.stringify(sample.body),
    });
    const text = await res.text();
    console.log(sample.name, res.status, text);
    if (res.ok) {
      const data = JSON.parse(text);
      await p.course.delete({ where: { id: data.id } }).catch(() => {});
      console.log("cleaned", data.id);
    }
  }
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

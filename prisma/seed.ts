import { hashPassword, makeReferralCode } from "../src/lib/password";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.commission.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.couponRedemption.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.course.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.mediaCategory.deleteMany();
  await prisma.category.deleteMany();
  await prisma.distributionConfig.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword("123456");

  const admin = await prisma.user.create({
    data: {
      email: "admin@yyds.local",
      name: "站长",
      passwordHash,
      role: "ADMIN",
      bio: "YYDS 课程平台站长",
      referralCode: makeReferralCode(),
    },
  });

  const teacher = await prisma.user.create({
    data: {
      email: "teacher@yyds.local",
      name: "林知夏",
      passwordHash,
      role: "TEACHER",
      bio: "十年知识付费操盘手，擅长把复杂技能拆成可落地的学习路径。",
      referralCode: makeReferralCode(),
    },
  });

  const agent = await prisma.user.create({
    data: {
      email: "agent@yyds.local",
      name: "加盟代理演示",
      passwordHash,
      role: "AGENT",
      bio: "演示加盟代理账号",
      referralCode: makeReferralCode(),
    },
  });

  const student = await prisma.user.create({
    data: {
      email: "student@yyds.local",
      name: "学员小陈",
      passwordHash,
      role: "STUDENT",
      bio: "热爱学习的新同学",
      referralCode: makeReferralCode(),
      referredById: teacher.id,
    },
  });

  const categories = await Promise.all(
    [
      { name: "职场提升", slug: "career", description: "沟通、效率与职业成长" },
      { name: "副业变现", slug: "side-hustle", description: "内容、电商与知识变现" },
      { name: "AI 应用", slug: "ai", description: "把 AI 变成生产力工具" },
      { name: "身心成长", slug: "growth", description: "习惯、情绪与长期主义" },
    ].map((c) => prisma.category.create({ data: c })),
  );

  const course1 = await prisma.course.create({
    data: {
      title: "从 0 到 1 搭建你的知识付费品牌",
      slug: "build-knowledge-brand",
      subtitle: "定位、产品、获客、交付全链路实战",
      description:
        "一套可落地的知识付费运营框架：从选题定位、课程包装、售前转化，到交付复购与私域沉淀。适合想做个人 IP、工作室或企业内训变现的人。",
      coverUrl: "/covers/team-collab.jpg",
      price: 19900,
      originalPrice: 39900,
      status: "PUBLISHED",
      studentCount: 1286,
      rating: 4.9,
      teacherId: teacher.id,
      categoryId: categories[1].id,
      chapters: {
        create: [
          {
            title: "第一模块：定位与选题",
            sortOrder: 1,
            lessons: {
              create: [
                {
                  title: "为什么大多数课卖不出去",
                  sortOrder: 1,
                  type: "VIDEO",
                  isPreview: true,
                  durationSec: 720,
                  videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
                  content: "先理解需求、信任与转化漏斗，再谈内容本身。",
                },
                {
                  title: "找到你能卖的能力切口",
                  sortOrder: 2,
                  type: "ARTICLE",
                  durationSec: 480,
                  content:
                    "用「人群痛点 × 你的可交付能力 × 可验证结果」三角模型，筛出第一门课的主题。",
                },
              ],
            },
          },
          {
            title: "第二模块：产品与转化",
            sortOrder: 2,
            lessons: {
              create: [
                {
                  title: "课程包装的五个关键页面",
                  sortOrder: 1,
                  type: "VIDEO",
                  durationSec: 900,
                  videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
                  content: "详情页结构、信任背书、价格锚点与行动号召。",
                },
                {
                  title: "直播带课实操清单",
                  sortOrder: 2,
                  type: "LIVE",
                  durationSec: 3600,
                  liveAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
                  content: "开播前检查、互动话术、限时优惠与课后转化。",
                },
              ],
            },
          },
        ],
      },
    },
  });

  const course2 = await prisma.course.create({
    data: {
      title: "AI 工作流：把重复劳动交给智能体",
      slug: "ai-workflow",
      subtitle: "提示词、自动化与个人知识库",
      description:
        "面向职场人的 AI 落地课。不讲空概念，直接搭建写作、复盘、客户跟进与资料整理的工作流。",
      coverUrl: "/covers/ai-tech.jpg",
      price: 9900,
      originalPrice: 19900,
      status: "PUBLISHED",
      studentCount: 2431,
      rating: 4.8,
      teacherId: teacher.id,
      categoryId: categories[2].id,
      chapters: {
        create: [
          {
            title: "基础工作流",
            sortOrder: 1,
            lessons: {
              create: [
                {
                  title: "30 分钟搭好你的第一套提示词模板",
                  sortOrder: 1,
                  type: "VIDEO",
                  isPreview: true,
                  durationSec: 1800,
                  videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
                  content: "角色、任务、约束、输出格式四段式提示词。",
                },
                {
                  title: "用 AI 做周报与会议纪要",
                  sortOrder: 2,
                  type: "ARTICLE",
                  durationSec: 600,
                  content: "输入素材 → 结构化摘要 → 行动项清单 → 一键同步。",
                },
              ],
            },
          },
        ],
      },
    },
  });

  const course3 = await prisma.course.create({
    data: {
      title: "高效沟通：让协作不再消耗",
      slug: "effective-communication",
      subtitle: "职场表达、反馈与冲突处理",
      description:
        "用可练习的沟通框架，减少误解和内耗。适合团队负责人、项目经理和希望提升影响力的同学。",
      coverUrl: "/covers/whiteboard-workshop.jpg",
      price: 0,
      originalPrice: 12900,
      isFree: true,
      status: "PUBLISHED",
      studentCount: 5120,
      rating: 4.7,
      teacherId: teacher.id,
      categoryId: categories[0].id,
      chapters: {
        create: [
          {
            title: "表达与倾听",
            sortOrder: 1,
            lessons: {
              create: [
                {
                  title: "先对齐目标再谈方案",
                  sortOrder: 1,
                  type: "VIDEO",
                  isPreview: true,
                  durationSec: 840,
                  videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
                  content: "用目标、边界、成功标准三句话开启协作。",
                },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.coupon.create({
    data: {
      code: "YYDS20",
      title: "新学员立减 20 元",
      type: "FIXED",
      discountCents: 2000,
      percentOff: 0,
      minAmount: 9900,
      maxUses: 1000,
      maxPerUser: 1,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90),
    },
  });

  await prisma.enrollment.create({
    data: {
      userId: student.id,
      courseId: course3.id,
    },
  });

  await prisma.course.update({
    where: { id: course3.id },
    data: { studentCount: { increment: 1 } },
  });

  const mediaCats = await Promise.all(
    ["开场导学", "转化话术", "交付复盘"].map((name) =>
      prisma.mediaCategory.create({
        data: { name, ownerId: teacher.id },
      }),
    ),
  );

  await prisma.mediaAsset.createMany({
    data: [
      {
        name: "开场导学｜为什么你的知识付费产品卖不动：从信任缺口到转化漏斗的完整拆解与现场演示",
        description: "适合作为单课第一节或专栏导读。",
        fileUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        fileName: "intro-funnel.mp4",
        mimeType: "video/mp4",
        durationSec: 720,
        ownerId: teacher.id,
        categoryId: mediaCats[0].id,
      },
      {
        name: "转化话术｜详情页五段式结构：痛点共鸣、方法可信、结果证明、价格锚点、行动号召",
        description: "可单独售卖，也可并入专栏第二章。",
        fileUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        fileName: "landing-copy.mp4",
        mimeType: "video/mp4",
        durationSec: 900,
        ownerId: teacher.id,
        categoryId: mediaCats[1].id,
      },
      {
        name: "交付复盘｜课后作业设计与社群答疑节奏：让完课率和复购同时上升的运营清单",
        description: "交付侧素材，建议放在专栏后半段。",
        fileUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        fileName: "delivery-review.mp4",
        mimeType: "video/mp4",
        durationSec: 840,
        ownerId: teacher.id,
        categoryId: mediaCats[2].id,
      },
      {
        name: "未分类样例｜直播带课互动节奏与限时优惠话术速记（可随时改名并归类）",
        description: "演示未分类素材。",
        fileUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        fileName: "live-script.mp4",
        mimeType: "video/mp4",
        durationSec: 600,
        ownerId: teacher.id,
      },
    ],
  });

  await prisma.distributionConfig.create({
    data: {
      id: "default",
      enabled: true,
      level1Percent: 20,
      level2Percent: 10,
      level3Percent: 5,
    },
  });

  await prisma.merchant.create({
    data: {
      userId: teacher.id,
      storeName: "知夏知识工作室",
      contactName: "林知夏",
      contactPhone: "13800001111",
      contactWechat: "zhixia-studio",
      joinType: "DIRECT",
      status: "APPROVED",
      notes: "演示已入驻商家（对应 teacher 账号；角色保持老师）",
      approvedAt: new Date(),
    },
  });

  await prisma.merchant.create({
    data: {
      userId: agent.id,
      storeName: "加盟代理演示",
      contactName: "代理演示",
      contactPhone: "13700003333",
      contactWechat: "agent-demo",
      joinType: "FRANCHISE",
      status: "APPROVED",
      notes: "seed 加盟代理",
      approvedAt: new Date(),
    },
  });

  const pendingMerchantUser = await prisma.user.create({
    data: {
      email: "merchant@yyds.local",
      name: "待审商家",
      passwordHash,
      role: "STUDENT",
      bio: "待审核入驻商家",
      referralCode: makeReferralCode(),
    },
  });

  await prisma.merchant.create({
    data: {
      userId: pendingMerchantUser.id,
      storeName: "星火成长课堂",
      contactName: "王加盟",
      contactPhone: "13900002222",
      contactWechat: "xinghuo-join",
      joinType: "DIRECT",
      status: "PENDING",
      notes: "演示待审核商家入驻；审核通过后角色变为入驻商家",
    },
  });

  console.log("Seed OK");
  console.log("站长 ADMIN:     admin@yyds.local / 123456");
  console.log("老师 TEACHER:   teacher@yyds.local / 123456");
  console.log("加盟代理 AGENT: agent@yyds.local / 123456");
  console.log("用户 STUDENT:   student@yyds.local / 123456");
  console.log("待审商家:       merchant@yyds.local / 123456");
  console.log(`Courses: ${course1.slug}, ${course2.slug}, ${course3.slug}`);
  console.log("Coupon: YYDS20");
  console.log("Media: 4 sample assets for teacher@yyds.local");
  console.log("Distribution: L1 20% / L2 10% / L3 5%");
  console.log("Merchants: teacher approved + agent franchise + 1 pending");
  console.log(`Admin id: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

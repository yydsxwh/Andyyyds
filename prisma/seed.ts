import { hashPassword, makeReferralCode } from "../src/lib/password";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.lessonProgress.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.couponRedemption.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.course.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword("123456");

  const admin = await prisma.user.create({
    data: {
      email: "admin@yyds.local",
      name: "平台管理员",
      passwordHash,
      role: "ADMIN",
      bio: "YYDS 课程平台管理员",
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
      coverUrl:
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
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
      coverUrl:
        "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80",
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
      coverUrl:
        "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
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
      discountCents: 2000,
      minAmount: 9900,
      maxUses: 1000,
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

  console.log("Seed OK");
  console.log("Admin:   admin@yyds.local / 123456");
  console.log("Teacher: teacher@yyds.local / 123456");
  console.log("Student: student@yyds.local / 123456");
  console.log(`Courses: ${course1.slug}, ${course2.slug}, ${course3.slug}`);
  console.log("Coupon: YYDS20");
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

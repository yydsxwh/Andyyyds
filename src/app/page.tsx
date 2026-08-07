import Link from "next/link";
import { ContactUsPanel } from "@/components/contact-us-panel";
import { CourseCard } from "@/components/course-card";
import {
  PageModulesView,
  shouldUseDiyLayout,
} from "@/components/page-modules-view";
import { DEFAULT_LOGO_URL, resolveHeroImage } from "@/lib/decorate";
import { prisma } from "@/lib/db";
import {
  DEFAULT_HOME_SECTION_ORDER,
  DEFAULT_PORTAL_CONTACT,
  isHomeContactSectionVisible,
  normalizeHomeSectionOrder,
  shouldShowContactBeforeDiyContent,
  visibleHomeSectionIds,
  type HomeSectionEntry,
  type HomeSectionId,
  type PortalContact,
  type PortalNavLink,
} from "@/lib/portal";
import { getDefaultTemplate } from "@/lib/page-templates";
import { PRODUCT_PLAZA_ORDER_BY } from "@/lib/product-display-order";
import {
  getDecorateConfig,
  getPageTemplatesConfig,
  getPortalConfig,
} from "@/lib/site-settings";
import { withSignedCoverUrls } from "@/lib/storage";
import { typoRoleClass, typoRoleStyle } from "@/lib/site-typography";
import type { DecorateConfig } from "@/lib/decorate";
import type { Category, Course, User } from "@prisma/client";

export const dynamic = "force-dynamic";

type CourseCardRow = Course & {
  teacher: User;
  category: Category | null;
};

function ContactSection({ contact }: { contact: PortalContact }) {
  return (
    <section className="pt-4 sm:pt-6">
      <div className="container">
        <ContactUsPanel contact={contact} variant="hero" />
      </div>
    </section>
  );
}

function HeroSection({ decorate }: { decorate: DecorateConfig }) {
  const logoUrl = decorate.logoUrl || DEFAULT_LOGO_URL;
  const heroImage = resolveHeroImage(decorate);
  const heroAlt = decorate.banners[0]?.alt || "品牌主视觉";

  return (
    <section className="relative overflow-hidden">
      {/* 氛围底反向位移：与前景错位，强化裸眼分层（仅 tilt-on 时） */}
      <div
        className="tilt-layer-bg pointer-events-none absolute -inset-8 opacity-70"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 20% 30%, rgba(14,165,233,0.18), transparent 70%), radial-gradient(ellipse 40% 35% at 80% 60%, rgba(244,63,94,0.1), transparent 65%)",
        }}
      />
      <div className="container grid min-h-[78vh] items-center gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="tilt-layer-fg fade-up space-y-6">
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={decorate.brandName || "歪歪艾斯"}
              className="h-20 w-auto max-w-[min(100%,420px)] object-contain sm:h-24 md:h-28"
            />
            {decorate.showBrandText ? (
              <p
                className={`brand-mark text-[var(--ink)] ${typoRoleClass("heroTitle")}`}
                style={typoRoleStyle("heroTitle")}
              >
                {decorate.brandName}
              </p>
            ) : null}
          </div>
          <h1
            className={`max-w-3xl font-semibold leading-tight ${typoRoleClass("heroTitle")}`}
            style={typoRoleStyle("heroTitle")}
          >
            {decorate.heroHeadline}
          </h1>
          <p
            className={`max-w-2xl leading-7 text-[var(--muted)] ${typoRoleClass("heroSubtext")}`}
            style={typoRoleStyle("heroSubtext")}
          >
            {decorate.heroSubtext}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/courses" className="btn btn-primary">
              进入知识付费
            </Link>
            <Link href="/about/company" className="btn btn-fire">
              了解公司
            </Link>
          </div>
        </div>
        <div className="fade-up-delay hero-glow relative">
          <div className="tilt-hero-frame float-soft surface surface-fire overflow-hidden rounded-[36px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt={heroAlt}
              className="tilt-layer-mid aspect-[4/5] w-full object-cover sm:aspect-[5/4] lg:aspect-[4/5]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function BannersSection({ decorate }: { decorate: DecorateConfig }) {
  if (decorate.banners.length <= 1) return null;
  return (
    <section className="pb-8">
      <div className="container">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decorate.banners.slice(1).map((banner) => (
            <div
              key={banner.id}
              className="surface overflow-hidden rounded-[28px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={banner.url}
                alt={banner.alt || decorate.brandName}
                className="aspect-[16/10] w-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PortalEntranceSection({ modules }: { modules: PortalNavLink[] }) {
  return (
    <section className="pb-14">
      <div className="container">
        <div className="mb-6">
          <h2
            className={`font-semibold ${typoRoleClass("sectionTitle")}`}
            style={typoRoleStyle("sectionTitle")}
          >
            门户入口
          </h2>
          <p
            className={`mt-2 text-[var(--muted)] ${typoRoleClass("sectionDesc")}`}
            style={typoRoleStyle("sectionDesc")}
          >
            多功能站点正在扩展：介绍、知识付费、约搭已可用，商城 / 论坛 / 游戏陆续开放
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {modules.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="surface-soft group rounded-[28px] p-5 transition hover:-translate-y-0.5 active:-translate-y-0.5"
            >
              <div
                className={`font-semibold group-hover:text-[var(--brand)] ${typoRoleClass("portalCardTitle")}`}
                style={typoRoleStyle("portalCardTitle")}
              >
                {item.label}
              </div>
              <p
                className={`mt-2 text-[var(--muted)] ${typoRoleClass("portalCardDesc")}`}
                style={typoRoleStyle("portalCardDesc")}
              >
                {item.comingSoon ? "即将开放，先了解规划" : "点击进入"}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function HotCoursesSection({ courses }: { courses: CourseCardRow[] }) {
  return (
    <section className="pb-20">
      <div className="container">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2
              className={`font-semibold ${typoRoleClass("sectionTitle")}`}
              style={typoRoleStyle("sectionTitle")}
            >
              热门课程
            </h2>
            <p
              className={`mt-2 text-[var(--muted)] ${typoRoleClass("sectionDesc")}`}
              style={typoRoleStyle("sectionDesc")}
            >
              先学一门，感受完整购买到学习的路径
            </p>
          </div>
          <Link
            href="/courses"
            className={`text-[var(--brand)] ${typoRoleClass("sectionDesc")}`}
            style={typoRoleStyle("sectionDesc")}
          >
            查看全部
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ClassicHomeByOrder({
  order,
  contact,
  decorate,
  modules,
  courses,
}: {
  order: HomeSectionEntry[];
  contact: PortalContact;
  decorate: DecorateConfig;
  modules: PortalNavLink[];
  courses: CourseCardRow[];
}) {
  // 按 CMS 顺序渲染，并跳过 visible===false 的区块（隐藏后仍保留后台位次）
  const sectionIds: HomeSectionId[] = visibleHomeSectionIds(order);
  return (
    <div>
      {sectionIds.map((sectionId) => {
        switch (sectionId) {
          case "contact":
            return <ContactSection key="contact" contact={contact} />;
          case "hero":
            return <HeroSection key="hero" decorate={decorate} />;
          case "banners":
            return <BannersSection key="banners" decorate={decorate} />;
          case "portal":
            return <PortalEntranceSection key="portal" modules={modules} />;
          case "courses":
            return <HotCoursesSection key="courses" courses={courses} />;
          default: {
            const _exhaustive: never = sectionId;
            return _exhaustive;
          }
        }
      })}
    </div>
  );
}

export default async function HomePage() {
  const [coursesRaw, decorate, portal, pageTemplates] = await Promise.all([
    prisma.course.findMany({
      where: {
        status: "PUBLISHED",
        // 首页热门只展示课程广场产品，资料另有广场入口
        productType: { in: ["COURSE", "COLUMN"] },
      },
      include: { teacher: true, category: true },
      orderBy: PRODUCT_PLAZA_ORDER_BY,
      // 加宽内容区后首页可多展示几门热门课
      take: 12,
    }),
    getDecorateConfig(),
    getPortalConfig(),
    getPageTemplatesConfig(),
  ]);

  const contact = portal.contact || DEFAULT_PORTAL_CONTACT;
  const homeSectionOrder = normalizeHomeSectionOrder(
    portal.homeSectionOrder?.length
      ? portal.homeSectionOrder
      : DEFAULT_HOME_SECTION_ORDER,
  );

  // 仅「已设为默认」且含模块的首页 DIY 才接管；否则用系统经典首页（介绍文案等）
  const diyHome = getDefaultTemplate(pageTemplates, "home");
  if (shouldUseDiyLayout(diyHome)) {
    // DIY 首页也尊重「首页区块顺序」里联系我们的显隐与相对主视觉前后
    const showContact = isHomeContactSectionVisible(homeSectionOrder);
    const contactBefore =
      showContact && shouldShowContactBeforeDiyContent(homeSectionOrder);
    return (
      <div className="space-y-4 py-4 sm:py-6">
        {contactBefore ? (
          <div className="container">
            <ContactUsPanel contact={contact} variant="hero" />
          </div>
        ) : null}
        <PageModulesView template={diyHome!} />
        {showContact && !contactBefore ? (
          <div className="container">
            <ContactUsPanel contact={contact} variant="hero" />
          </div>
        ) : null}
      </div>
    );
  }

  const courses = await withSignedCoverUrls(coursesRaw);

  const modules = portal.nav.filter(
    (item) => item.enabled !== false && item.key !== "home",
  );

  return (
    <ClassicHomeByOrder
      order={homeSectionOrder}
      contact={contact}
      decorate={decorate}
      modules={modules}
      courses={courses}
    />
  );
}

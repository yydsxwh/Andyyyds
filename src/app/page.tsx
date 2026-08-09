import Link from "next/link";
import { HomeUserChatSearch } from "@/components/chat/home-user-chat-search";
import { ConfigurableLink } from "@/components/configurable-link";
import { ContactUsPanel } from "@/components/contact-us-panel";
import { CourseCard } from "@/components/course-card";
import { getSession } from "@/lib/auth";
import {
  MeetupCard,
  type MeetupCardData,
} from "@/components/meetup-card";
import {
  PageModulesView,
  shouldUseDiyLayout,
} from "@/components/page-modules-view";
import {
  DEFAULT_HERO_PRIMARY_CTA,
  DEFAULT_HERO_SECONDARY_CTA,
  DEFAULT_LOGO_URL,
  resolveBannerOpenInNewTab,
  resolveHeroImage,
} from "@/lib/decorate";
import { prisma } from "@/lib/db";
import {
  buildMeetupPlazaWhere,
  fromMeetupPeopleDb,
  sortMeetupPlazaRows,
} from "@/lib/meetup";
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
  getHideAllPricesFlag,
  getPageTemplatesConfig,
  getPortalConfig,
} from "@/lib/site-settings";
import { withSignedCoverUrls } from "@/lib/storage";
import { typoRoleClass, typoRoleStyle } from "@/lib/site-typography";
import type { DecorateConfig } from "@/lib/decorate";
import type { Category, Course, User } from "@prisma/client";

export const dynamic = "force-dynamic";

/** 首页热门约搭展示条数（与热门课程区密度接近） */
const HOME_MEETUP_TAKE = 8;

type CourseCardRow = Course & {
  teacher: User;
  category: Category | null;
};

function ContactSection({ contact }: { contact: PortalContact }) {
  return (
    <section className="pt-4 sm:pt-6">
      {/* 不用居中 container 的视觉「中间条」，改为贴左内边距，卡片更靠左 */}
      <div className="w-full max-w-6xl px-3 sm:px-5 lg:px-8">
        <ContactUsPanel contact={contact} variant="hero" />
      </div>
    </section>
  );
}

function HeroSection({ decorate }: { decorate: DecorateConfig }) {
  const logoUrl = decorate.logoUrl || DEFAULT_LOGO_URL;
  const heroImage = resolveHeroImage(decorate);
  const heroBanner = decorate.banners[0];
  const heroAlt = heroBanner?.alt || "品牌主视觉";
  // 主视觉大图：有 href 才可点；未配 openInNewTab 时默认新标签（投放/外链常见）
  const heroHref = (heroBanner?.href || "").trim();
  const heroOpenInNewTab = heroBanner
    ? resolveBannerOpenInNewTab(heroBanner)
    : true;
  const primaryCta = decorate.heroPrimaryCta || DEFAULT_HERO_PRIMARY_CTA;
  const secondaryCta = decorate.heroSecondaryCta || DEFAULT_HERO_SECONDARY_CTA;

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
            <ConfigurableLink
              href={decorate.logoHref}
              openInNewTab={Boolean(decorate.logoOpenInNewTab)}
              className="inline-block max-w-full touch-manipulation"
              ariaLabel={decorate.brandName || "品牌 Logo"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={decorate.brandName || "歪歪艾斯"}
                className="h-20 w-auto max-w-[min(100%,420px)] object-contain sm:h-24 md:h-28"
              />
            </ConfigurableLink>
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
            {primaryCta.href ? (
              <ConfigurableLink
                href={primaryCta.href}
                openInNewTab={Boolean(primaryCta.openInNewTab)}
                className="btn btn-primary touch-manipulation"
              >
                {primaryCta.label || DEFAULT_HERO_PRIMARY_CTA.label}
              </ConfigurableLink>
            ) : null}
            {secondaryCta.href ? (
              <ConfigurableLink
                href={secondaryCta.href}
                openInNewTab={Boolean(secondaryCta.openInNewTab)}
                className="btn btn-fire touch-manipulation"
              >
                {secondaryCta.label || DEFAULT_HERO_SECONDARY_CTA.label}
              </ConfigurableLink>
            ) : null}
          </div>
        </div>
        <div className="fade-up-delay hero-glow relative">
          <ConfigurableLink
            href={heroHref}
            openInNewTab={heroOpenInNewTab}
            className="tilt-hero-frame float-soft surface surface-fire block overflow-hidden rounded-[36px] touch-manipulation"
            ariaLabel={heroAlt}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt={heroAlt}
              className="tilt-layer-mid aspect-[4/5] w-full object-cover sm:aspect-[5/4] lg:aspect-[4/5]"
            />
          </ConfigurableLink>
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
          {decorate.banners.slice(1).map((banner) => {
            const href = (banner.href || "").trim();
            const openInNewTab = resolveBannerOpenInNewTab(banner);
            return (
              <ConfigurableLink
                key={banner.id}
                href={href}
                openInNewTab={openInNewTab}
                className="surface block overflow-hidden rounded-[28px] touch-manipulation"
                ariaLabel={banner.alt || decorate.brandName}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={banner.url}
                  alt={banner.alt || decorate.brandName}
                  className="aspect-[16/10] w-full object-cover"
                />
              </ConfigurableLink>
            );
          })}
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
            <ConfigurableLink
              key={item.key}
              href={item.href}
              openInNewTab={Boolean(item.openInNewTab)}
              className="surface-soft group block rounded-[28px] p-5 transition touch-manipulation hover:-translate-y-0.5 active:-translate-y-0.5"
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
            </ConfigurableLink>
          ))}
        </div>
      </div>
    </section>
  );
}

function HotCoursesSection({
  courses,
  hideAllPrices,
}: {
  courses: CourseCardRow[];
  hideAllPrices: boolean;
}) {
  if (!courses.length) return null;
  return (
    <section className="pb-16 sm:pb-20">
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
            <CourseCard
              key={course.id}
              course={course}
              hideAllPrices={hideAllPrices}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function HotMeetupsSection({
  meetups,
  hideAllPrices,
}: {
  meetups: MeetupCardData[];
  hideAllPrices: boolean;
}) {
  if (!meetups.length) return null;
  return (
    <section className="pb-20">
      <div className="container">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2
              className={`font-semibold ${typoRoleClass("sectionTitle")}`}
              style={typoRoleStyle("sectionTitle")}
            >
              热门约搭
            </h2>
            <p
              className={`mt-2 text-[var(--muted)] ${typoRoleClass("sectionDesc")}`}
              style={typoRoleStyle("sectionDesc")}
            >
              找人一起出门：活动报名、组队集合，支持免费或收费
            </p>
          </div>
          <Link
            href="/meetup"
            className={`text-[var(--brand)] ${typoRoleClass("sectionDesc")}`}
            style={typoRoleStyle("sectionDesc")}
          >
            查看全部
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {meetups.map((meetup) => (
            <MeetupCard
              key={meetup.id}
              meetup={meetup}
              hideAllPrices={hideAllPrices}
            />
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
  meetups,
  hideAllPrices,
  loggedIn,
}: {
  order: HomeSectionEntry[];
  contact: PortalContact;
  decorate: DecorateConfig;
  modules: PortalNavLink[];
  courses: CourseCardRow[];
  meetups: MeetupCardData[];
  hideAllPrices: boolean;
  loggedIn: boolean;
}) {
  // 按 CMS 顺序渲染，并跳过 visible===false 的区块（隐藏后仍保留后台位次）
  const sectionIds: HomeSectionId[] = visibleHomeSectionIds(order);
  return (
    <div>
      {/* 找人私聊独立于 CMS 区块，始终在首页靠前展示 */}
      <HomeUserChatSearch loggedIn={loggedIn} />
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
            return (
              <HotCoursesSection
                key="courses"
                courses={courses}
                hideAllPrices={hideAllPrices}
              />
            );
          case "meetup":
            return (
              <HotMeetupsSection
                key="meetup"
                meetups={meetups}
                hideAllPrices={hideAllPrices}
              />
            );
          default: {
            const _exhaustive: never = sectionId;
            return _exhaustive;
          }
        }
      })}
    </div>
  );
}

/** 首页热门约搭：与广场同一可见规则，综合排序后取前几条 */
async function loadHomeMeetups(): Promise<MeetupCardData[]> {
  const rows = await prisma.meetup.findMany({
    where: buildMeetupPlazaWhere(),
    include: {
      host: { select: { id: true, name: true, avatarUrl: true } },
      productCourse: { select: { hidePrice: true } },
      _count: { select: { joins: true } },
    },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    take: 40,
  });
  const ranked = sortMeetupPlazaRows(
    rows.map((m) => ({
      ...m,
      maxPeople: fromMeetupPeopleDb(m.maxPeople),
      joinCount: m._count.joins,
    })),
    { sort: "score" },
  );
  return ranked.slice(0, HOME_MEETUP_TAKE).map((m) => ({
    id: m.id,
    title: m.title,
    category: m.category,
    startsAt: m.startsAt,
    timezone: m.timezone,
    place: m.place,
    maxPeople: m.maxPeople,
    coverUrl: m.coverUrl || undefined,
    status: m.status,
    joinCount: m.joinCount,
    host: { name: m.host.name },
    hostId: m.hostId,
    priceCents: m.priceCents,
    hidePrice: Boolean(m.productCourse?.hidePrice),
  }));
}

export default async function HomePage() {
  const [
    coursesRaw,
    meetups,
    decorate,
    portal,
    pageTemplates,
    hideAllPrices,
    session,
  ] = await Promise.all([
      prisma.course.findMany({
        where: {
          status: "PUBLISHED",
          // 热门课程区：课程/专栏；约搭活动走独立「热门约搭」区块
          productType: { in: ["COURSE", "COLUMN"] },
        },
        include: { teacher: true, category: true },
        orderBy: PRODUCT_PLAZA_ORDER_BY,
        take: 12,
      }),
      loadHomeMeetups(),
      getDecorateConfig(),
      getPortalConfig(),
      getPageTemplatesConfig(),
      getHideAllPricesFlag(),
      getSession(),
    ]);
  const loggedIn = Boolean(session);

  const contact = portal.contact || DEFAULT_PORTAL_CONTACT;
  const homeSectionOrder = normalizeHomeSectionOrder(
    portal.homeSectionOrder?.length
      ? portal.homeSectionOrder
      : DEFAULT_HOME_SECTION_ORDER,
  );
  const showMeetupSection = visibleHomeSectionIds(homeSectionOrder).includes(
    "meetup",
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
          <div className="w-full max-w-6xl px-3 sm:px-5 lg:px-8">
            <ContactUsPanel contact={contact} variant="hero" />
          </div>
        ) : null}
        <HomeUserChatSearch loggedIn={loggedIn} />
        <PageModulesView
          template={diyHome!}
          hideAllPrices={hideAllPrices}
        />
        {/* DIY 模块未内置约搭：区块开启时在 DIY 内容后补热门约搭 */}
        {showMeetupSection ? (
          <HotMeetupsSection
            meetups={meetups}
            hideAllPrices={hideAllPrices}
          />
        ) : null}
        {showContact && !contactBefore ? (
          <div className="w-full max-w-6xl px-3 sm:px-5 lg:px-8">
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
      meetups={meetups}
      hideAllPrices={hideAllPrices}
      loggedIn={loggedIn}
    />
  );
}

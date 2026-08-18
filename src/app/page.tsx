import Link from "next/link";
import { HomeUserChatSearch } from "@/components/chat/home-user-chat-search";
import { ConfigurableLink } from "@/components/configurable-link";
import { ContactUsPanel } from "@/components/contact-us-panel";
import { HomeContactAndDownloads } from "@/components/client-downloads-panel";
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
import { resolveContentText } from "@/lib/i18n/content-resolve";
import { getRequestLocaleContext } from "@/lib/i18n/get-request-locale";
import {
  localizeCourseCardFields,
  localizeMeetupCardFields,
} from "@/lib/i18n/localize-entities";
import { translateMessage } from "@/lib/i18n/messages";
import {
  getDecorateConfig,
  getHideAllPricesFlag,
  getHideSocialChatFlag,
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
      <HomeContactAndDownloads
        contactPanel={<ContactUsPanel contact={contact} variant="hero" />}
      />
    </section>
  );
}

function HeroSection({
  decorate,
  heroHeadline,
  heroHeadlineEn,
  heroSubtext,
  heroSubtextEn,
  brandName,
  brandNameEn,
  primaryLabel,
  primaryLabelEn,
  secondaryLabel,
  secondaryLabelEn,
}: {
  decorate: DecorateConfig;
  heroHeadline: string;
  heroHeadlineEn?: string;
  heroSubtext: string;
  heroSubtextEn?: string;
  brandName: string;
  brandNameEn?: string;
  primaryLabel: string;
  primaryLabelEn?: string;
  secondaryLabel: string;
  secondaryLabelEn?: string;
}) {
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
              ariaLabel={brandName || "品牌 Logo"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={brandName || "歪歪艾斯"}
                className="h-20 w-auto max-w-[min(100%,420px)] object-contain sm:h-24 md:h-28"
              />
            </ConfigurableLink>
            {decorate.showBrandText ? (
              <p
                className={`brand-mark text-[var(--ink)] ${typoRoleClass("heroTitle")}`}
                style={typoRoleStyle("heroTitle")}
                title={brandNameEn || undefined}
              >
                {brandName}
              </p>
            ) : null}
          </div>
          <h1
            className={`max-w-3xl font-semibold leading-tight ${typoRoleClass("heroTitle")}`}
            style={typoRoleStyle("heroTitle")}
            title={heroHeadlineEn || undefined}
          >
            {heroHeadline}
          </h1>
          <p
            className={`max-w-2xl leading-7 text-[var(--muted)] ${typoRoleClass("heroSubtext")}`}
            style={typoRoleStyle("heroSubtext")}
            title={heroSubtextEn || undefined}
          >
            {heroSubtext}
          </p>
          <div className="flex flex-wrap gap-3">
            {primaryCta.href ? (
              <ConfigurableLink
                href={primaryCta.href}
                openInNewTab={Boolean(primaryCta.openInNewTab)}
                className="btn btn-primary touch-manipulation"
                title={primaryLabelEn || undefined}
              >
                {primaryLabel}
              </ConfigurableLink>
            ) : null}
            {secondaryCta.href ? (
              <ConfigurableLink
                href={secondaryCta.href}
                openInNewTab={Boolean(secondaryCta.openInNewTab)}
                className="btn btn-fire touch-manipulation"
                title={secondaryLabelEn || undefined}
              >
                {secondaryLabel}
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
  sectionTitle,
  viewMore,
}: {
  courses: CourseCardRow[];
  hideAllPrices: boolean;
  sectionTitle: string;
  viewMore: string;
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
              {sectionTitle}
            </h2>
          </div>
          <Link
            href="/courses"
            className={`text-[var(--brand)] ${typoRoleClass("sectionDesc")}`}
            style={typoRoleStyle("sectionDesc")}
          >
            {viewMore}
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
  sectionTitle,
  viewMore,
}: {
  meetups: MeetupCardData[];
  hideAllPrices: boolean;
  sectionTitle: string;
  viewMore: string;
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
              {sectionTitle}
            </h2>
          </div>
          <Link
            href="/meetup"
            className={`text-[var(--brand)] ${typoRoleClass("sectionDesc")}`}
            style={typoRoleStyle("sectionDesc")}
          >
            {viewMore}
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
  hideSocialChat,
  loggedIn,
  heroLocalized,
  sectionLabels,
}: {
  order: HomeSectionEntry[];
  contact: PortalContact;
  decorate: DecorateConfig;
  modules: PortalNavLink[];
  courses: CourseCardRow[];
  meetups: MeetupCardData[];
  hideAllPrices: boolean;
  hideSocialChat: boolean;
  loggedIn: boolean;
  heroLocalized: {
    heroHeadline: string;
    heroHeadlineEn?: string;
    heroSubtext: string;
    heroSubtextEn?: string;
    brandName: string;
    brandNameEn?: string;
    primaryLabel: string;
    primaryLabelEn?: string;
    secondaryLabel: string;
    secondaryLabelEn?: string;
  };
  sectionLabels: {
    hotCourses: string;
    hotMeetups: string;
    viewMore: string;
  };
}) {
  // 按 CMS 顺序渲染，并跳过 visible===false 的区块（隐藏后仍保留后台位次）
  const sectionIds: HomeSectionId[] = visibleHomeSectionIds(order);
  return (
    <div>
      {/* 合规隐藏社交找人；产品/约搭咨询私信入口不在首页，不受影响 */}
      {!hideSocialChat ? (
        <HomeUserChatSearch loggedIn={loggedIn} />
      ) : null}
      {sectionIds.map((sectionId) => {
        switch (sectionId) {
          case "contact":
            return <ContactSection key="contact" contact={contact} />;
          case "hero":
            return (
              <HeroSection
                key="hero"
                decorate={decorate}
                {...heroLocalized}
              />
            );
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
                sectionTitle={sectionLabels.hotCourses}
                viewMore={sectionLabels.viewMore}
              />
            );
          case "meetup":
            return (
              <HotMeetupsSection
                key="meetup"
                meetups={meetups}
                hideAllPrices={hideAllPrices}
                sectionTitle={sectionLabels.hotMeetups}
                viewMore={sectionLabels.viewMore}
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
    meetupsRaw,
    decorate,
    portal,
    pageTemplates,
    hideAllPrices,
    hideSocialChat,
    session,
    localeCtx,
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
      getHideSocialChatFlag(),
      getSession(),
      getRequestLocaleContext(),
    ]);
  const loggedIn = Boolean(session);
  const { locale, contentLocale, bilingual } = localeCtx;
  const t = (key: string) => translateMessage(locale, key);
  const sectionLabels = {
    hotCourses: t("home.hotCourses"),
    hotMeetups: t("home.hotMeetups"),
    viewMore: t("home.viewMore"),
  };

  const contact = portal.contact || DEFAULT_PORTAL_CONTACT;
  const homeSectionOrder = normalizeHomeSectionOrder(
    portal.homeSectionOrder?.length
      ? portal.homeSectionOrder
      : DEFAULT_HOME_SECTION_ORDER,
  );
  const showMeetupSection = visibleHomeSectionIds(homeSectionOrder).includes(
    "meetup",
  );

  const coursesSigned = await withSignedCoverUrls(coursesRaw);
  const courses = await Promise.all(
    coursesSigned.map(async (course) => {
      // 站长 contentLocale=en：中文主显、英文悬浮；访客跟浏览器语言
      const loc = await localizeCourseCardFields(course, contentLocale);
      return {
        ...course,
        title: bilingual ? loc.titleSource : loc.title,
        titleSecondary:
          bilingual && loc.title !== loc.titleSource ? loc.title : undefined,
        subtitle: bilingual ? loc.subtitleSource : loc.subtitle,
        subtitleSecondary:
          bilingual && loc.subtitle !== loc.subtitleSource
            ? loc.subtitle
            : undefined,
        category: course.category
          ? { ...course.category, name: loc.categoryName || course.category.name }
          : null,
      };
    }),
  );
  const meetups = await Promise.all(
    meetupsRaw.map(async (meetup) => {
      const loc = await localizeMeetupCardFields(meetup, contentLocale);
      return {
        ...meetup,
        title: bilingual ? loc.titleSource : loc.title,
        titleSecondary:
          bilingual && loc.title !== loc.titleSource ? loc.title : undefined,
        place: bilingual ? loc.placeSource : loc.place,
        placeSecondary:
          bilingual && loc.place !== loc.placeSource ? loc.place : undefined,
      };
    }),
  );

  const [
    heroHeadline,
    heroSubtext,
    brandName,
    primaryLabel,
    secondaryLabel,
  ] = await Promise.all([
    resolveContentText({
      entityType: "decorate",
      entityId: "default",
      field: "heroHeadline",
      source: decorate.heroHeadline || "",
      locale: contentLocale,
    }),
    resolveContentText({
      entityType: "decorate",
      entityId: "default",
      field: "heroSubtext",
      source: decorate.heroSubtext || "",
      locale: contentLocale,
    }),
    resolveContentText({
      entityType: "decorate",
      entityId: "default",
      field: "brandName",
      source: decorate.brandName || "",
      locale: contentLocale,
    }),
    resolveContentText({
      entityType: "decorate",
      entityId: "default",
      field: "heroPrimaryCta.label",
      source:
        decorate.heroPrimaryCta?.label || DEFAULT_HERO_PRIMARY_CTA.label,
      locale: contentLocale,
    }),
    resolveContentText({
      entityType: "decorate",
      entityId: "default",
      field: "heroSecondaryCta.label",
      source:
        decorate.heroSecondaryCta?.label || DEFAULT_HERO_SECONDARY_CTA.label,
      locale: contentLocale,
    }),
  ]);
  // 站长：默认中文；英文由 Hero 的 title 悬浮（见 HeroSection title 属性）
  const heroLocalized = {
    heroHeadline: bilingual ? heroHeadline.source : heroHeadline.text,
    heroHeadlineEn:
      bilingual && heroHeadline.text !== heroHeadline.source
        ? heroHeadline.text
        : "",
    heroSubtext: bilingual ? heroSubtext.source : heroSubtext.text,
    heroSubtextEn:
      bilingual && heroSubtext.text !== heroSubtext.source
        ? heroSubtext.text
        : "",
    brandName: bilingual ? brandName.source : brandName.text,
    brandNameEn:
      bilingual && brandName.text !== brandName.source ? brandName.text : "",
    primaryLabel: bilingual ? primaryLabel.source : primaryLabel.text,
    primaryLabelEn:
      bilingual && primaryLabel.text !== primaryLabel.source
        ? primaryLabel.text
        : "",
    secondaryLabel: bilingual ? secondaryLabel.source : secondaryLabel.text,
    secondaryLabelEn:
      bilingual && secondaryLabel.text !== secondaryLabel.source
        ? secondaryLabel.text
        : "",
  };

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
          <HomeContactAndDownloads
            contactPanel={<ContactUsPanel contact={contact} variant="hero" />}
          />
        ) : null}
        {!hideSocialChat ? (
          <HomeUserChatSearch loggedIn={loggedIn} />
        ) : null}
        <PageModulesView
          template={diyHome!}
          hideAllPrices={hideAllPrices}
        />
        {/* DIY 模块未内置约搭：区块开启时在 DIY 内容后补热门约搭 */}
        {showMeetupSection ? (
          <HotMeetupsSection
            meetups={meetups}
            hideAllPrices={hideAllPrices}
            sectionTitle={sectionLabels.hotMeetups}
            viewMore={sectionLabels.viewMore}
          />
        ) : null}
        {showContact && !contactBefore ? (
          <HomeContactAndDownloads
            contactPanel={<ContactUsPanel contact={contact} variant="hero" />}
          />
        ) : null}
      </div>
    );
  }

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
      hideSocialChat={hideSocialChat}
      loggedIn={loggedIn}
      heroLocalized={heroLocalized}
      sectionLabels={sectionLabels}
    />
  );
}

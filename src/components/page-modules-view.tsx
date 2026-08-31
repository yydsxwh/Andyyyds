import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { CourseCard } from "@andyyyds/courses/components/course-card";
import { PageModuleCountdown } from "@/components/page-module-countdown";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { PRODUCT_PLAZA_ORDER_BY } from "@andyyyds/shared/product-display-order";
import { isAdmin } from "@andyyyds/shared/roles";
import { typoRoleClass, typoRoleStyle } from "@andyyyds/shared/site-typography";
import type {
  AnimationModuleProps,
  AudioModuleProps,
  BannerModuleProps,
  BlankCardModuleProps,
  ButtonModuleProps,
  CategoriesModuleProps,
  CouponModuleProps,
  CoursesModuleProps,
  DividerModuleProps,
  DualColumnModuleProps,
  EmbedModuleProps,
  FaqModuleProps,
  GalleryModuleProps,
  HeadingModuleProps,
  IconRowModuleProps,
  ImageModuleProps,
  LinkCardModuleProps,
  MarqueeModuleProps,
  NoticeModuleProps,
  PageModule,
  PageModuleLayout,
  PageSlotId,
  PageSlotModuleProps,
  PageTemplate,
  RichtextModuleProps,
  SearchModuleProps,
  SocialLinksModuleProps,
  SpacerModuleProps,
  StatsModuleProps,
  TeachersModuleProps,
  TestimonialModuleProps,
  VideoModuleProps,
} from "@andyyyds/shared/page-templates";
import {
  isStudioOnlyRichtextHint,
  resolveModuleLayout,
} from "@andyyyds/shared/page-templates";
import { getHideAllPricesFlag } from "@andyyyds/shared/site-settings";
import { withSignedCoverUrls } from "@andyyyds/shared/storage";

export type PageModuleSlots = Partial<Record<PageSlotId, ReactNode>>;

type CourseCardData = {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  coverUrl: string;
  price: number;
  originalPrice: number;
  studentCount: number;
  rating: number;
  isFree: boolean;
  hidePrice?: boolean;
  productType?: string;
  isPinned?: boolean;
  isFeatured?: boolean;
  teacher: { name: string };
  category: { name: string } | null;
};

type CategoryItem = { id: string; name: string; slug: string };
type TeacherItem = {
  id: string;
  name: string;
  bio: string;
  avatarUrl: string;
  courseCount: number;
};

async function loadCourses(props: CoursesModuleProps): Promise<CourseCardData[]> {
  let categoryId: string | undefined;
  if (props.categorySlug.trim()) {
    const cat = await prisma.category.findUnique({
      where: { slug: props.categorySlug.trim() },
      select: { id: true },
    });
    categoryId = cat?.id;
  }

  const rows = await prisma.course.findMany({
    where: {
      status: "PUBLISHED",
      productType: { in: ["COURSE", "COLUMN"] },
      ...(categoryId ? { categoryId } : {}),
    },
    include: { teacher: true, category: true },
    orderBy: PRODUCT_PLAZA_ORDER_BY,
    take: props.limit,
  });
  return withSignedCoverUrls(rows);
}

async function loadCategories(): Promise<CategoryItem[]> {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    take: 24,
    select: { id: true, name: true, slug: true },
  });
}

async function loadTeachers(limit: number): Promise<TeacherItem[]> {
  const teachers = await prisma.user.findMany({
    where: {
      role: "TEACHER",
      courses: { some: { status: "PUBLISHED" } },
    },
    select: {
      id: true,
      name: true,
      bio: true,
      avatarUrl: true,
      _count: { select: { courses: true } },
    },
    orderBy: { name: "asc" },
    take: limit,
  });
  return teachers.map((t) => ({
    id: t.id,
    name: t.name,
    bio: t.bio,
    avatarUrl: t.avatarUrl,
    courseCount: t._count.courses,
  }));
}

function flowWidthStyle(layout: PageModuleLayout): CSSProperties {
  // 宽度交给 .page-mod-col-half（窄屏通栏，≥641px 各 50%），避免 inline 50% 盖掉媒体查询
  if (layout.column === "left" || layout.column === "right") {
    return { boxSizing: "border-box" };
  }
  return { width: "100%", boxSizing: "border-box" };
}

function flowWidthClass(layout: PageModuleLayout): string {
  if (layout.column === "left" || layout.column === "right") {
    return "page-mod-col page-mod-col-half min-w-0";
  }
  return "page-mod-col min-w-0 w-full";
}

function absoluteStyle(layout: PageModuleLayout): CSSProperties {
  return {
    position: "absolute",
    left: `${layout.x}%`,
    top: `${layout.y}px`,
    width: `${layout.width}%`,
    zIndex: layout.zIndex,
    boxSizing: "border-box",
  };
}

function SearchBlock({ props }: { props: SearchModuleProps }) {
  return (
    <form action="/courses" method="get" className="px-3 py-2">
      <input
        type="search"
        name="q"
        placeholder={props.placeholder || "搜索课程 / 资料"}
        className="w-full rounded-2xl border border-[var(--line)] bg-white/90 px-4 py-3 text-sm outline-none focus:border-[var(--brand)]"
        aria-label="搜索"
      />
    </form>
  );
}

function BannerBlock({ props }: { props: BannerModuleProps }) {
  const slides = props.slides.filter((s) => s.url);
  if (!slides.length) return null;
  return (
    <div className="px-3 py-2">
      <div
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl"
        style={{ minHeight: props.height }}
      >
        {slides.map((slide) => {
          const img = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={slide.url}
              alt={slide.alt || "幻灯图"}
              className="h-full w-full object-cover"
              style={{ height: props.height }}
            />
          );
          return (
            <div
              key={slide.id}
              className="w-full min-w-full snap-center overflow-hidden rounded-2xl bg-[var(--bg-deep)]"
            >
              {slide.href ? (
                <Link href={slide.href} className="block">
                  {img}
                </Link>
              ) : (
                img
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ImageBlock({ props }: { props: ImageModuleProps }) {
  if (!props.url) return null;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={props.url}
      alt={props.alt || "图片"}
      className="w-full object-cover"
      style={{ borderRadius: props.radius }}
    />
  );
  return (
    <div className="px-3 py-2">
      {props.href ? <Link href={props.href}>{img}</Link> : img}
    </div>
  );
}

function CoursesBlock({
  props,
  courses,
  hideAllPrices,
}: {
  props: CoursesModuleProps;
  courses: CourseCardData[];
  hideAllPrices: boolean;
}) {
  return (
    <section className="px-3 py-3">
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{props.title}</h2>
          {props.subtitle ? (
            <p className="mt-1 text-xs text-[var(--muted)]">{props.subtitle}</p>
          ) : null}
        </div>
        <Link href="/courses" className="text-xs text-[var(--brand)]">
          全部
        </Link>
      </div>
      {courses.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              hideAllPrices={hideAllPrices}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          暂无已发布课程
        </p>
      )}
    </section>
  );
}

function CategoriesBlock({
  props,
  categories,
}: {
  props: CategoriesModuleProps;
  categories: CategoryItem[];
}) {
  return (
    <section className="px-3 py-3">
      <h2 className="mb-3 text-lg font-semibold">{props.title}</h2>
      {categories.length ? (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/courses?category=${encodeURIComponent(cat.slug)}`}
              className={`rounded-full border border-[var(--line)] bg-white/80 px-3 py-2 touch-manipulation ${typoRoleClass("filterTag")}`}
              style={typoRoleStyle("filterTag")}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">暂无分类</p>
      )}
    </section>
  );
}

function TeachersBlock({
  props,
  teachers,
}: {
  props: TeachersModuleProps;
  teachers: TeacherItem[];
}) {
  return (
    <section className="px-3 py-3">
      <h2 className="mb-3 text-lg font-semibold">{props.title}</h2>
      {teachers.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {teachers.map((t) => (
            <div key={t.id} className="surface rounded-2xl p-3 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[var(--bg-deep)] text-lg font-semibold text-[var(--brand)]">
                {t.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.avatarUrl}
                    alt={t.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  t.name.slice(0, 1)
                )}
              </div>
              <div className="mt-2 truncate text-sm font-medium">{t.name}</div>
              <div className="mt-0.5 text-xs text-[var(--muted)]">
                {t.courseCount} 门课
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">暂无名师</p>
      )}
    </section>
  );
}

function SpacerBlock({ props }: { props: SpacerModuleProps }) {
  return <div style={{ height: props.height }} aria-hidden />;
}

function RichtextBlock({
  props,
  viewerIsAdmin,
}: {
  props: RichtextModuleProps;
  viewerIsAdmin: boolean;
}) {
  if (!props.html?.trim()) return null;
  // 编辑器占位提示：游客/学员/商家/代理不可见，仅站长可见
  if (isStudioOnlyRichtextHint(props.html) && !viewerIsAdmin) return null;
  return (
    <div
      className="prose-page px-4 py-3 text-sm leading-7 text-[var(--ink)] [&_a]:text-[var(--brand)] [&_img]:max-w-full [&_p]:my-2"
      dangerouslySetInnerHTML={{ __html: props.html }}
    />
  );
}

function VideoBlock({ props }: { props: VideoModuleProps }) {
  if (!props.url) {
    return (
      <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">
        暂未配置视频地址
      </p>
    );
  }
  return (
    <div className="px-3 py-2">
      {props.title ? (
        <div className="mb-2 text-sm font-medium">{props.title}</div>
      ) : null}
      {/* playsInline + controls：微信内嵌浏览器可播优先 */}
      <video
        className="w-full rounded-2xl bg-black"
        src={props.url}
        poster={props.poster || undefined}
        controls
        playsInline
        preload="metadata"
      />
    </div>
  );
}

function AnimationBlock({ props }: { props: AnimationModuleProps }) {
  const presetClass =
    props.cssPreset === "pulse"
      ? "animate-pulse"
      : props.cssPreset === "fade"
        ? "animate-[fadeIn_2s_ease-in-out_infinite]"
        : props.cssPreset === "shine"
          ? "animate-pulse"
          : "animate-bounce";

  if (props.kind === "gif" || props.kind === "lottie") {
    if (!props.src) {
      return (
        <div
          className={`mx-3 my-2 flex items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-sm text-[var(--brand)] ${presetClass}`}
          style={{ height: props.height }}
        >
          {props.title || "动效"}
        </div>
      );
    }
    // Lottie JSON 用 iframe/object 成本高；有 URL 时按图展示，CSS 加动效
    return (
      <div className="px-3 py-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={props.src}
          alt={props.title || "动画"}
          className={`w-full rounded-2xl object-cover ${presetClass}`}
          style={{ height: props.height }}
        />
      </div>
    );
  }

  return (
    <div
      className={`mx-3 my-2 flex items-center justify-center rounded-2xl bg-gradient-to-r from-[var(--brand-soft)] to-white text-base font-semibold text-[var(--brand)] ${presetClass}`}
      style={{ height: props.height }}
    >
      {props.title || "动效横幅"}
    </div>
  );
}

function ButtonBlock({ props }: { props: ButtonModuleProps }) {
  const align =
    props.align === "left"
      ? "justify-start"
      : props.align === "right"
        ? "justify-end"
        : "justify-center";
  const variant =
    props.variant === "outline"
      ? "border border-[var(--brand)] bg-white text-[var(--brand)]"
      : props.variant === "soft"
        ? "bg-[var(--brand-soft)] text-[var(--brand)]"
        : "btn-primary text-white";
  return (
    <div className={`flex px-3 py-3 ${align}`}>
      <Link
        href={props.href || "#"}
        className={`btn inline-flex min-h-11 items-center rounded-2xl px-5 text-sm font-medium ${variant}`}
      >
        {props.text}
      </Link>
    </div>
  );
}

function DualColumnBlock({ props }: { props: DualColumnModuleProps }) {
  const img = props.rightImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={props.rightImage}
      alt=""
      className="h-full w-full rounded-2xl object-cover"
    />
  ) : null;
  return (
    <section className="grid gap-3 px-3 py-3 sm:grid-cols-2">
      <div>
        {props.leftTitle ? (
          <h3 className="mb-2 text-base font-semibold">{props.leftTitle}</h3>
        ) : null}
        <div
          className="text-sm leading-6 text-[var(--ink)] [&_p]:my-1"
          dangerouslySetInnerHTML={{ __html: props.leftHtml || "" }}
        />
      </div>
      <div className="min-h-[120px] overflow-hidden rounded-2xl bg-[var(--bg-deep)]">
        {props.rightHref && img ? (
          <Link href={props.rightHref}>{img}</Link>
        ) : (
          img
        )}
      </div>
    </section>
  );
}

function DividerBlock({ props }: { props: DividerModuleProps }) {
  return (
    <div className="px-4 py-3" aria-hidden>
      <hr
        style={{
          borderStyle: props.style,
          borderColor: props.color,
          borderWidth: 0,
          borderTopWidth: props.thickness,
        }}
      />
    </div>
  );
}

function HeadingBlock({ props }: { props: HeadingModuleProps }) {
  const align =
    props.align === "center"
      ? "text-center"
      : props.align === "right"
        ? "text-right"
        : "text-left";
  const Tag = (`h${props.level}` as "h1" | "h2" | "h3");
  const size =
    props.level === 1
      ? "text-2xl"
      : props.level === 2
        ? "text-xl"
        : "text-lg";
  return (
    <Tag className={`px-4 py-3 font-semibold ${size} ${align}`}>
      {props.text}
    </Tag>
  );
}

function NoticeBlock({ props }: { props: NoticeModuleProps }) {
  const tone =
    props.tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : props.tone === "success"
        ? "border-emerald-300 bg-emerald-50 text-emerald-900"
        : "border-sky-300 bg-sky-50 text-sky-900";
  return (
    <div className={`mx-3 my-2 rounded-2xl border px-3 py-2.5 text-sm ${tone}`}>
      {props.text}
    </div>
  );
}

function LinkCardBlock({ props }: { props: LinkCardModuleProps }) {
  const inner = (
    <div className="flex gap-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-white/90">
      {props.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={props.imageUrl}
          alt=""
          className="h-24 w-24 shrink-0 object-cover"
        />
      ) : null}
      <div className="min-w-0 flex-1 py-3 pr-3">
        <div className="truncate font-medium">{props.title}</div>
        {props.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
            {props.description}
          </p>
        ) : null}
      </div>
    </div>
  );
  return (
    <div className="px-3 py-2">
      {props.href ? <Link href={props.href}>{inner}</Link> : inner}
    </div>
  );
}

function AudioBlock({ props }: { props: AudioModuleProps }) {
  return (
    <div className="px-3 py-3">
      {props.title ? (
        <div className="mb-2 text-sm font-medium">{props.title}</div>
      ) : null}
      {props.url ? (
        <audio className="w-full" src={props.url} controls preload="metadata" />
      ) : (
        <p className="text-sm text-[var(--muted)]">暂未配置音频</p>
      )}
    </div>
  );
}

function IconRowBlock({ props }: { props: IconRowModuleProps }) {
  return (
    <div className="grid grid-cols-4 gap-2 px-3 py-3">
      {props.items.map((item) => (
        <Link
          key={item.id}
          href={item.href || "#"}
          className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white/80 text-center"
        >
          <span className="text-xl" aria-hidden>
            {item.icon}
          </span>
          <span className="text-[11px]">{item.label}</span>
        </Link>
      ))}
    </div>
  );
}

function FaqBlock({ props }: { props: FaqModuleProps }) {
  return (
    <section className="px-3 py-3">
      {props.title ? (
        <h3 className="mb-2 text-base font-semibold">{props.title}</h3>
      ) : null}
      <div className="space-y-2">
        {props.items.map((item) => (
          <details
            key={item.id}
            className="rounded-2xl border border-[var(--line)] bg-white/90 px-3 py-2"
          >
            <summary className="cursor-pointer list-none text-sm font-medium marker:content-none">
              {item.question}
            </summary>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

function TestimonialBlock({ props }: { props: TestimonialModuleProps }) {
  return (
    <section className="px-3 py-3">
      {props.title ? (
        <h3 className="mb-3 text-base font-semibold">{props.title}</h3>
      ) : null}
      <div className="space-y-3">
        {props.items.map((item) => (
          <blockquote
            key={item.id}
            className="rounded-2xl border border-[var(--line)] bg-white/90 p-3"
          >
            <p className="text-sm leading-6">“{item.quote}”</p>
            <footer className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
              {item.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.avatar}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-deep)]">
                  {item.name.slice(0, 1)}
                </span>
              )}
              {item.name}
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}

function CouponBlock({ props }: { props: CouponModuleProps }) {
  return (
    <div className="px-3 py-2">
      <Link
        href={props.href || "/courses"}
        className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[var(--brand)] bg-[var(--brand-soft)] px-4 py-3"
      >
        <div>
          <div className="font-semibold text-[var(--brand)]">{props.title}</div>
          {props.subtitle ? (
            <div className="mt-0.5 text-xs text-[var(--muted)]">
              {props.subtitle}
            </div>
          ) : null}
        </div>
        <span className="shrink-0 text-sm text-[var(--brand)]">去看看 →</span>
      </Link>
    </div>
  );
}

function GalleryBlock({ props }: { props: GalleryModuleProps }) {
  return (
    <div
      className={`grid gap-2 px-3 py-2 ${
        props.columns === 3 ? "grid-cols-3" : "grid-cols-2"
      }`}
    >
      {props.images.map((img) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={img.id}
          src={img.url}
          alt={img.alt || ""}
          className="aspect-square w-full rounded-xl object-cover"
        />
      ))}
    </div>
  );
}

function EmbedBlock({ props }: { props: EmbedModuleProps }) {
  if (!props.url || !/^https:\/\//i.test(props.url)) {
    return (
      <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">
        请配置 https 嵌入地址
      </p>
    );
  }
  return (
    <div className="px-3 py-2">
      <iframe
        title={props.title || "嵌入内容"}
        src={props.url}
        className="w-full rounded-2xl border border-[var(--line)] bg-white"
        style={{ height: props.height }}
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </div>
  );
}

function MarqueeBlock({ props }: { props: MarqueeModuleProps }) {
  const duration = Math.max(8, 120 - props.speed);
  return (
    <div className="overflow-hidden border-y border-[var(--line)] bg-[var(--bg-deep)] py-2">
      <div
        className="whitespace-nowrap text-sm"
        style={{
          animation: `pageMarquee ${duration}s linear infinite`,
        }}
      >
        <span className="inline-block px-8">{props.text}</span>
        <span className="inline-block px-8" aria-hidden>
          {props.text}
        </span>
      </div>
      <style>{`
        @keyframes pageMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes fadeIn {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function SocialLinksBlock({ props }: { props: SocialLinksModuleProps }) {
  return (
    <div className="flex flex-wrap gap-2 px-3 py-3">
      {props.items.map((item) => (
        <Link
          key={item.id}
          href={item.href || "#"}
          className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function StatsBlock({ props }: { props: StatsModuleProps }) {
  return (
    <div className="grid grid-cols-3 gap-2 px-3 py-3">
      {props.items.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl bg-white/90 px-2 py-3 text-center"
        >
          <div className="text-lg font-semibold text-[var(--brand)]">
            {item.value}
          </div>
          <div className="mt-1 text-[11px] text-[var(--muted)]">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function BlankCardBlock({ props }: { props: BlankCardModuleProps }) {
  return (
    <div className="px-3 py-2">
      <div
        className="rounded-2xl border border-[var(--line)] bg-white/90 px-4 py-3"
        style={{ minHeight: props.minHeight }}
      >
        {props.title ? (
          <div className="font-medium">{props.title}</div>
        ) : null}
        {props.body ? (
          <p className="mt-1 text-sm text-[var(--muted)]">{props.body}</p>
        ) : null}
      </div>
    </div>
  );
}

async function ModuleBlock({
  module,
  slots,
  viewerIsAdmin,
  hideAllPrices,
}: {
  module: PageModule;
  slots?: PageModuleSlots;
  viewerIsAdmin: boolean;
  hideAllPrices: boolean;
}) {
  switch (module.type) {
    case "search":
      return <SearchBlock props={module.props as SearchModuleProps} />;
    case "banner":
      return <BannerBlock props={module.props as BannerModuleProps} />;
    case "image":
      return <ImageBlock props={module.props as ImageModuleProps} />;
    case "courses": {
      const courses = await loadCourses(module.props as CoursesModuleProps);
      return (
        <CoursesBlock
          props={module.props as CoursesModuleProps}
          courses={courses}
          hideAllPrices={hideAllPrices}
        />
      );
    }
    case "categories": {
      const categories = await loadCategories();
      return (
        <CategoriesBlock
          props={module.props as CategoriesModuleProps}
          categories={categories}
        />
      );
    }
    case "teachers": {
      const teachers = await loadTeachers(
        (module.props as TeachersModuleProps).limit,
      );
      return (
        <TeachersBlock
          props={module.props as TeachersModuleProps}
          teachers={teachers}
        />
      );
    }
    case "spacer":
      return <SpacerBlock props={module.props as SpacerModuleProps} />;
    case "richtext":
      return (
        <RichtextBlock
          props={module.props as RichtextModuleProps}
          viewerIsAdmin={viewerIsAdmin}
        />
      );
    case "pageSlot": {
      const slot = (module.props as PageSlotModuleProps).slot;
      const node = slots?.[slot];
      if (!node) {
        // 缺内容提示仅站长可见，避免前台出现编辑器口吻文案
        if (!viewerIsAdmin) return null;
        return (
          <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">
            功能区「{slot}」未在本页提供内容
          </p>
        );
      }
      return <div className="page-slot">{node}</div>;
    }
    case "video":
      return <VideoBlock props={module.props as VideoModuleProps} />;
    case "animation":
      return <AnimationBlock props={module.props as AnimationModuleProps} />;
    case "button":
      return <ButtonBlock props={module.props as ButtonModuleProps} />;
    case "dualColumn":
      return <DualColumnBlock props={module.props as DualColumnModuleProps} />;
    case "divider":
      return <DividerBlock props={module.props as DividerModuleProps} />;
    case "heading":
      return <HeadingBlock props={module.props as HeadingModuleProps} />;
    case "notice":
      return <NoticeBlock props={module.props as NoticeModuleProps} />;
    case "countdown": {
      const p = module.props as { title: string; targetAt: string };
      return <PageModuleCountdown title={p.title} targetAt={p.targetAt} />;
    }
    case "linkCard":
      return <LinkCardBlock props={module.props as LinkCardModuleProps} />;
    case "audio":
      return <AudioBlock props={module.props as AudioModuleProps} />;
    case "iconRow":
      return <IconRowBlock props={module.props as IconRowModuleProps} />;
    case "faq":
      return <FaqBlock props={module.props as FaqModuleProps} />;
    case "testimonial":
      return <TestimonialBlock props={module.props as TestimonialModuleProps} />;
    case "coupon":
      return <CouponBlock props={module.props as CouponModuleProps} />;
    case "gallery":
      return <GalleryBlock props={module.props as GalleryModuleProps} />;
    case "embed":
      return <EmbedBlock props={module.props as EmbedModuleProps} />;
    case "marquee":
      return <MarqueeBlock props={module.props as MarqueeModuleProps} />;
    case "socialLinks":
      return <SocialLinksBlock props={module.props as SocialLinksModuleProps} />;
    case "stats":
      return <StatsBlock props={module.props as StatsModuleProps} />;
    case "blankCard":
      return <BlankCardBlock props={module.props as BlankCardModuleProps} />;
    default:
      return null;
  }
}

/**
 * 前台按模板模块渲染。
 * slots：导航页传入的业务主体，由 pageSlot 模块嵌入。
 * layout：旧数据无 layout → 文档流；absolute 叠在相对容器上。
 */
export async function PageModulesView({
  template,
  slots,
  hideAllPrices: hideAllPricesProp,
}: {
  template: PageTemplate;
  slots?: PageModuleSlots;
  hideAllPrices?: boolean;
}) {
  const session = await getSession();
  const viewerIsAdmin = Boolean(session && isAdmin(session.role));
  const hideAllPrices =
    hideAllPricesProp === undefined
      ? await getHideAllPricesFlag()
      : hideAllPricesProp;
  const bg = template.backgroundUrl?.trim();
  const flowModules = template.modules.filter(
    (m) => resolveModuleLayout(m.layout).mode !== "absolute",
  );
  const absoluteModules = template.modules.filter(
    (m) => resolveModuleLayout(m.layout).mode === "absolute",
  );
  const absMaxY = absoluteModules.reduce((max, m) => {
    const L = resolveModuleLayout(m.layout);
    return Math.max(max, L.y + 120);
  }, 0);

  return (
    <div
      className="container pb-16"
      style={
        bg
          ? {
              backgroundImage: `url(${bg})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
              backgroundRepeat: "no-repeat",
            }
          : undefined
      }
    >
      <div
        className={`relative ${bg ? "bg-white/85 backdrop-blur-[2px]" : ""}`}
        style={
          absoluteModules.length
            ? { minHeight: Math.max(absMaxY, 120) }
            : undefined
        }
      >
        <div className="flex flex-wrap">
          {flowModules.map((module) => {
            const layout = resolveModuleLayout(module.layout);
            return (
              <div
                key={module.id}
                className={flowWidthClass(layout)}
                style={flowWidthStyle(layout)}
              >
                <ModuleBlock
                  module={module}
                  slots={slots}
                  viewerIsAdmin={viewerIsAdmin}
                  hideAllPrices={hideAllPrices}
                />
              </div>
            );
          })}
        </div>
        {absoluteModules.map((module) => {
          const layout = resolveModuleLayout(module.layout);
          return (
            <div key={module.id} className="page-mod-absolute" style={absoluteStyle(layout)}>
              <ModuleBlock
                module={module}
                slots={slots}
                viewerIsAdmin={viewerIsAdmin}
                hideAllPrices={hideAllPrices}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 是否应使用 DIY 布局（有模块才接管，避免空模板盖掉现有首页） */
export function shouldUseDiyLayout(template: PageTemplate | null | undefined) {
  return Boolean(template && template.modules.length > 0);
}

import Link from "next/link";
import { productDetailPath, productTypeLabel } from "@/lib/product-types";
import { formatPrice } from "@/lib/utils";

type CourseCardProps = {
  course: {
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
    productType?: string;
    isPinned?: boolean;
    isFeatured?: boolean;
    teacher: { name: string };
    category: { name: string } | null;
  };
};

export function CourseCard({ course }: CourseCardProps) {
  const type = course.productType || "COURSE";
  const kindLabel = productTypeLabel(type);
  const countLabel = type === "MATERIAL" ? "人已购" : "人在学";

  return (
    <Link
      href={productDetailPath(course.slug, type)}
      className="surface-soft tilt-card group overflow-hidden rounded-[28px] transition duration-300 hover:-translate-y-1"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--bg-deep)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={course.coverUrl}
          alt={course.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        {/* 置顶/精华角标：站长在产品管理里开关，前台列表可见 */}
        {course.isPinned || course.isFeatured ? (
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {course.isPinned ? (
              <span className="rounded-md bg-amber-500/95 px-2 py-0.5 text-xs font-medium text-white shadow-sm">
                置顶
              </span>
            ) : null}
            {course.isFeatured ? (
              <span className="rounded-md bg-rose-500/95 px-2 py-0.5 text-xs font-medium text-white shadow-sm">
                精华
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
          <span>
            {kindLabel} · {course.category?.name ?? "综合"}
          </span>
          <span>★ {course.rating.toFixed(1)}</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold leading-snug">{course.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
            {course.subtitle}
          </p>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-[var(--brand)]">
              {course.isFree ? "免费" : formatPrice(course.price)}
            </div>
            {!course.isFree && course.originalPrice > course.price ? (
              <div className="text-xs text-[var(--muted)] line-through">
                {formatPrice(course.originalPrice)}
              </div>
            ) : null}
          </div>
          <div className="text-right text-xs text-[var(--muted)]">
            <div>{course.teacher.name}</div>
            <div>
              {course.studentCount} {countLabel}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

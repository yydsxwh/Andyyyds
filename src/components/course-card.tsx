import Link from "next/link";
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
    teacher: { name: string };
    category: { name: string } | null;
  };
};

export function CourseCard({ course }: CourseCardProps) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="surface group overflow-hidden rounded-[28px] transition duration-300 hover:-translate-y-1"
    >
      <div className="aspect-[16/10] overflow-hidden bg-[var(--bg-deep)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={course.coverUrl}
          alt={course.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
          <span>{course.category?.name ?? "综合"}</span>
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
            <div>{course.studentCount} 人在学</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

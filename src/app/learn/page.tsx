import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LearnHomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.id },
    include: {
      course: { include: { teacher: true, category: true } },
      progress: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="container py-12">
      <h1 className="text-3xl font-semibold">我的学习</h1>
      <p className="mt-2 text-[var(--muted)]">继续上次的进度，或打开已购课程</p>

      <div className="mt-8 grid gap-5">
        {enrollments.map((item) => {
          const done = item.progress.filter((p) => p.completed).length;
          return (
            <Link
              key={item.id}
              href={`/learn/${item.course.slug}`}
              className="surface flex flex-col gap-4 rounded-[28px] p-5 sm:flex-row sm:items-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.course.coverUrl}
                alt={item.course.title}
                className="h-28 w-full rounded-2xl object-cover sm:h-24 sm:w-40"
              />
              <div className="flex-1">
                <h2 className="text-lg font-semibold">{item.course.title}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {item.course.teacher.name} · 已完成 {done} 课节
                </p>
              </div>
              <span className="btn btn-primary">继续学习</span>
            </Link>
          );
        })}
      </div>

      {enrollments.length === 0 ? (
        <div className="surface mt-8 rounded-[28px] p-10 text-center">
          <p className="text-[var(--muted)]">还没有课程，去广场挑一门吧</p>
          <Link href="/courses" className="btn btn-primary mt-4 inline-flex">
            去课程广场
          </Link>
        </div>
      ) : null}
    </div>
  );
}

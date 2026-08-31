import Link from "next/link";
import { ForumAccountBar } from "@/components/forum-account-bar";
import { ForumNoticeBar } from "@/components/forum-notice-bar";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageForum } from "@/lib/roles";
import { getPublicForumNotice } from "@/lib/forum-settings";
import { resolveStoredAccessUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "大学论坛",
  description: "按高校分区交流：日常、美食、选课、二手、跑腿、资料与交友",
};

export default async function ForumHomePage() {
  const session = await getSession();
  const notice = await getPublicForumNotice();
  const universities = await prisma.forumUniversity.findMany({
    where: { enabled: true },
    include: {
      _count: {
        select: {
          members: true,
          posts: { where: { status: "PUBLISHED" } },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const cards = await Promise.all(
    universities.map(async (uni) => ({
      ...uni,
      logoUrl: uni.logoUrl ? await resolveStoredAccessUrl(uni.logoUrl) : "",
    })),
  );

  return (
    <NavPageTemplateShell type="forum">
      <div className="container space-y-6 py-10 sm:py-12">
        {notice ? <ForumNoticeBar notice={notice} /> : null}
        <header className="space-y-2">
          <p className="text-sm font-medium text-[var(--brand)]">大学论坛</p>
          <h1 className="brand-mark text-3xl font-semibold sm:text-4xl">
            选一所学校，和同学聊起来
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
            论坛和全站同账号。用网站已有登录即可，不必再注册论坛号。加入高校后可发帖；专区覆盖日常、美食、选课、二手、跑腿、资料和交友。支持点赞、收藏、分享、评论和蹲蹲后续。
          </p>
          <ForumAccountBar
            loggedIn={Boolean(session)}
            name={session?.name}
            loginNext="/forum"
          />
          <div className="flex flex-wrap gap-3">
            {session ? (
              <Link
                href="/forum/mine"
                className="btn btn-secondary inline-flex min-h-11 items-center px-4 text-sm"
              >
                我的帖子 / 草稿 / 收藏
              </Link>
            ) : (
              <Link
                href="/login?next=%2Fforum"
                className="btn btn-primary inline-flex min-h-11 items-center px-4 text-sm"
              >
                用网站账号登录
              </Link>
            )}
            {session && canManageForum(session) ? (
              <Link
                href="/studio/forum"
                className="btn btn-secondary inline-flex min-h-11 items-center px-4 text-sm"
              >
                管理高校分区
              </Link>
            ) : null}
          </div>
        </header>

        {cards.length === 0 ? (
          <div className="surface rounded-[28px] px-6 py-12 text-center">
            <p className="text-sm text-[var(--muted)]">
              高校分区即将由站长开通。你可以用现在的网站账号登录，开通后加入即可发帖，不必另开论坛号。
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {session ? (
                <Link href="/account" className="btn btn-primary min-h-11 px-5">
                  去个人中心
                </Link>
              ) : (
                <>
                  <Link
                    href="/login?next=%2Fforum"
                    className="btn btn-primary min-h-11 px-5"
                  >
                    用网站账号登录
                  </Link>
                  <Link
                    href="/register?next=%2Fforum"
                    className="btn btn-secondary min-h-11 px-5"
                  >
                    没有账号再注册
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((uni) => (
              <Link
                key={uni.id}
                href={`/forum/${uni.slug}`}
                className="surface block rounded-[28px] p-5 transition hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3">
                  {uni.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={uni.logoUrl}
                      alt=""
                      className="h-12 w-12 rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand)]/10 text-lg font-semibold text-[var(--brand)]">
                      {uni.name.slice(0, 1)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">{uni.name}</h2>
                    <p className="text-xs text-[var(--muted)]">
                      {uni._count.members} 人 · {uni._count.posts} 帖
                    </p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                  {uni.slogan || uni.description || "点击进入本校专区"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </NavPageTemplateShell>
  );
}

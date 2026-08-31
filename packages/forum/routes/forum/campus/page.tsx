import Link from "next/link";
import { ForumCampusDirectory } from "@andyyyds/forum/components/forum-campus-directory";
import { ForumAccountBar } from "@andyyyds/forum/components/forum-account-bar";
import { ForumNoticeBar } from "@andyyyds/forum/components/forum-notice-bar";
import { ForumSectionNav } from "@andyyyds/forum/components/forum-section-nav";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { FORUM_UNIVERSITY_LIST_ORDER_BY } from "@andyyyds/forum/lib/forum-university";
import { canManageForum } from "@andyyyds/shared/roles";
import { getPublicForumNotice } from "@andyyyds/forum/lib/forum-settings";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "论坛",
  description: "按高校分区交流：日常、美食、选课、二手、跑腿、资料与交友",
};

export default async function ForumCampusPage() {
  const session = await getSession();
  const notice = await getPublicForumNotice();
  const universities = await prisma.forumUniversity.findMany({
    where: { enabled: true, kind: "UNIVERSITY" },
    include: {
      _count: {
        select: {
          members: true,
          posts: { where: { status: "PUBLISHED", audience: "PUBLIC" } },
        },
      },
    },
    orderBy: FORUM_UNIVERSITY_LIST_ORDER_BY,
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
        <header className="space-y-3">
          <Link href="/forum" className="text-sm text-[var(--brand)]">
            ← 论坛
          </Link>
          <ForumSectionNav current="UNIVERSITY" />
          <p className="text-sm font-medium text-[var(--brand)]">大学论坛</p>
          <h1 className="brand-mark text-3xl font-semibold sm:text-4xl">
            选一所学校，完成实名认证
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
            这是论坛下的高校分区。每人可实名认证一所本科、一所研究生学校，通过后在对应学校发帖。发帖可设仅本校认证用户可见。
          </p>
          <ForumAccountBar
            loggedIn={Boolean(session)}
            name={session?.name}
            loginNext="/forum/campus"
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
                href="/login?next=%2Fforum%2Fcampus"
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
          </div>
        ) : (
          <ForumCampusDirectory cards={cards} />
        )}
      </div>
    </NavPageTemplateShell>
  );
}

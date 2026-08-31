import Link from "next/link";
import { ForumAccountBar } from "@andyyyds/forum/components/forum-account-bar";
import { ForumNoticeBar } from "@andyyyds/forum/components/forum-notice-bar";
import { ForumSectionNav } from "@andyyyds/forum/components/forum-section-nav";
import { ForumSpaceDirectory } from "@andyyyds/forum/components/forum-space-directory";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { canManageForum } from "@andyyyds/shared/roles";
import { getPublicForumNotice } from "@andyyyds/forum/lib/forum-settings";
import { ensureStarterForumSpaces } from "@andyyyds/forum/lib/forum-space";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "兴趣圈子",
  description: "按兴趣主题交流：讨论、分享、约局与问答",
};

export default async function ForumCirclesPage() {
  const session = await getSession();
  const notice = await getPublicForumNotice();
  await ensureStarterForumSpaces("CIRCLE");
  const rows = await prisma.forumUniversity.findMany({
    where: { enabled: true, kind: "CIRCLE" },
    include: {
      _count: {
        select: {
          members: true,
          posts: { where: { status: "PUBLISHED", audience: "PUBLIC" } },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const cards = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      logoUrl: row.logoUrl ? await resolveStoredAccessUrl(row.logoUrl) : "",
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
          <ForumSectionNav current="CIRCLE" />
          <p className="text-sm font-medium text-[var(--brand)]">兴趣圈子</p>
          <h1 className="brand-mark text-3xl font-semibold sm:text-4xl">
            按兴趣找同好
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
            这是论坛下的兴趣分区。登录就能进圈发帖，不用高校实名。摄影、考研、数码都可以有自己的圈子。
          </p>
          <ForumAccountBar
            loggedIn={Boolean(session)}
            name={session?.name}
            loginNext="/forum/circles"
          />
          {session && canManageForum(session) ? (
            <Link
              href="/studio/forum"
              className="btn btn-secondary inline-flex min-h-11 items-center px-4 text-sm"
            >
              管理兴趣圈子
            </Link>
          ) : null}
        </header>
        <ForumSpaceDirectory
          cards={cards}
          emptyText="兴趣圈子即将由站长开通。"
          fallbackBlurb="点击进入圈子"
        />
      </div>
    </NavPageTemplateShell>
  );
}

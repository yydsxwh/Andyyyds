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
  title: "本地同城",
  description: "按城市找附近的人：活动、吃喝、租房、二手与互助",
};

export default async function ForumCitiesPage() {
  const session = await getSession();
  const notice = await getPublicForumNotice();
  await ensureStarterForumSpaces("CITY");
  const rows = await prisma.forumUniversity.findMany({
    where: { enabled: true, kind: "CITY" },
    include: {
      _count: {
        select: {
          members: true,
          posts: { where: { status: "PUBLISHED", audience: "PUBLIC" } },
        },
      },
    },
    orderBy: [{ region: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
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
          <ForumSectionNav current="CITY" />
          <p className="text-sm font-medium text-[var(--brand)]">本地同城</p>
          <h1 className="brand-mark text-3xl font-semibold sm:text-4xl">
            按城市找附近
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
            这是论坛下的同城分区。登录就能发活动、吃喝、租房和互助，不用高校实名。
          </p>
          <ForumAccountBar
            loggedIn={Boolean(session)}
            name={session?.name}
            loginNext="/forum/cities"
          />
          {session && canManageForum(session) ? (
            <Link
              href="/studio/forum"
              className="btn btn-secondary inline-flex min-h-11 items-center px-4 text-sm"
            >
              管理同城分区
            </Link>
          ) : null}
        </header>
        <ForumSpaceDirectory
          cards={cards}
          emptyText="同城分区即将由站长开通。"
          fallbackBlurb="点击进入同城"
        />
      </div>
    </NavPageTemplateShell>
  );
}

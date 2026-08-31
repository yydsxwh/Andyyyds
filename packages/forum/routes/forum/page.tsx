import Link from "next/link";
import { ForumAccountBar } from "@andyyyds/forum/components/forum-account-bar";
import { ForumNoticeBar } from "@andyyyds/forum/components/forum-notice-bar";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { canManageForum } from "@andyyyds/shared/roles";
import { getPublicForumNotice } from "@andyyyds/forum/lib/forum-settings";
import {
  FORUM_SPACE_KIND_HINT,
  FORUM_SPACE_KIND_LABEL,
  FORUM_SPACE_LIST_PATH,
  ensureStarterForumSpaces,
  type ForumSpaceKind,
} from "@andyyyds/forum/lib/forum-space";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "论坛",
  description: "大学论坛、兴趣圈子与本地同城，按分区交流",
};

const HUB_SECTIONS: ForumSpaceKind[] = ["UNIVERSITY", "CIRCLE", "CITY"];

export default async function ForumHomePage() {
  const session = await getSession();
  const notice = await getPublicForumNotice();
  await Promise.all([
    ensureStarterForumSpaces("CIRCLE"),
    ensureStarterForumSpaces("CITY"),
  ]);

  const groups = await Promise.all(
    HUB_SECTIONS.map(async (kind) => {
      const [spaces, posts] = await Promise.all([
        prisma.forumUniversity.count({ where: { enabled: true, kind } }),
        prisma.forumPost.count({
          where: {
            status: "PUBLISHED",
            audience: "PUBLIC",
            university: { enabled: true, kind },
          },
        }),
      ]);
      return { kind, spaces, posts };
    }),
  );

  return (
    <NavPageTemplateShell type="forum">
      <div className="container space-y-6 py-10 sm:py-12">
        {notice ? <ForumNoticeBar notice={notice} /> : null}
        <header className="space-y-2">
          <p className="text-sm font-medium text-[var(--brand)]">论坛</p>
          <h1 className="brand-mark text-3xl font-semibold sm:text-4xl">
            选一个分区进去聊
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
            大学论坛、兴趣圈子、本地同城都是论坛下的分区。高校要实名认证后发帖；圈子和同城登录就能发。全站同一账号，不用另开论坛号。
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
                管理论坛分区
              </Link>
            ) : null}
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          {groups.map((group) => (
            <Link
              key={group.kind}
              href={FORUM_SPACE_LIST_PATH[group.kind]}
              className="surface block rounded-[28px] p-5 active:opacity-80"
            >
              <p className="text-sm font-medium text-[var(--brand)]">
                {FORUM_SPACE_KIND_LABEL[group.kind]}
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                {group.kind === "UNIVERSITY"
                  ? "按学校找同学"
                  : group.kind === "CIRCLE"
                    ? "按兴趣找同好"
                    : "按城市找附近"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {FORUM_SPACE_KIND_HINT[group.kind]}
              </p>
              <p className="mt-4 text-xs text-[var(--muted)]">
                {group.spaces} 个分区 · {group.posts} 帖
              </p>
            </Link>
          ))}
        </div>
      </div>
    </NavPageTemplateShell>
  );
}

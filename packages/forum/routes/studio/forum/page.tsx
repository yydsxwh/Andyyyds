import { StudioForumPanel } from "@andyyyds/forum/components/studio-forum-panel";
import { StudioForumSettings } from "@andyyyds/forum/components/studio-forum-settings";
import { StudioForumVerifyPanel } from "@andyyyds/forum/components/studio-forum-verify-panel";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { FORUM_UNIVERSITY_LIST_ORDER_BY } from "@andyyyds/forum/lib/forum-university";
import { getForumSiteConfig, getSignedForumNotice } from "@andyyyds/forum/lib/forum-settings";
import { canManageForum } from "@andyyyds/shared/roles";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "论坛管理",
};

export default async function StudioForumPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageForum(session)) redirect("/studio");

  const universities = await prisma.forumUniversity.findMany({
    include: {
      zones: { orderBy: { sortOrder: "asc" } },
      _count: { select: { members: true, posts: true, zones: true } },
    },
    orderBy: FORUM_UNIVERSITY_LIST_ORDER_BY,
  });
  const verifications = await prisma.forumSchoolVerification.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      university: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 80,
  });
  const config = await getForumSiteConfig();
  const noticePreview = await getSignedForumNotice(config.notice);

  return (
    <div className="container space-y-6 py-10 sm:py-12">
      <StudioNav current="forum" area="admin" />
      <div>
        <h1 className="text-3xl font-semibold">论坛</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          大学论坛、兴趣圈子、本地同城都是论坛分区。开关、顶部公告栏、各分区广告栏分别保存。关开关只限制其他用户；站长自己发帖、评论、私信不受影响。
        </p>
      </div>
      <div className="surface rounded-[28px] p-4 sm:p-6">
        <StudioForumSettings
          initialConfig={config}
          initialNoticePreview={noticePreview}
        />
      </div>
      <div className="surface rounded-[28px] p-4 sm:p-6">
        <StudioForumVerifyPanel
          initialRows={verifications.map((row) => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
          }))}
        />
      </div>
      <div className="surface rounded-[28px] p-4 sm:p-6">
        <StudioForumPanel
          initialUniversities={universities.map((row) => ({
            ...row,
            kind: row.kind || "UNIVERSITY",
          }))}
        />
      </div>
    </div>
  );
}

import { StudioForumPanel } from "@/components/studio-forum-panel";
import { StudioForumSettings } from "@/components/studio-forum-settings";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getForumSiteConfig, getSignedForumNotice } from "@/lib/forum-settings";
import { canManageForum } from "@/lib/roles";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "大学论坛管理",
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
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  const config = await getForumSiteConfig();
  const noticePreview = await getSignedForumNotice(config.notice);

  return (
    <div className="container space-y-6 py-10 sm:py-12">
      <StudioNav current="forum" area="admin" />
      <div>
        <h1 className="text-3xl font-semibold">大学论坛</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          开关、顶部公告栏、各高校广告栏分别保存，改一块不会覆盖另一块未提交的修改。关开关只限制其他用户；站长自己发帖、评论、私信不受影响。
        </p>
      </div>
      <div className="surface rounded-[28px] p-4 sm:p-6">
        <StudioForumSettings
          initialConfig={config}
          initialNoticePreview={noticePreview}
        />
      </div>
      <div className="surface rounded-[28px] p-4 sm:p-6">
        <StudioForumPanel initialUniversities={universities} />
      </div>
    </div>
  );
}

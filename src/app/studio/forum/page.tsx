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
          开关控制其他用户能否发帖、评论、点赞和论坛私信；站长自己始终不受限。公告栏显示在论坛各页最顶部。高校分区仍按学校分别配置广告与专区。
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

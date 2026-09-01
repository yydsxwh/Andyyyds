import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StudioForumSpaceEditClient } from "@andyyyds/forum/components/studio-forum-space-edit-client";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { FORUM_SPACE_KIND_LABEL, parseForumSpaceKind } from "@andyyyds/forum/lib/forum-space";
import { canManageForum } from "@andyyyds/shared/roles";

export default async function StudioForumSpaceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageForum(session)) redirect("/studio");

  const { id } = await params;
  const university = await prisma.forumUniversity.findUnique({
    where: { id },
    include: {
      zones: { orderBy: { sortOrder: "asc" } },
      _count: { select: { members: true, posts: true, zones: true } },
    },
  });
  if (!university) notFound();

  const kind = parseForumSpaceKind(university.kind);
  const kindLabel = FORUM_SPACE_KIND_LABEL[kind];

  return (
    <div className="container space-y-6 py-10 sm:py-12">
      <StudioNav current="forum" area="admin" />
      <div>
        <Link href="/studio/forum" className="text-sm text-[var(--brand)]">
          ← 返回论坛分区列表
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          编辑{kindLabel}：{university.name}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          /forum/{university.slug} · {university._count.members} 人 ·{" "}
          {university._count.posts} 帖 · {university.enabled ? "展示中" : "已关闭"}
          {" · "}
          <Link
            href={`/forum/${university.slug}`}
            className="text-[var(--brand)]"
          >
            打开前台
          </Link>
        </p>
      </div>
      <div className="surface rounded-[28px] p-4 sm:p-6">
        <StudioForumSpaceEditClient
          university={{
            ...university,
            kind: university.kind || "UNIVERSITY",
          }}
        />
      </div>
    </div>
  );
}

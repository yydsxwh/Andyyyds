import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ForumComposer } from "@andyyyds/forum/components/forum-composer";
import { ForumNoticeBar } from "@andyyyds/forum/components/forum-notice-bar";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import {
  FORUM_CLOSED,
  displayPostTitle,
  formatForumTime,
  forumMemberMay,
  parseForumMedia,
} from "@andyyyds/forum/lib/forum";
import { canSetSchoolRestrictedAudience } from "@andyyyds/forum/lib/forum-school";
import { FORUM_UNIVERSITY_LIST_ORDER_BY } from "@andyyyds/forum/lib/forum-university";
import {
  canPostInForumSpace,
  isCampusForumSpace,
} from "@andyyyds/forum/lib/forum-space";
import { forumCampusCityHint } from "@andyyyds/shared/geo-china";
import { signForumMedia } from "@andyyyds/forum/lib/forum-media";
import { getForumSiteConfig, getPublicForumNotice } from "@andyyyds/forum/lib/forum-settings";
import { canManageForum } from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

export default async function ForumComposePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ zone?: string; draft?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/forum/${slug}/new`)}`);
  }

  const university = await prisma.forumUniversity.findUnique({
    where: { slug },
    include: { zones: { orderBy: { sortOrder: "asc" } } },
  });
  if (!university || !university.enabled) notFound();
  if (!canPostInForumSpace(session, university)) {
    redirect(`/forum/${slug}`);
  }

  const [flags, notice] = await Promise.all([
    getForumSiteConfig(),
    getPublicForumNotice(),
  ]);
  const canCompose = forumMemberMay(session, flags.allowMemberPost);
  const broadcastUniversities =
    canManageForum(session) && isCampusForumSpace(university.kind)
      ? await prisma.forumUniversity.findMany({
          where: { enabled: true, kind: "UNIVERSITY" },
          select: { id: true, name: true, region: true },
          orderBy: FORUM_UNIVERSITY_LIST_ORDER_BY,
        })
      : [];

  const drafts = await prisma.forumPost.findMany({
    where: {
      authorId: session.id,
      universityId: university.id,
      status: "DRAFT",
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      body: true,
      place: true,
      updatedAt: true,
    },
  });

  const draftId = query.draft?.trim() || "";
  const editing = draftId
    ? await prisma.forumPost.findFirst({
        where: {
          id: draftId,
          authorId: session.id,
          universityId: university.id,
          status: "DRAFT",
        },
      })
    : null;

  const signedMedia = editing
    ? await signForumMedia(parseForumMedia(editing.mediaJson))
    : [];

  const defaultZone =
    university.zones.find(
      (z) =>
        z.enabled &&
        (editing?.zoneId === z.id || z.key === query.zone || z.id === query.zone),
    ) || university.zones.find((z) => z.enabled);

  return (
    <NavPageTemplateShell type="forum">
      <div className="container max-w-2xl space-y-5 py-8 sm:py-10">
        {notice ? <ForumNoticeBar notice={notice} /> : null}
        <Link href={`/forum/${slug}`} className="text-sm text-[var(--brand)]">
          ← 返回 {university.name}
        </Link>
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            {editing ? "继续编辑草稿" : "发帖"}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {canCompose
              ? "没写完可先保存草稿。草稿在本分区发帖页和「我的论坛 → 草稿」里都能打开继续改。"
              : FORUM_CLOSED.post}
          </p>
          {broadcastUniversities.length > 1 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              站长可勾选其他高校，一次把同一篇同步发到多所学校。
            </p>
          ) : null}
          {query.draft?.trim() && !editing ? (
            <p className="mt-2 text-sm text-amber-700">
              这条草稿不存在或已经发布，已为你打开空白发帖。
            </p>
          ) : null}
        </div>

        {canCompose && drafts.length > 0 ? (
          <div className="surface space-y-2 rounded-[28px] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">本分区草稿</p>
              <Link
                href="/forum/mine?tab=drafts"
                className="text-sm text-[var(--brand)]"
              >
                全部草稿箱
              </Link>
            </div>
            <ul className="space-y-2">
              {drafts.map((row) => {
                const active = editing?.id === row.id;
                return (
                  <li key={row.id}>
                    <Link
                      href={`/forum/${slug}/new?draft=${encodeURIComponent(row.id)}`}
                      className={`flex min-h-11 items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm ${
                        active
                          ? "bg-[var(--brand)]/15 text-[var(--brand)]"
                          : "bg-[var(--line)]/30"
                      }`}
                    >
                      <span className="min-w-0 truncate">
                        {displayPostTitle(row.title, row.body || row.place || "")}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--muted)]">
                        {formatForumTime(row.updatedAt)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {editing ? (
              <Link
                href={`/forum/${slug}/new`}
                className="inline-flex min-h-11 items-center text-sm text-[var(--brand)]"
              >
                写新帖（不打开草稿）
              </Link>
            ) : null}
          </div>
        ) : null}

        {canCompose ? (
          <div className="surface rounded-[28px] p-5">
            <ForumComposer
              key={editing?.id || "new"}
              universityId={university.id}
              universitySlug={university.slug}
              universityName={university.name}
              cityHint={forumCampusCityHint(university)}
              zones={university.zones}
              defaultZoneId={defaultZone?.id}
              broadcastUniversities={broadcastUniversities}
              canSetSchoolOnly={
                isCampusForumSpace(university.kind) &&
                canSetSchoolRestrictedAudience(session, university.id)
              }
              initial={
                editing
                  ? {
                      id: editing.id,
                      zoneId: editing.zoneId,
                      title: editing.title,
                      body: editing.body,
                      place: editing.place,
                      latitude: editing.latitude,
                      longitude: editing.longitude,
                      audience:
                        editing.audience === "SCHOOL_VERIFIED"
                          ? "SCHOOL_VERIFIED"
                          : "PUBLIC",
                      media: signedMedia.map((item, index) => ({
                        kind: item.kind,
                        url: parseForumMedia(editing.mediaJson)[index]?.url || item.url,
                        previewUrl: item.url,
                      })),
                    }
                  : null
              }
            />
          </div>
        ) : null}
      </div>
    </NavPageTemplateShell>
  );
}

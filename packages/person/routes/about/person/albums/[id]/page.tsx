import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PersonSiteChrome } from "@andyyyds/person/components/person-site-chrome";
import { getPersonSocialAlbumDetail } from "@andyyyds/person/lib/person-social-album";
import {
  PERSON_SOCIAL_PLATFORM_LABEL,
  type PersonSocialPlatform,
} from "@andyyyds/person/lib/person-social";
import { getPersonProfile } from "@andyyyds/person/lib/person-site-store";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const album = await getPersonSocialAlbumDetail(id);
  if (!album) return { title: "合集" };
  return { title: album.title || "合集" };
}

export default async function PersonAlbumPage({ params }: Props) {
  const { id } = await params;
  const [album, profile, session] = await Promise.all([
    getPersonSocialAlbumDetail(id),
    getPersonProfile(),
    getSession(),
  ]);
  if (!album) notFound();
  const platformLabel =
    PERSON_SOCIAL_PLATFORM_LABEL[album.platform as PersonSocialPlatform] ||
    album.platform;

  return (
    <PersonSiteChrome profile={profile} showAdmin={Boolean(session && isAdmin(session))}>
      <Link
        href="/about/person"
        className="inline-flex min-h-11 items-center text-sm text-[var(--brand)] touch-manipulation hover:underline"
      >
        ← 返回个人介绍
      </Link>

      <header className="mt-4 mb-8 flex flex-col gap-4 sm:flex-row sm:items-end">
        {album.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={album.coverUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="aspect-[16/10] w-full max-w-sm rounded-[24px] object-cover sm:w-48 sm:shrink-0"
          />
        ) : null}
        <div>
          <p className="text-sm font-medium text-[var(--brand)]">
            {platformLabel}合集
          </p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
            {album.title || "未命名合集"}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            共 {album.items.length} 条
          </p>
        </div>
      </header>

      {album.items.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {album.items.map((item) => {
            const livePost = item.post && !item.post.isDeleted ? item.post : null;
            const href = livePost?.sourceUrl || item.sourceUrl || "";
            const title = livePost?.title || item.title || "无标题";
            const thumb = livePost?.coverUrl || item.coverUrl || "";
            if (!href) {
              return (
                <li
                  key={item.id}
                  className="surface overflow-hidden rounded-[20px]"
                >
                  <ItemBody thumb={thumb} title={title} external={false} />
                </li>
              );
            }
            return (
              <li key={item.id}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="surface block overflow-hidden rounded-[20px] transition touch-manipulation hover:-translate-y-0.5 active:-translate-y-0.5"
                >
                  <ItemBody thumb={thumb} title={title} external />
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-[var(--muted)]">这个合集还没有条目。</p>
      )}
    </PersonSiteChrome>
  );
}

function ItemBody({
  thumb,
  title,
  external,
}: {
  thumb: string;
  title: string;
  external: boolean;
}) {
  return (
    <>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          referrerPolicy="no-referrer"
          className="aspect-[16/10] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center bg-[var(--bg-deep)] text-sm text-[var(--muted)]">
          投稿
        </div>
      )}
      <div className="p-4">
        <div className="line-clamp-2 font-medium">{title}</div>
        {external ? (
          <p className="mt-1 text-xs text-[var(--muted)]">打开原平台</p>
        ) : null}
      </div>
    </>
  );
}

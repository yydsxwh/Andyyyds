"use client";

/**
 * 站长：填写 B站/抖音/小红书/视频号主页并同步投稿与合集，或粘贴作品/合集链接导入。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";
import {
  PERSON_SOCIAL_KIND_LABEL,
  PERSON_SOCIAL_PLATFORM_LABEL,
  type PersonSocialContentKind,
  type PersonSocialPlatform,
} from "@andyyyds/person/lib/person-social";

type PostRow = {
  id: string;
  platform: PersonSocialPlatform | string;
  platformLabel: string;
  title: string;
  digest: string;
  coverUrl: string;
  sourceUrl: string;
  contentKind: PersonSocialContentKind | string;
  publishedAt: string | null;
  syncedAt: string;
  isPinned: boolean;
  isFeatured: boolean;
  sortOrder: number;
};

type AlbumRow = {
  id: string;
  platform: string;
  platformLabel: string;
  title: string;
  coverUrl: string;
  sourceUrl: string;
  itemCount: number;
  syncedAt: string;
};

function postMatchesQuery(post: PostRow, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${post.title}\n${post.digest}\n${post.platformLabel}`
    .toLowerCase()
    .includes(q);
}

export function StudioPersonSocialPanel() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<SaveStatus>(null);
  const [loadError, setLoadError] = useState("");
  const [bilibili, setBilibili] = useState("");
  const [douyin, setDouyin] = useState("");
  const [xiaohongshu, setXiaohongshu] = useState("");
  const [wechatChannels, setWechatChannels] = useState("");
  const [rsshubBaseUrl, setRsshubBaseUrl] = useState("");
  const [importUrls, setImportUrls] = useState("");
  const [albumUrl, setAlbumUrl] = useState("");
  const [albums, setAlbums] = useState<AlbumRow[]>([]);
  const [albumNameId, setAlbumNameId] = useState("");
  const [albumName, setAlbumName] = useState("");
  const [postTotal, setPostTotal] = useState(0);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [dirtyOrder, setDirtyOrder] = useState(false);
  const [query, setQuery] = useState("");

  const visible = useMemo(
    () => posts.filter((post) => postMatchesQuery(post, query)),
    [posts, query],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/studio/person-social", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载失败");
      setBilibili(data.accounts?.bilibili || "");
      setDouyin(data.accounts?.douyin || "");
      setXiaohongshu(data.accounts?.xiaohongshu || "");
      setWechatChannels(data.accounts?.wechatChannels || "");
      setRsshubBaseUrl(data.accounts?.rsshubBaseUrl || "");
      setPostTotal(data.postTotal || 0);
      setAlbums(data.albums || []);
      setPosts(data.posts || []);
      setDirtyOrder(false);
      if (typeof data.syncLastMessage === "string" && data.syncLastMessage) {
        setFeedback({ kind: "ok", text: data.syncLastMessage });
      }
      return Boolean(data.syncRunning);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "加载失败");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function postAction(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setFeedback(null);
    const result = await postSave("/api/studio/person-social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "操作失败" });
      return false;
    }
    setFeedback({
      kind: "ok",
      text:
        typeof result.data.message === "string"
          ? result.data.message
          : "操作成功",
    });
    if (body.action === "sync") {
      void (async () => {
        for (let i = 0; i < 40; i += 1) {
          await new Promise((r) => setTimeout(r, 4000));
          const running = await load();
          if (!running) break;
        }
      })();
    } else {
      await load();
    }
    return true;
  }

  function moveVisible(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || to >= visible.length) return;
    const visibleIds = new Set(visible.map((p) => p.id));
    const nextVisible = visible.slice();
    const [item] = nextVisible.splice(from, 1);
    if (!item) return;
    nextVisible.splice(to, 0, item);
    const nextAll: PostRow[] = [];
    let vi = 0;
    for (const post of posts) {
      if (visibleIds.has(post.id)) {
        nextAll.push(nextVisible[vi]!);
        vi += 1;
      } else {
        nextAll.push(post);
      }
    }
    setPosts(nextAll);
    setDirtyOrder(true);
    setFeedback({
      kind: "ok",
      text: "次序已调整，请点「保存次序」生效到前台。",
    });
  }

  async function saveOrder() {
    if (busy || !posts.length) return;
    setBusy(true);
    setFeedback(null);
    const result = await postSave("/api/studio/person-social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reorder",
        orderedIds: posts.map((p) => p.id),
      }),
    });
    setBusy(false);
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "保存次序失败" });
      return;
    }
    setDirtyOrder(false);
    setFeedback({
      kind: "ok",
      text:
        typeof result.data.message === "string"
          ? result.data.message
          : "次序已保存",
    });
    await load();
  }

  async function removePost(post: PostRow) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`确定删除「${post.title || "无标题"}」？删除后同步不会自动恢复。`)
    ) {
      return;
    }
    const prev = posts;
    setPosts((list) => list.filter((row) => row.id !== post.id));
    setPostTotal((n) => Math.max(0, n - 1));
    const result = await postSave("/api/studio/person-social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: post.id }),
    });
    if (!result.ok) {
      setPosts(prev);
      setPostTotal(prev.length);
      setFeedback({ kind: "error", text: result.error || "删除失败" });
      return;
    }
    setFeedback({ kind: "ok", text: "已删除" });
    await load();
  }

  async function patchPost(
    post: PostRow,
    patch: { isPinned?: boolean; isFeatured?: boolean },
  ) {
    if (busy) return;
    const prev = posts;
    setPosts((list) =>
      list.map((row) => (row.id === post.id ? { ...row, ...patch } : row)),
    );
    const result = await postSave("/api/studio/person-social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id: post.id, ...patch }),
    });
    if (!result.ok) {
      setPosts(prev);
      setFeedback({ kind: "error", text: result.error || "更新失败" });
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="surface rounded-[28px] p-5 sm:p-6">
        <h2 className="text-lg font-semibold">平台主页</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          填自己的主页链接后点同步，投稿和合集会出现在前台「个人介绍」，用法和公众号宣传类似。B
          站投稿/合集比较稳；抖音、小红书、视频号经常拦未登录抓取，失败时把作品或合集分享链接贴到下面导入即可。
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block text-[var(--muted)]">B站主页或 UID</span>
            <input
              className="field w-full min-h-11"
              value={bilibili}
              onChange={(e) => setBilibili(e.target.value)}
              placeholder="https://space.bilibili.com/123456 或 123456"
              disabled={busy}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block text-[var(--muted)]">抖音主页</span>
            <input
              className="field w-full min-h-11"
              value={douyin}
              onChange={(e) => setDouyin(e.target.value)}
              placeholder="https://www.douyin.com/user/MS4wLjABAAAA…"
              disabled={busy}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block text-[var(--muted)]">小红书主页</span>
            <input
              className="field w-full min-h-11"
              value={xiaohongshu}
              onChange={(e) => setXiaohongshu(e.target.value)}
              placeholder="https://www.xiaohongshu.com/user/profile/…"
              disabled={busy}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block text-[var(--muted)]">微信视频号主页</span>
            <input
              className="field w-full min-h-11"
              value={wechatChannels}
              onChange={(e) => setWechatChannels(e.target.value)}
              placeholder="https://channels.weixin.qq.com/… 或 https://weixin.qq.com/sph/…"
              disabled={busy}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block text-[var(--muted)]">
              RSSHub 地址（可选）
            </span>
            <input
              className="field w-full min-h-11"
              value={rsshubBaseUrl}
              onChange={(e) => setRsshubBaseUrl(e.target.value)}
              placeholder="留空用公开实例；自建可填 https://rsshub.example.com"
              disabled={busy}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-secondary min-h-11 px-5"
            disabled={busy}
            onClick={() =>
              void postAction({
                action: "save_accounts",
                bilibili,
                douyin,
                xiaohongshu,
                wechatChannels,
                rsshubBaseUrl,
              })
            }
          >
            保存主页
          </button>
          <button
            type="button"
            className="btn btn-primary min-h-11 px-5"
            disabled={busy}
            onClick={() => void postAction({ action: "sync" })}
          >
            {busy ? "同步中…" : "同步投稿"}
          </button>
          <a
            href="/about/person"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary min-h-11 px-5"
          >
            查看个人介绍页
          </a>
          <SaveFeedback status={feedback} />
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {loading ? "加载中…" : `本地已存 ${postTotal} 条投稿`}
        </p>
      </div>

      <div className="surface rounded-[28px] p-5 sm:p-6">
        <h2 className="text-lg font-semibold">粘贴作品链接导入</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          抖音、小红书、B 站、视频号的单条分享链接都可以，一行一条或用空格隔开。导入后与主页同步进同一列表。
        </p>
        <textarea
          className="field mt-3 min-h-28 w-full"
          value={importUrls}
          onChange={(e) => setImportUrls(e.target.value)}
          placeholder="https://v.douyin.com/…&#10;https://www.bilibili.com/video/BV…&#10;https://www.xiaohongshu.com/explore/…&#10;https://weixin.qq.com/sph/…"
          disabled={busy}
        />
        <button
          type="button"
          className="btn btn-primary mt-3 min-h-11 px-5"
          disabled={busy || !importUrls.trim()}
          onClick={() => {
            const urls = importUrls.trim();
            void postAction({ action: "ingest_urls", urls }).then((ok) => {
              if (ok) setImportUrls("");
            });
          }}
        >
          导入链接
        </button>
      </div>

      <div className="surface rounded-[28px] p-5 sm:p-6">
        <h2 className="text-lg font-semibold">合集 / 专辑</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          和公众号合集一样：B 站同步主页时会自动拉合集/系列；其它平台请打开合集页，复制地址栏链接添加。条目会尽量对上已导入的投稿。
        </p>
        <label className="mt-4 block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">合集链接</span>
          <input
            className="field w-full min-h-11"
            value={albumUrl}
            onChange={(e) => setAlbumUrl(e.target.value)}
            placeholder="https://space.bilibili.com/…/channel/collectiondetail?sid=…"
            disabled={busy}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary mt-3 min-h-11 px-5"
          disabled={busy || !albumUrl.trim()}
          onClick={() => {
            const sourceUrl = albumUrl.trim();
            void postAction({ action: "add_album", sourceUrl }).then((ok) => {
              if (ok) setAlbumUrl("");
            });
          }}
        >
          添加并同步合集
        </button>
        {albums.length ? (
          <ul className="mt-4 space-y-3">
            {albums.map((album) => (
              <li
                key={album.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] p-3 sm:flex-row sm:items-center"
              >
                {album.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={album.coverUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-16 w-24 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-deep)] text-xs text-[var(--muted)]">
                    合集
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {albumNameId === album.id ? (
                    <input
                      className="field min-h-11 w-full"
                      value={albumName}
                      onChange={(e) => setAlbumName(e.target.value)}
                      placeholder="合集名称"
                    />
                  ) : (
                    <div className="truncate font-medium">
                      {album.title || "未命名合集"}
                    </div>
                  )}
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    {album.platformLabel} · {album.itemCount} 条
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {albumNameId === album.id ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary min-h-11 px-3 text-sm"
                        disabled={busy}
                        onClick={() =>
                          void postAction({
                            action: "rename_album",
                            id: album.id,
                            title: albumName,
                          }).then((ok) => {
                            if (ok) {
                              setAlbumNameId("");
                              setAlbumName("");
                            }
                          })
                        }
                      >
                        保存名称
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary min-h-11 px-3 text-sm"
                        onClick={() => {
                          setAlbumNameId("");
                          setAlbumName("");
                        }}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary min-h-11 px-3 text-sm"
                      onClick={() => {
                        setAlbumNameId(album.id);
                        setAlbumName(album.title);
                      }}
                    >
                      改名
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary min-h-11 px-3 text-sm"
                    disabled={busy}
                    onClick={() =>
                      void postAction({ action: "refresh_album", id: album.id })
                    }
                  >
                    刷新
                  </button>
                  <a
                    href={`/about/person/albums/${album.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary min-h-11 px-3 text-sm"
                  >
                    查看
                  </a>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-11 px-3 text-sm text-red-600"
                    disabled={busy}
                    onClick={() => {
                      if (
                        typeof window !== "undefined" &&
                        !window.confirm(`确定移除合集「${album.title}」？`)
                      ) {
                        return;
                      }
                      void postAction({ action: "delete_album", id: album.id });
                    }}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">尚未添加合集</p>
        )}
      </div>

      {loadError ? (
        <p className="text-sm font-medium text-[var(--fire-strong)]">{loadError}</p>
      ) : null}

      <div className="surface rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">置顶、精华与排序</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              同步不会覆盖置顶、精华和你排好的次序。点封面或标题打开原平台。
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary min-h-11 shrink-0 px-5"
            disabled={busy || !dirtyOrder || !posts.length}
            onClick={() => void saveOrder()}
          >
            {busy && dirtyOrder ? "保存中…" : "保存次序"}
          </button>
        </div>
        <label className="mt-4 block text-sm">
          <span className="sr-only">搜索投稿</span>
          <input
            className="field w-full min-h-11"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜标题、摘要或平台"
          />
        </label>
        {visible.length ? (
          <ul className="mt-4 space-y-3">
            {visible.map((post, index) => (
              <li
                key={post.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] p-3 sm:flex-row sm:items-center"
              >
                <a
                  href={post.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  {post.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.coverUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-16 w-24 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-deep)] text-xs text-[var(--muted)]">
                      {PERSON_SOCIAL_PLATFORM_LABEL[
                        post.platform as PersonSocialPlatform
                      ] || "投稿"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {post.title || "无标题"}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--muted)]">
                      {post.platformLabel} ·{" "}
                      {PERSON_SOCIAL_KIND_LABEL[
                        post.contentKind as PersonSocialContentKind
                      ] || post.contentKind}
                      {post.publishedAt
                        ? ` · ${new Date(post.publishedAt).toLocaleDateString("zh-CN")}`
                        : ""}
                    </div>
                  </div>
                </a>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary min-h-11 px-3 text-sm"
                    disabled={busy || index === 0}
                    onClick={() => moveVisible(index, index - 1)}
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-11 px-3 text-sm"
                    disabled={busy || index === visible.length - 1}
                    onClick={() => moveVisible(index, index + 1)}
                  >
                    下移
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-11 px-3 text-sm"
                    disabled={busy}
                    onClick={() =>
                      void patchPost(post, { isPinned: !post.isPinned })
                    }
                  >
                    {post.isPinned ? "取消置顶" : "置顶"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-11 px-3 text-sm"
                    disabled={busy}
                    onClick={() =>
                      void patchPost(post, { isFeatured: !post.isFeatured })
                    }
                  >
                    {post.isFeatured ? "取消精华" : "精华"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-11 px-3 text-sm text-red-600"
                    disabled={busy}
                    onClick={() => void removePost(post)}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">
            {query.trim() ? "没有匹配的投稿。" : "还没有投稿。先保存主页再同步，或导入作品链接。"}
          </p>
        )}
      </div>
    </div>
  );
}

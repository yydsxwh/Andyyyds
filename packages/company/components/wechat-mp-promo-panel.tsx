"use client";

/**
 * 站长：同步公众号推文（文章/贴图），合集，置顶/精华/类型/删除/排序。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";

type ArticleRow = {
  id: string;
  title: string;
  digest: string;
  thumbUrl: string;
  wechatUrl: string;
  publishedAt: string | null;
  syncedAt: string;
  isPinned: boolean;
  isFeatured: boolean;
  sortOrder: number;
  /** news=文章，newspic=贴图 */
  contentKind?: string;
};

/** 标题/摘要模糊匹配（不区分大小写） */
function articleMatchesQuery(article: ArticleRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${article.title}\n${article.digest}`.toLowerCase();
  return hay.includes(q);
}

type AlbumRow = {
  id: string;
  albumId: string;
  title: string;
  coverUrl: string;
  sourceUrl: string;
  syncedAt: string;
  itemCount: number;
};

export function WechatMpPromoPanel() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<SaveStatus>(null);
  const [loadError, setLoadError] = useState("");
  const [albumUrl, setAlbumUrl] = useState("");
  const [articleTotal, setArticleTotal] = useState(0);
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [albums, setAlbums] = useState<AlbumRow[]>([]);
  const [dirtyOrder, setDirtyOrder] = useState(false);
  const [query, setQuery] = useState("");
  /** 正在编辑名称的合集 id；空表示未进入命名态 */
  const [renamingAlbumId, setRenamingAlbumId] = useState("");
  const [renameDraft, setRenameDraft] = useState("");

  const visible = useMemo(
    () => articles.filter((a) => articleMatchesQuery(a, query)),
    [articles, query],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/studio/wechat-mp", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载失败");
      setArticleTotal(data.articleTotal || 0);
      setArticles(data.articles || []);
      setAlbums(data.albums || []);
      setDirtyOrder(false);
      if (typeof data.syncLastMessage === "string" && data.syncLastMessage) {
        setFeedback({
          kind: data.syncRunning ? "ok" : "ok",
          text: data.syncLastMessage,
        });
      }
      return Boolean(data.syncRunning);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "加载失败");
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
    const result = await postSave("/api/studio/wechat-mp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "操作失败" });
      return false;
    }
    const msg =
      typeof result.data.message === "string"
        ? result.data.message
        : "操作成功";
    setFeedback({ kind: "ok", text: msg });
    // 全量同步改为后台后立刻刷新一次，并启动轮询
    if (body.action === "sync_articles") {
      const poll = async () => {
        for (let i = 0; i < 60; i += 1) {
          await new Promise((r) => setTimeout(r, 8000));
          const running = await load();
          if (!running) break;
        }
      };
      void poll();
    } else {
      await load();
    }
    return true;
  }

  /**
   * 在当前可见列表内换位，再写回全量列表（搜索时也能调序）。
   * from/to 为 visible 下标。
   */
  function moveVisibleArticle(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || to >= visible.length) return;
    const visibleIds = new Set(visible.map((a) => a.id));
    const fromId = visible[from]?.id;
    const toId = visible[to]?.id;
    if (!fromId || !toId) return;

    const nextVisible = visible.slice();
    const [item] = nextVisible.splice(from, 1);
    if (!item) return;
    nextVisible.splice(to, 0, item);

    const nextAll: ArticleRow[] = [];
    let vi = 0;
    for (const a of articles) {
      if (visibleIds.has(a.id)) {
        nextAll.push(nextVisible[vi]!);
        vi += 1;
      } else {
        nextAll.push(a);
      }
    }
    setArticles(nextAll);
    setDirtyOrder(true);
    setFeedback({
      kind: "ok",
      text: "次序已调整，请点「保存次序」生效到前台。",
    });
  }

  async function saveArticleOrder() {
    if (busy || !articles.length) return;
    setBusy(true);
    setFeedback(null);
    const result = await postSave("/api/studio/wechat-mp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reorder_articles",
        orderedIds: articles.map((a) => a.id),
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

  async function deleteArticle(article: ArticleRow) {
    const name = article.title || "无标题";
    if (
      typeof window !== "undefined" &&
      !window.confirm(`确定删除「${name}」？删除后前台不再展示，同步也不会自动恢复。`)
    ) {
      return;
    }
    setBusy(true);
    setFeedback(null);
    const prev = articles;
    setArticles((list) => list.filter((a) => a.id !== article.id));
    setArticleTotal((n) => Math.max(0, n - 1));
    const result = await postSave("/api/studio/wechat-mp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_article", id: article.id }),
    });
    setBusy(false);
    if (!result.ok) {
      setArticles(prev);
      setArticleTotal(prev.length);
      setFeedback({ kind: "error", text: result.error || "删除失败" });
      return;
    }
    setFeedback({
      kind: "ok",
      text:
        typeof result.data.message === "string"
          ? result.data.message
          : "已删除",
    });
    await load();
  }

  async function patchArticle(
    article: ArticleRow,
    patch: {
      isPinned?: boolean;
      isFeatured?: boolean;
      contentKind?: "news" | "newspic";
    },
  ) {
    if (busy) return;
    const prev = articles;
    setArticles((list) => {
      const next = list.map((a) =>
        a.id === article.id ? { ...a, ...patch } : a,
      );
      // 置顶变化时把置顶篇聚到前面，便于继续操作
      if (patch.isPinned !== undefined) {
        next.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return 0;
        });
      }
      return next;
    });
    setBusy(true);
    setFeedback(null);
    const result = await postSave("/api/studio/wechat-mp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_article",
        id: article.id,
        ...patch,
      }),
    });
    setBusy(false);
    if (!result.ok) {
      setArticles(prev);
      setFeedback({ kind: "error", text: result.error || "更新失败" });
      return;
    }
    setFeedback({
      kind: "ok",
      text:
        typeof result.data.message === "string"
          ? result.data.message
          : "已更新",
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="surface rounded-[28px] p-5 sm:p-6">
        <h2 className="text-lg font-semibold">公众号图文同步</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          同步公众号「推文」本身：图文（news）与贴图/图片消息（newspic）整篇入库，含封面与正文。不会把素材库里的单张配图拆成列表项。渠道：发表 freepublish、有公开链的图文素材、发表/群发数据补漏，并抓公开页补正文。完整同步可能需数分钟，请勿重复连点。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary min-h-11 px-5"
            disabled={busy}
            onClick={() => void postAction({ action: "sync_articles" })}
          >
            {busy ? "同步中…" : "同步公众号图文"}
          </button>
          <a
            href="/about/company"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary min-h-11 px-5"
          >
            查看公司介绍页
          </a>
          <SaveFeedback status={feedback} />
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          本地已存 {articleTotal} 篇图文
        </p>
      </div>

      <div className="surface rounded-[28px] p-5 sm:p-6">
        <h2 className="text-lg font-semibold">合集 / 专辑</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          微信未开放合集官方接口。请在公众号主页打开某个合集，复制地址栏链接（含
          __biz 与 album_id）粘贴到下方添加。同步后可点「命名」自定义展示名；刷新不会覆盖你起的名字。
        </p>
        <label className="mt-4 block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">合集链接</span>
          <input
            className="field w-full"
            value={albumUrl}
            onChange={(e) => setAlbumUrl(e.target.value)}
            placeholder="https://mp.weixin.qq.com/mp/appmsgalbum?__biz=...&action=getalbum&album_id=..."
            disabled={busy}
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary min-h-11 px-5"
            disabled={busy || !albumUrl.trim()}
            onClick={() => {
              const url = albumUrl.trim();
              void postAction({ action: "add_album", sourceUrl: url }).then(
                (ok) => {
                  if (ok) setAlbumUrl("");
                },
              );
            }}
          >
            添加并同步合集
          </button>
          <SaveFeedback status={feedback} />
        </div>

        {albums.length ? (
          <ul className="mt-5 space-y-3">
            {albums.map((album) => {
              const editing = renamingAlbumId === album.id;
              return (
                <li
                  key={album.id}
                  className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] p-3 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {album.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={album.coverUrl}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-deep)] text-xs text-[var(--muted)]">
                        合集
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      {editing ? (
                        <label className="block text-sm">
                          <span className="sr-only">合集名称</span>
                          <input
                            className="field min-h-11 w-full"
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            placeholder="输入合集名称"
                            maxLength={200}
                            disabled={busy}
                            autoFocus
                          />
                        </label>
                      ) : (
                        <div className="truncate font-medium">
                          {album.title || "未命名合集"}
                        </div>
                      )}
                      <div className="mt-0.5 text-xs text-[var(--muted)]">
                        {album.itemCount} 篇 · 上次同步{" "}
                        {new Date(album.syncedAt).toLocaleString("zh-CN")}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editing ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary min-h-11 px-3 text-sm"
                          disabled={busy || !renameDraft.trim()}
                          onClick={() => {
                            const title = renameDraft.trim();
                            if (!title) return;
                            void postAction({
                              action: "rename_album",
                              albumLocalId: album.id,
                              title,
                            }).then((ok) => {
                              if (ok) {
                                setRenamingAlbumId("");
                                setRenameDraft("");
                              }
                            });
                          }}
                        >
                          保存名称
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary min-h-11 px-3 text-sm"
                          disabled={busy}
                          onClick={() => {
                            setRenamingAlbumId("");
                            setRenameDraft("");
                          }}
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary min-h-11 px-3 text-sm"
                        disabled={busy}
                        onClick={() => {
                          setRenamingAlbumId(album.id);
                          setRenameDraft(album.title || "");
                        }}
                      >
                        命名
                      </button>
                    )}
                    <a
                      href={`/about/company/albums/${album.id}`}
                      className="btn btn-secondary min-h-11 px-3 text-sm"
                      target="_blank"
                      rel="noreferrer"
                    >
                      前台
                    </a>
                    <button
                      type="button"
                      className="btn btn-secondary min-h-11 px-3 text-sm"
                      disabled={busy}
                      onClick={() =>
                        void postAction({
                          action: "refresh_album",
                          albumLocalId: album.id,
                        })
                      }
                    >
                      刷新
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary min-h-11 px-3 text-sm text-[var(--fire-strong)]"
                      disabled={busy}
                      onClick={() => {
                        if (!confirm(`确定移除合集「${album.title}」的展示？`)) {
                          return;
                        }
                        void postAction({
                          action: "delete_album",
                          albumLocalId: album.id,
                        });
                      }}
                    >
                      移除
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">尚未添加合集</p>
        )}
      </div>

      {loadError ? (
        <p className="text-sm font-medium text-[var(--fire-strong)]">
          {loadError}
        </p>
      ) : null}

      <div className="surface rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">图文置顶、精华与排序</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              可搜索标题/摘要后设置置顶、精华；上移/下移调序后点「保存次序」。置顶影响前台排序，精华仅角标。同步不会覆盖这些设置。
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary min-h-11 shrink-0 px-5"
            disabled={busy || !dirtyOrder || !articles.length}
            onClick={() => void saveArticleOrder()}
          >
            {busy && dirtyOrder ? "保存中…" : "保存次序"}
          </button>
        </div>

        <label className="mt-4 block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">搜索推文</span>
          <input
            className="field min-h-11 w-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入标题或摘要关键词，如：绩点、转专业"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
        {!loading && articles.length ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            {query.trim()
              ? `匹配 ${visible.length} / ${articles.length} 篇`
              : `共 ${articles.length} 篇`}
          </p>
        ) : null}

        <SaveFeedback status={feedback} />

        {loading ? (
          <p className="mt-3 text-sm text-[var(--muted)]">加载中…</p>
        ) : articles.length ? (
          visible.length ? (
            <ul className="mt-4 space-y-3">
              {visible.map((a, index) => {
                const globalOrder =
                  articles.findIndex((row) => row.id === a.id) + 1;
                return (
                  <li
                    key={a.id}
                    className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] p-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {a.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.thumbUrl}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-xl object-contain bg-[var(--bg-deep)]/40"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-deep)] text-xs text-[var(--muted)]">
                          {a.contentKind === "newspic" ? "贴图" : "文章"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              a.contentKind === "newspic"
                                ? "rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800"
                                : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                            }
                          >
                            {a.contentKind === "newspic" ? "贴图" : "文章"}
                          </span>
                          {a.isPinned ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                              置顶
                            </span>
                          ) : null}
                          {a.isFeatured ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">
                              精华
                            </span>
                          ) : null}
                          <span className="truncate font-medium">
                            {a.title || "无标题"}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {a.publishedAt
                            ? new Date(a.publishedAt).toLocaleDateString(
                                "zh-CN",
                              )
                            : "无发布日"}
                          {" · "}
                          序 {globalOrder > 0 ? globalOrder : "—"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 text-sm touch-manipulation">
                        <span className="text-[var(--muted)]">类型</span>
                        <select
                          className="min-h-9 rounded-lg border border-[var(--line)] bg-white px-2 text-sm"
                          value={a.contentKind === "newspic" ? "newspic" : "news"}
                          disabled={busy}
                          aria-label={`设置「${a.title || "推文"}」类型`}
                          onChange={(e) =>
                            void patchArticle(a, {
                              contentKind: e.target.value as "news" | "newspic",
                            })
                          }
                        >
                          <option value="news">文章</option>
                          <option value="newspic">贴图</option>
                        </select>
                      </label>
                      <label className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 text-sm touch-manipulation">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={a.isPinned}
                          disabled={busy}
                          onChange={(e) =>
                            void patchArticle(a, {
                              isPinned: e.target.checked,
                            })
                          }
                        />
                        置顶
                      </label>
                      <label className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 text-sm touch-manipulation">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={Boolean(a.isFeatured)}
                          disabled={busy}
                          onChange={(e) =>
                            void patchArticle(a, {
                              isFeatured: e.target.checked,
                            })
                          }
                        />
                        精华
                      </label>
                      <button
                        type="button"
                        className="btn btn-secondary min-h-11 px-3 text-sm"
                        disabled={busy || index === 0}
                        aria-label={`将「${a.title || "图文"}」上移`}
                        onClick={() => moveVisibleArticle(index, index - 1)}
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary min-h-11 px-3 text-sm"
                        disabled={busy || index >= visible.length - 1}
                        aria-label={`将「${a.title || "图文"}」下移`}
                        onClick={() => moveVisibleArticle(index, index + 1)}
                      >
                        下移
                      </button>
                      <a
                        href={`/about/company/articles/${a.id}`}
                        className="btn btn-secondary min-h-11 px-3 text-sm"
                        target="_blank"
                        rel="noreferrer"
                      >
                        前台
                      </a>
                      <button
                        type="button"
                        className="btn btn-secondary min-h-11 px-3 text-sm text-rose-700"
                        disabled={busy}
                        aria-label={`删除「${a.title || "推文"}」`}
                        onClick={() => void deleteArticle(a)}
                      >
                        删除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              无匹配推文，请换个关键词
            </p>
          )
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">
            暂无图文，请先点「同步公众号图文」
          </p>
        )}
      </div>
    </div>
  );
}

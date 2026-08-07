"use client";

/**
 * 站长：同步公众号已发表图文，并粘贴合集链接对齐主页专辑。
 */

import { useCallback, useEffect, useState } from "react";
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
};

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
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "加载失败");
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
    await load();
    return true;
  }

  return (
    <div className="space-y-6">
      <div className="surface rounded-[28px] p-5 sm:p-6">
        <h2 className="text-lg font-semibold">公众号图文同步</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          使用系统设置中的 AppID / AppSecret，通过微信官方「发布」接口拉取已发表图文，展示在前台「公司介绍」。需企业主体已认证且开通
          freepublish 权限。封面与正文图片会转存到本站（规避微信防盗链）；已同步过的请再点一次同步以更新封面。
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
          __biz 与 album_id）粘贴到下方添加。
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
            {albums.map((album) => (
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
                  <div className="min-w-0">
                    <div className="truncate font-medium">{album.title}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {album.itemCount} 篇 · 上次同步{" "}
                      {new Date(album.syncedAt).toLocaleString("zh-CN")}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/about/company/albums/${album.id}`}
                    className="btn btn-secondary min-h-10 px-3 text-sm"
                    target="_blank"
                    rel="noreferrer"
                  >
                    前台
                  </a>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-10 px-3 text-sm"
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
                    className="btn btn-secondary min-h-10 px-3 text-sm text-[var(--fire-strong)]"
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
            ))}
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
        <h2 className="text-lg font-semibold">最近同步的图文</h2>
        {loading ? (
          <p className="mt-3 text-sm text-[var(--muted)]">加载中…</p>
        ) : articles.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <li key={a.id}>
                <a
                  href={`/about/company/articles/${a.id}`}
                  className="block overflow-hidden rounded-2xl border border-[var(--line)] transition hover:-translate-y-0.5"
                  target="_blank"
                  rel="noreferrer"
                >
                  {a.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.thumbUrl}
                      alt=""
                      className="aspect-[16/10] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[16/10] items-center justify-center bg-[var(--bg-deep)] text-sm text-[var(--muted)]">
                      无封面
                    </div>
                  )}
                  <div className="p-3">
                    <div className="line-clamp-2 text-sm font-medium">
                      {a.title || "无标题"}
                    </div>
                    {a.digest ? (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                        {a.digest}
                      </p>
                    ) : null}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">
            暂无图文，请先点「同步公众号图文」
          </p>
        )}
      </div>
    </div>
  );
}

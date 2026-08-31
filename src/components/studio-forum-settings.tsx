"use client";

/**
 * 站长：成员发帖/评论/互动/私信开关 + 顶部公告栏编辑。
 * 关开关只限制其他用户；站长自己发帖、评论、私信不受影响。
 */

import { useMemo, useState } from "react";
import { ForumNoticeBar } from "@/components/forum-notice-bar";
import {
  FORUM_NOTICE_ANIMATIONS,
  FORUM_NOTICE_BODY_MAX,
  FORUM_NOTICE_MEDIA_MAX,
  FORUM_NOTICE_THEMES,
  FORUM_NOTICE_TITLE_MAX,
  type ForumMediaKind,
  type ForumNoticeAnimation,
  type ForumNoticeTheme,
  type ForumSiteConfig,
} from "@/lib/forum";
import {
  classifyForumFile,
  uploadForumMediaFile,
} from "@/lib/forum-browser-upload";

type DraftMedia = {
  id: string;
  kind: ForumMediaKind;
  url: string;
  previewUrl: string;
  status: "uploading" | "done" | "error";
  error?: string;
};

type Props = {
  initialConfig: ForumSiteConfig;
  initialNoticePreview: ForumSiteConfig["notice"];
};

const ANIM_LABEL: Record<ForumNoticeAnimation, string> = {
  none: "无",
  pulse: "呼吸放大",
  marquee: "横向滚动",
  shine: "扫光",
  float: "轻浮",
};

const THEME_LABEL: Record<ForumNoticeTheme, string> = {
  brand: "品牌色",
  amber: "醒目橙",
  red: "警示红",
  dark: "深色",
};

export function StudioForumSettings({
  initialConfig,
  initialNoticePreview,
}: Props) {
  const [allowMemberPost, setAllowMemberPost] = useState(
    initialConfig.allowMemberPost,
  );
  const [allowMemberComment, setAllowMemberComment] = useState(
    initialConfig.allowMemberComment,
  );
  const [allowMemberInteract, setAllowMemberInteract] = useState(
    initialConfig.allowMemberInteract,
  );
  const [allowMemberMessage, setAllowMemberMessage] = useState(
    initialConfig.allowMemberMessage,
  );
  const [enabled, setEnabled] = useState(initialConfig.notice.enabled);
  const [title, setTitle] = useState(initialConfig.notice.title);
  const [body, setBody] = useState(initialConfig.notice.body);
  const [href, setHref] = useState(initialConfig.notice.href);
  const [theme, setTheme] = useState<ForumNoticeTheme>(initialConfig.notice.theme);
  const [animation, setAnimation] = useState<ForumNoticeAnimation>(
    initialConfig.notice.animation,
  );
  const [media, setMedia] = useState<DraftMedia[]>(() =>
    initialConfig.notice.media.map((item, index) => ({
      id: `init-${index}`,
      kind: item.kind,
      url: item.url,
      previewUrl: initialNoticePreview.media[index]?.url || item.url,
      status: "done" as const,
    })),
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const uploading = media.some((item) => item.status === "uploading");
  const doneMedia = useMemo(
    () => media.filter((item) => item.status === "done" && item.url),
    [media],
  );

  const previewNotice = {
    enabled,
    title,
    body,
    href,
    theme,
    animation,
    media: doneMedia.map((item) => ({
      kind: item.kind,
      url: item.previewUrl || item.url,
    })),
  };

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setMessage("");
    const remaining = FORUM_NOTICE_MEDIA_MAX - media.length;
    if (remaining <= 0) {
      setMessage(`公告最多 ${FORUM_NOTICE_MEDIA_MAX} 张图片或视频`);
      return;
    }
    const picked = Array.from(fileList).slice(0, remaining);
    const drafts: DraftMedia[] = picked.map((file, index) => {
      const kind = classifyForumFile(file);
      return {
        id: `${Date.now()}-${index}-${file.name}`,
        kind: kind || "image",
        url: "",
        previewUrl: URL.createObjectURL(file),
        status: kind ? "uploading" : "error",
        error: kind ? undefined : "只支持图片、GIF 或视频",
      };
    });
    setMedia((prev) => [...prev, ...drafts]);
    for (let i = 0; i < picked.length; i++) {
      const draft = drafts[i];
      if (draft.status !== "uploading") continue;
      try {
        const uploaded = await uploadForumMediaFile(picked[i]);
        setMedia((prev) =>
          prev.map((item) =>
            item.id === draft.id
              ? {
                  ...item,
                  kind: uploaded.kind,
                  url: uploaded.url,
                  previewUrl: uploaded.previewUrl,
                  status: "done",
                }
              : item,
          ),
        );
      } catch (error) {
        const text = error instanceof Error ? error.message : "上传失败";
        setMedia((prev) =>
          prev.map((item) =>
            item.id === draft.id
              ? { ...item, status: "error", error: text }
              : item,
          ),
        );
      }
    }
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/studio/forum/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowMemberPost,
          allowMemberComment,
          allowMemberInteract,
          allowMemberMessage,
          notice: {
            enabled,
            title,
            body,
            href,
            theme,
            animation,
            media: doneMedia.map((item) => ({ kind: item.kind, url: item.url })),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "保存失败");
        return;
      }
      const next = data.config as ForumSiteConfig;
      setAllowMemberPost(next.allowMemberPost);
      setAllowMemberComment(next.allowMemberComment);
      setAllowMemberInteract(next.allowMemberInteract);
      setAllowMemberMessage(next.allowMemberMessage);
      setEnabled(next.notice.enabled);
      setTitle(next.notice.title);
      setBody(next.notice.body);
      setHref(next.notice.href);
      setTheme(next.notice.theme);
      setAnimation(next.notice.animation);
      const preview = data.noticePreview as ForumSiteConfig["notice"];
      setMedia(
        next.notice.media.map((item, index) => ({
          id: `saved-${index}`,
          kind: item.kind,
          url: item.url,
          previewUrl: preview.media[index]?.url || item.url,
          status: "done",
        })),
      );
      setMessage("已保存。站长自己发帖、评论、私信不受这些开关影响。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">其他用户功能开关</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          关闭后，普通用户不能发帖、评论、点赞收藏蹲后续或论坛私信。浏览帖子不受影响。你作为站长始终可以操作。
        </p>
        <ToggleRow
          checked={allowMemberPost}
          onChange={setAllowMemberPost}
          label="允许其他用户发帖"
          hint="关闭后仅站长能发帖"
        />
        <ToggleRow
          checked={allowMemberComment}
          onChange={setAllowMemberComment}
          label="允许其他用户评论"
          hint="关闭后仅站长能评论"
        />
        <ToggleRow
          checked={allowMemberInteract}
          onChange={setAllowMemberInteract}
          label="允许其他用户点赞 / 收藏 / 蹲后续"
          hint="分享复制链接仍可用"
        />
        <ToggleRow
          checked={allowMemberMessage}
          onChange={setAllowMemberMessage}
          label="允许其他用户论坛私信"
          hint="帖子页「私信作者」。关闭后仅站长能从论坛发起私信"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">顶部公告栏</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          显示在大学论坛各页最上方，比高校广告栏更醒目。可写文字，上传图片、GIF
          动图和视频；再选栏体动效（呼吸、滚动、扫光、轻浮）。
        </p>
        <ToggleRow
          checked={enabled}
          onChange={setEnabled}
          label="显示公告栏"
          hint="关闭后前台不展示，草稿仍会保存"
        />
        <label className="block text-sm">
          <span className="text-[var(--muted)]">标题</span>
          <input
            className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={FORUM_NOTICE_TITLE_MAX}
            placeholder="例如：本周校园活动"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">正文</span>
          <textarea
            className="mt-1 min-h-28 w-full rounded-2xl border border-[var(--line)] bg-transparent px-3 py-2"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={FORUM_NOTICE_BODY_MAX}
            placeholder="公告文字，可换行"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">点击跳转（可选）</span>
          <input
            className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            maxLength={500}
            placeholder="/forum 或 https://"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">配色</span>
            <select
              className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
              value={theme}
              onChange={(e) => setTheme(e.target.value as ForumNoticeTheme)}
            >
              {FORUM_NOTICE_THEMES.map((item) => (
                <option key={item} value={item}>
                  {THEME_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">栏体动画</span>
            <select
              className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
              value={animation}
              onChange={(e) =>
                setAnimation(e.target.value as ForumNoticeAnimation)
              }
            >
              {FORUM_NOTICE_ANIMATIONS.map((item) => (
                <option key={item} value={item}>
                  {ANIM_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <p className="text-sm text-[var(--muted)]">
            图片 / GIF / 视频（最多 {FORUM_NOTICE_MEDIA_MAX} 个）
          </p>
          <input
            className="mt-2 block w-full text-sm"
            type="file"
            accept="image/*,video/*,.gif"
            multiple
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {media.map((item) => (
              <div
                key={item.id}
                className="relative overflow-hidden rounded-2xl bg-[var(--line)]/30"
              >
                {item.kind === "video" ? (
                  <video
                    src={item.previewUrl}
                    className="h-24 w-full object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="h-24 w-full object-cover"
                  />
                )}
                {item.status === "uploading" ? (
                  <p className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1 text-xs text-white">
                    上传中…
                  </p>
                ) : null}
                {item.error ? (
                  <p className="absolute inset-x-0 bottom-0 bg-red-700/80 px-2 py-1 text-xs text-white">
                    {item.error}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="absolute right-1 top-1 min-h-11 min-w-11 rounded-full bg-black/60 text-xs text-white"
                  onClick={() =>
                    setMedia((prev) => prev.filter((row) => row.id !== item.id))
                  }
                >
                  删
                </button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm text-[var(--muted)]">预览</p>
          {previewNotice.title || previewNotice.body || previewNotice.media.length ? (
            <ForumNoticeBar notice={previewNotice} compact />
          ) : (
            <p className="rounded-[24px] border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              填写标题或上传媒体后在此预览
            </p>
          )}
        </div>
      </section>

      {message ? <p className="text-sm text-[var(--brand)]">{message}</p> : null}
      <button
        type="button"
        className="btn btn-primary min-h-11 px-6"
        disabled={busy || uploading}
        onClick={() => void save()}
      >
        {busy ? "保存中…" : "保存开关与公告"}
      </button>
    </div>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-[var(--line)] px-3 py-3">
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-[var(--muted)]">{hint}</span>
      </span>
    </label>
  );
}

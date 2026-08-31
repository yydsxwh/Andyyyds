"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ForumBroadcastPicker, type ForumBroadcastUniversityOption } from "@andyyyds/forum/components/forum-broadcast-picker";
import { ForumPlaceField } from "@andyyyds/forum/components/forum-place-field";
import {
  FORUM_BODY_MAX,
  FORUM_MEDIA_MAX,
  FORUM_TITLE_MAX,
  type ForumMediaKind,
} from "@andyyyds/forum/lib/forum";
import {
  classifyForumFile,
  uploadForumMediaFile,
} from "@andyyyds/forum/lib/forum-browser-upload";

type Zone = { id: string; name: string; enabled: boolean };

type DraftMedia = {
  id: string;
  kind: ForumMediaKind;
  previewUrl: string;
  url: string;
  status: "uploading" | "done" | "error";
  error?: string;
};

export type ForumComposerInitial = {
  id: string;
  zoneId: string;
  title: string;
  body: string;
  place: string;
  latitude: number | null;
  longitude: number | null;
  media: Array<{ kind: ForumMediaKind; url: string; previewUrl?: string }>;
  audience?: "PUBLIC" | "SCHOOL_VERIFIED";
};

type Props = {
  universityId: string;
  universitySlug: string;
  zones: Zone[];
  defaultZoneId?: string;
  initial?: ForumComposerInitial | null;
  cityHint?: string;
  /** 已通过该校实名认证（或站长）才能把帖子设为仅本校可见 */
  canSetSchoolOnly?: boolean;
  /** 站长可把同一篇同步发到其他高校；普通用户不传 */
  broadcastUniversities?: ForumBroadcastUniversityOption[];
  universityName?: string;
};

export function ForumComposer({
  universityId,
  universitySlug,
  zones,
  defaultZoneId,
  initial = null,
  cityHint = "",
  canSetSchoolOnly = false,
  broadcastUniversities = [],
  universityName = "",
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const enabledZones = zones.filter((z) => z.enabled);
  const [draftId, setDraftId] = useState(initial?.id || "");
  const [zoneId, setZoneId] = useState(
    initial?.zoneId || defaultZoneId || enabledZones[0]?.id || "",
  );
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");
  const [place, setPlace] = useState(initial?.place || "");
  const [latitude, setLatitude] = useState(
    initial?.latitude != null && Number.isFinite(initial.latitude)
      ? String(initial.latitude)
      : "",
  );
  const [longitude, setLongitude] = useState(
    initial?.longitude != null && Number.isFinite(initial.longitude)
      ? String(initial.longitude)
      : "",
  );
  const [media, setMedia] = useState<DraftMedia[]>(() =>
    (initial?.media || []).map((item, index) => ({
      id: `init-${index}`,
      kind: item.kind,
      url: item.url,
      previewUrl: item.previewUrl || item.url,
      status: "done" as const,
    })),
  );
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState("");
  const [schoolOnly, setSchoolOnly] = useState(
    initial?.audience === "SCHOOL_VERIFIED",
  );
  const [extraUniversityIds, setExtraUniversityIds] = useState<string[]>([]);
  const canBroadcast = broadcastUniversities.length > 1;

  const uploading = media.some((item) => item.status === "uploading");
  const doneMedia = useMemo(
    () => media.filter((item) => item.status === "done" && item.url),
    [media],
  );

  useEffect(() => {
    if (!draftId) return;
    const path = `/forum/${universitySlug}/new?draft=${encodeURIComponent(draftId)}`;
    window.history.replaceState(null, "", path);
  }, [draftId, universitySlug]);

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError("");
    const remaining = FORUM_MEDIA_MAX - media.length;
    if (remaining <= 0) {
      setError(`最多上传 ${FORUM_MEDIA_MAX} 张图片或视频`);
      return;
    }
    const picked = Array.from(fileList).slice(0, remaining);
    const drafts: DraftMedia[] = picked.map((file, index) => {
      const kind = classifyForumFile(file);
      return {
        id: `${Date.now()}-${index}-${file.name}`,
        kind: kind || "image",
        previewUrl: URL.createObjectURL(file),
        url: "",
        status: kind ? "uploading" : "error",
        error: kind ? undefined : "只支持图片或视频",
      };
    });
    setMedia((prev) => [...prev, ...drafts]);

    for (let i = 0; i < picked.length; i++) {
      const file = picked[i]!;
      const draft = drafts[i]!;
      if (draft.status === "error") continue;
      try {
        const uploaded = await uploadForumMediaFile(file);
        setMedia((prev) =>
          prev.map((item) =>
            item.id === draft.id
              ? {
                  ...item,
                  kind: uploaded.kind,
                  url: uploaded.url,
                  previewUrl: uploaded.previewUrl || item.previewUrl,
                  status: "done",
                }
              : item,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "上传失败";
        setMedia((prev) =>
          prev.map((item) =>
            item.id === draft.id
              ? { ...item, status: "error", error: message }
              : item,
          ),
        );
      }
    }
  }

  function removeMedia(id: string) {
    setMedia((prev) => prev.filter((item) => item.id !== id));
  }

  function payload(status: "DRAFT" | "PUBLISHED") {
    return {
      universityId,
      zoneId,
      title,
      body,
      place,
      latitude: latitude.trim() === "" ? null : Number(latitude),
      longitude: longitude.trim() === "" ? null : Number(longitude),
      media: doneMedia.map((item) => ({ kind: item.kind, url: item.url })),
      status,
      audience: schoolOnly && canSetSchoolOnly ? "SCHOOL_VERIFIED" : "PUBLIC",
      ...(status === "PUBLISHED" && canBroadcast
        ? { syncUniversityIds: extraUniversityIds }
        : {}),
    };
  }

  async function save(status: "DRAFT" | "PUBLISHED") {
    if (uploading) return;
    if (status === "PUBLISHED" && !body.trim() && doneMedia.length === 0) {
      setError("请填写文字，或上传图片/视频");
      return;
    }
    const publishCount = 1 + extraUniversityIds.length;
    if (
      status === "PUBLISHED" &&
      canBroadcast &&
      publishCount > 1 &&
      !window.confirm(
        `将同步发布到 ${publishCount} 所高校？每所学校各有一份独立帖，之后改其中一份不会改其他学校。`,
      )
    ) {
      return;
    }
    setBusy(status);
    setError("");
    setHint("");
    try {
      const res = await fetch(
        draftId ? `/api/forum/posts/${draftId}` : "/api/forum/posts",
        {
          method: draftId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload(status)),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (status === "DRAFT" ? "保存失败" : "发布失败"));
        return;
      }
      const id = String(data.post?.id || draftId);
      if (status === "PUBLISHED" && Array.isArray(data.skipped) && data.skipped.length > 0) {
        const names = data.skipped
          .map((row: { name?: string }) => row.name)
          .filter(Boolean)
          .join("、");
        window.alert(`本校已发布。未能同步：${names || "部分高校"}`);
      }
      if (status === "DRAFT") {
        setDraftId(id);
        setHint("已保存到草稿箱。下次在本分区点「发帖」可继续编辑。");
        router.refresh();
        return;
      }
      router.push(`/forum/${universitySlug}/p/${id}`);
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save("PUBLISHED");
      }}
    >
      <label className="block text-sm">
        <span className="text-[var(--muted)]">专区</span>
        <select
          className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
          value={zoneId}
          onChange={(e) => setZoneId(e.target.value)}
          required
        >
          {enabledZones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">标题</span>
        <input
          className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={FORUM_TITLE_MAX}
          placeholder="没有图片或视频时，标题会当作封面"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">正文</span>
        <textarea
          className="mt-1 min-h-40 w-full rounded-2xl border border-[var(--line)] bg-transparent px-3 py-3"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={FORUM_BODY_MAX}
          placeholder="分享日常、美食、选课、二手…"
        />
        <span className="mt-1 block text-xs text-[var(--muted)]">
          {body.length}/{FORUM_BODY_MAX}
        </span>
      </label>

      <ForumPlaceField
        place={place}
        latitude={latitude}
        longitude={longitude}
        onPlace={setPlace}
        onLatitude={setLatitude}
        onLongitude={setLongitude}
        onMessage={setError}
        cityHint={cityHint}
      />

      <div>
        <p className="text-sm text-[var(--muted)]">
          图片 / 视频（最多 {FORUM_MEDIA_MAX} 个）
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {media.map((item) => (
            <div
              key={item.id}
              className="relative aspect-square overflow-hidden rounded-2xl bg-[var(--line)]/30"
            >
              {item.kind === "video" ? (
                <video
                  src={item.previewUrl}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.previewUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
              {item.status === "uploading" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
                  上传中
                </div>
              ) : null}
              {item.status === "error" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 px-1 text-center text-[10px] text-white">
                  {item.error || "失败"}
                </div>
              ) : null}
              {item.kind === "video" ? (
                <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                  视频
                </span>
              ) : null}
              <button
                type="button"
                className="absolute right-1 top-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/55 text-sm text-white"
                onClick={() => removeMedia(item.id)}
                aria-label="移除"
              >
                ×
              </button>
            </div>
          ))}
          {media.length < FORUM_MEDIA_MAX ? (
            <button
              type="button"
              className="flex aspect-square min-h-11 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)] text-sm text-[var(--muted)]"
              onClick={() => fileRef.current?.click()}
            >
              <span>添加</span>
              <span className="mt-1 text-xs">
                {media.length}/{FORUM_MEDIA_MAX}
              </span>
            </button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept="image/*,video/*,.mp4,.mov,.webm,.jpg,.jpeg,.png,.webp,.gif"
          multiple
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {canBroadcast ? (
        <ForumBroadcastPicker
          currentId={universityId}
          currentName={universityName}
          universities={broadcastUniversities}
          extraIds={extraUniversityIds}
          onExtraIds={setExtraUniversityIds}
          schoolOnly={schoolOnly && canSetSchoolOnly}
        />
      ) : null}

      <label className="flex min-h-11 items-start gap-3 rounded-2xl border border-[var(--line)] px-3 py-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5"
          checked={schoolOnly && canSetSchoolOnly}
          disabled={!canSetSchoolOnly}
          onChange={(e) => setSchoolOnly(e.target.checked)}
        />
        <span className="text-sm leading-6">
          <span className="block font-medium">仅本校认证用户可见</span>
          <span className="block text-[var(--muted)]">
            {canSetSchoolOnly
              ? "未认证该校的人看不到这篇帖子。公开浏览区仍显示你的公开帖。"
              : "完成该校实名认证后才能使用。"}
          </span>
        </span>
      </label>

      {error ? <p className="text-sm text-[var(--brand)]">{error}</p> : null}
      {hint ? <p className="text-sm text-[var(--muted)]">{hint}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          className="btn btn-secondary min-h-11 w-full sm:w-auto sm:px-8"
          type="button"
          disabled={Boolean(busy) || uploading || !zoneId}
          onClick={() => void save("DRAFT")}
        >
          {busy === "DRAFT" ? "保存中…" : "保存草稿"}
        </button>
        <button
          className="btn btn-primary min-h-11 w-full sm:w-auto sm:px-8"
          type="submit"
          disabled={Boolean(busy) || uploading || !zoneId}
        >
          {busy === "PUBLISHED"
            ? "发布中…"
            : uploading
              ? "等待上传完成…"
              : canBroadcast && extraUniversityIds.length > 0
                ? `同步发布到 ${1 + extraUniversityIds.length} 所`
                : "发布"}
        </button>
      </div>
    </form>
  );
}

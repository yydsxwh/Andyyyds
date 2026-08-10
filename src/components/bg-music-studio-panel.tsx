"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FREE_STOCK_GUIDES,
  coerceBgMusicTrackKind,
  parseNeteaseSongId,
  parseQqmusicSongId,
  type BgMusicConfig,
  type BgMusicSource,
  type BgMusicTrack,
} from "@/lib/bg-music";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";

type JamendoHit = {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  coverUrl: string;
  credit: string;
};

type Props = {
  initialConfig: BgMusicConfig;
  initialJamendoClientId: string;
  jamendoConfigured: boolean;
};

const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";

function newId() {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function BgMusicStudioPanel({
  initialConfig,
  initialJamendoClientId,
  jamendoConfigured: jamendoConfiguredInitial,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<BgMusicConfig>(initialConfig);
  const [jamendoClientId, setJamendoClientId] = useState(
    initialJamendoClientId,
  );
  const [jamendoConfigured, setJamendoConfigured] = useState(
    jamendoConfiguredInitial,
  );
  const [status, setStatus] = useState<SaveStatus>(null);
  const [hint, setHint] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [urlTitle, setUrlTitle] = useState("");
  const [urlArtist, setUrlArtist] = useState("");
  const [urlSrc, setUrlSrc] = useState("");

  const [neteaseInput, setNeteaseInput] = useState("");
  const [neteaseTitle, setNeteaseTitle] = useState("");
  const [qqInput, setQqInput] = useState("");
  const [qqTitle, setQqTitle] = useState("");

  const [jamendoQ, setJamendoQ] = useState("ambient");
  const [jamendoHits, setJamendoHits] = useState<JamendoHit[]>([]);
  const [jamendoBusy, setJamendoBusy] = useState(false);

  function addTrack(partial: Omit<BgMusicTrack, "id" | "enabled"> & {
    id?: string;
    enabled?: boolean;
  }) {
    const track: BgMusicTrack = {
      id: partial.id || newId(),
      title: partial.title,
      artist: partial.artist || "",
      kind: partial.kind,
      src: partial.src,
      coverUrl: partial.coverUrl,
      credit: partial.credit,
      source: partial.source,
      enabled: partial.enabled !== false,
    };
    setConfig((c) => ({ ...c, tracks: [...c.tracks, track] }));
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    setHint("");
    const res = await postSave("/api/studio/bg-music", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: config.enabled,
        loopPlaylist: config.loopPlaylist,
        defaultOpen: config.defaultOpen,
        autoplay: config.autoplay,
        tracks: config.tracks,
        jamendoClientId,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setStatus({ kind: "error", text: res.error || "保存失败" });
      return;
    }
    const data = res.data as {
      config?: BgMusicConfig;
      jamendoClientId?: string;
      jamendoConfigured?: boolean;
    };
    if (data.config) setConfig(data.config);
    if (typeof data.jamendoClientId === "string") {
      setJamendoClientId(data.jamendoClientId);
    }
    if (typeof data.jamendoConfigured === "boolean") {
      setJamendoConfigured(data.jamendoConfigured);
    }
    setStatus({ kind: "ok", text: "已保存" });
    router.refresh();
  }

  async function onUploadFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setHint("");
    setStatus(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/studio/bg-music/upload", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as {
        error?: string;
        url?: string;
        previewUrl?: string;
      };
      if (!res.ok || !data.url) {
        setStatus({ kind: "error", text: data.error || "上传失败" });
        return;
      }
      const title =
        file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "背景音乐";
      addTrack({
        title,
        artist: "",
        kind: "audio",
        src: data.previewUrl || data.url,
        source: "upload" satisfies BgMusicSource,
      });
      setHint(`已加入歌单：${title}（记得点保存）`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addUrlTrack() {
    const title = urlTitle.trim();
    const src = urlSrc.trim();
    if (!title || !src) {
      setStatus({ kind: "error", text: "请填写曲名与音频地址" });
      return;
    }
    // 误把网易云/QQ 歌曲页贴进直链时，自动改成官方外链 kind
    const coerced = coerceBgMusicTrackKind("audio", src);
    addTrack({
      title,
      artist: urlArtist.trim(),
      kind: coerced.kind,
      src: coerced.src,
      source: coerced.source || "url",
    });
    setUrlTitle("");
    setUrlArtist("");
    setUrlSrc("");
    setStatus(null);
    setHint(
      coerced.kind === "audio"
        ? "已加入歌单（记得点保存）"
        : `已识别为${coerced.kind === "netease" ? "网易云" : "QQ音乐"}外链（记得点保存）。iPhone 微信更稳妥请上传 MP3。`,
    );
  }

  function addNetease() {
    const id = parseNeteaseSongId(neteaseInput);
    if (!id) {
      setStatus({
        kind: "error",
        text: "请粘贴网易云歌曲链接或数字 id",
      });
      return;
    }
    const title = neteaseTitle.trim() || `网易云 ${id}`;
    addTrack({
      title,
      artist: "",
      kind: "netease",
      src: id,
      source: "netease",
    });
    setNeteaseInput("");
    setNeteaseTitle("");
    setStatus(null);
    setHint("已加入网易云外链（记得点保存）");
  }

  function addQqmusic() {
    const id = parseQqmusicSongId(qqInput);
    if (!id) {
      setStatus({
        kind: "error",
        text: "请粘贴含 songid=数字 的 QQ 音乐链接（PC 分享），或纯数字 songid；仅 songmid 的链接无法识别",
      });
      return;
    }
    const title = qqTitle.trim() || `QQ音乐 ${id}`;
    addTrack({
      title,
      artist: "",
      kind: "qqmusic",
      src: id,
      source: "qqmusic",
    });
    setQqInput("");
    setQqTitle("");
    setStatus(null);
    setHint("已加入 QQ 音乐外链（记得点保存）");
  }

  async function searchJamendo() {
    setJamendoBusy(true);
    setHint("");
    setStatus(null);
    try {
      const res = await fetch(
        `/api/studio/bg-music/jamendo?q=${encodeURIComponent(jamendoQ.trim())}`,
      );
      const data = (await res.json()) as {
        error?: string;
        tracks?: JamendoHit[];
      };
      if (!res.ok) {
        setStatus({ kind: "error", text: data.error || "搜索失败" });
        setJamendoHits([]);
        return;
      }
      setJamendoHits(data.tracks || []);
    } finally {
      setJamendoBusy(false);
    }
  }

  function moveTrack(index: number, delta: number) {
    setConfig((c) => {
      const next = [...c.tracks];
      const j = index + delta;
      if (j < 0 || j >= next.length) return c;
      const tmp = next[index]!;
      next[index] = next[j]!;
      next[j] = tmp;
      return { ...c, tracks: next };
    });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-3xl border border-[var(--line)] bg-white/70 p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-[var(--ink)]">播放器开关</h2>
        <p className="text-sm text-[var(--muted)]">
          QQ 空间风格悬浮播放器。无法合法免费接入三大平台全曲库；本页用免版税曲库
          + 自建上传 + 网易云 / QQ 音乐官方外链补齐。
        </p>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--brand)]"
            checked={config.enabled}
            onChange={(e) =>
              setConfig((c) => ({ ...c, enabled: e.target.checked }))
            }
          />
          <span>
            <span className="font-medium">启用前台悬浮背景音乐</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              关闭后前台不显示播放器
            </span>
          </span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--brand)]"
            checked={config.autoplay}
            onChange={(e) =>
              setConfig((c) => ({ ...c, autoplay: e.target.checked }))
            }
          />
          <span>
            <span className="font-medium">进入站点自动播放</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              浏览器与微信常拦截「无手势带声自动播」。拦截时会等访客首次点击页面再续播；网易云 / QQ 外链另受其自身策略限制。
            </span>
          </span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--brand)]"
            checked={config.loopPlaylist}
            onChange={(e) =>
              setConfig((c) => ({ ...c, loopPlaylist: e.target.checked }))
            }
          />
          <span className="font-medium">整份歌单循环</span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--brand)]"
            checked={config.defaultOpen}
            onChange={(e) =>
              setConfig((c) => ({ ...c, defaultOpen: e.target.checked }))
            }
          />
          <span>
            <span className="font-medium">默认展开播放列表面板（已停用）</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              为避免微信白屏，前台始终先显示悬浮球；外链 iframe 仅在展开时加载。登录/注册页不显示播放器。
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-3 rounded-3xl border border-[var(--line)] bg-white/70 p-4 sm:p-5">
        <h2 className="text-lg font-semibold">C · 免版税曲库</h2>
        <ul className="space-y-2 text-sm text-[var(--muted)]">
          {FREE_STOCK_GUIDES.map((g) => (
            <li
              key={g.id}
              className="flex flex-col gap-1 rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-medium text-[var(--ink)]">{g.title}</div>
                <div className="text-xs">{g.hint}</div>
              </div>
              <a
                href={g.browseUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--line)] px-3 text-sm text-[var(--brand)] sm:mt-0"
              >
                打开曲库
              </a>
            </li>
          ))}
        </ul>

        <div className="space-y-2 border-t border-[var(--line)] pt-4">
          <h3 className="text-sm font-medium">Jamendo 检索并加入</h3>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Jamendo Client ID</span>
            <input
              className={`${inputClass} mt-1`}
              value={jamendoClientId}
              onChange={(e) => setJamendoClientId(e.target.value)}
              placeholder="在 developer.jamendo.com 免费申请"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              {jamendoConfigured
                ? "已配置；改完请点下方「保存全部」。"
                : "未配置时只能上传 / 直链 / 网易云 / QQ 音乐外链。"}
            </p>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={inputClass}
              value={jamendoQ}
              onChange={(e) => setJamendoQ(e.target.value)}
              placeholder="搜索：chill / piano / summer…"
            />
            <button
              type="button"
              disabled={jamendoBusy}
              onClick={() => void searchJamendo()}
              className="min-h-11 shrink-0 rounded-2xl bg-[var(--brand)] px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              {jamendoBusy ? "搜索中…" : "搜索"}
            </button>
          </div>
          {jamendoHits.length > 0 ? (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {jamendoHits.map((hit) => (
                <li
                  key={hit.id}
                  className="flex flex-col gap-2 rounded-2xl border border-[var(--line)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 text-sm">
                    <div className="truncate font-medium">{hit.title}</div>
                    <div className="truncate text-xs text-[var(--muted)]">
                      {hit.artist}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="min-h-10 rounded-xl border border-[var(--line)] px-3 text-sm"
                    onClick={() =>
                      addTrack({
                        title: hit.title,
                        artist: hit.artist,
                        kind: "audio",
                        src: hit.audioUrl,
                        coverUrl: hit.coverUrl || undefined,
                        credit: hit.credit,
                        source: "stock",
                      })
                    }
                  >
                    加入歌单
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border border-[var(--line)] bg-white/70 p-4 sm:p-5">
        <h2 className="text-lg font-semibold">
          D · 上传 / 直链 / 网易云 / QQ 音乐外链
        </h2>
        <div className="space-y-2">
          <h3 className="text-sm font-medium">上传音频到本站</h3>
          <input
            ref={fileRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/aac,audio/mp4,.mp3,.wav,.m4a,.aac,.ogg"
            className="block w-full text-sm"
            disabled={uploading}
            onChange={(e) => void onUploadFile(e.target.files?.[0] || null)}
          />
          <p className="text-xs text-[var(--muted)]">
            建议从 Pixabay / Mixkit 下载后上传；最大 20MB。
          </p>
        </div>

        <div className="space-y-2 border-t border-[var(--line)] pt-4">
          <h3 className="text-sm font-medium">音频直链</h3>
          <input
            className={inputClass}
            placeholder="曲名"
            value={urlTitle}
            onChange={(e) => setUrlTitle(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="歌手（可选）"
            value={urlArtist}
            onChange={(e) => setUrlArtist(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="https://…/song.mp3"
            value={urlSrc}
            onChange={(e) => setUrlSrc(e.target.value)}
          />
          <button
            type="button"
            onClick={addUrlTrack}
            className="min-h-11 rounded-2xl border border-[var(--line)] px-4 text-sm"
          >
            加入歌单
          </button>
        </div>

        <div className="space-y-2 border-t border-[var(--line)] pt-4">
          <h3 className="text-sm font-medium">网易云官方外链</h3>
          <p className="text-xs text-[var(--muted)]">
            粘贴歌曲页链接或数字 id；前台用官方 iframe 播放（非全曲库检索）。
          </p>
          <input
            className={inputClass}
            placeholder="显示名称（可选）"
            value={neteaseTitle}
            onChange={(e) => setNeteaseTitle(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="https://music.163.com/#/song?id=… 或纯数字 id"
            value={neteaseInput}
            onChange={(e) => setNeteaseInput(e.target.value)}
          />
          <button
            type="button"
            onClick={addNetease}
            className="min-h-11 rounded-2xl border border-[var(--line)] px-4 text-sm"
          >
            加入歌单
          </button>
        </div>

        <div className="space-y-2 border-t border-[var(--line)] pt-4">
          <h3 className="text-sm font-medium">QQ 音乐官方外链</h3>
          <p className="text-xs text-[var(--muted)]">
            需数字 songid：PC 网页打开歌曲 → 分享 → 复制链接（含
            songid=…）。仅有 songmid 的短链无法加入。前台用官方 iframe
            播放。
          </p>
          <input
            className={inputClass}
            placeholder="显示名称（可选）"
            value={qqTitle}
            onChange={(e) => setQqTitle(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="https://i.y.qq.com/…?songid=127570280 或纯数字 songid"
            value={qqInput}
            onChange={(e) => setQqInput(e.target.value)}
          />
          <button
            type="button"
            onClick={addQqmusic}
            className="min-h-11 rounded-2xl border border-[var(--line)] px-4 text-sm"
          >
            加入歌单
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border border-[var(--line)] bg-white/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            当前歌单（{config.tracks.length}）
          </h2>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="min-h-11 rounded-2xl bg-[var(--brand)] px-5 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "保存中…" : "保存全部"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SaveFeedback status={status} />
          {hint ? (
            <span className="text-sm text-[var(--muted)]">{hint}</span>
          ) : null}
        </div>
        {config.tracks.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">还没有曲目，请先添加。</p>
        ) : (
          <ul className="space-y-2">
            {config.tracks.map((t, index) => (
              <li
                key={t.id}
                className="rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      className={inputClass}
                      value={t.title}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          tracks: c.tracks.map((x) =>
                            x.id === t.id
                              ? { ...x, title: e.target.value }
                              : x,
                          ),
                        }))
                      }
                    />
                    <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                      <span className="rounded-lg bg-[var(--line)]/40 px-2 py-1">
                        {t.source}
                      </span>
                      <span className="rounded-lg bg-[var(--line)]/40 px-2 py-1">
                        {t.kind}
                      </span>
                      {t.artist ? <span>{t.artist}</span> : null}
                      {t.credit ? <span>{t.credit}</span> : null}
                    </div>
                    <label className="flex min-h-10 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--brand)]"
                        checked={t.enabled}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            tracks: c.tracks.map((x) =>
                              x.id === t.id
                                ? { ...x, enabled: e.target.checked }
                                : x,
                            ),
                          }))
                        }
                      />
                      前台启用
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="min-h-10 rounded-xl border border-[var(--line)] px-3 text-sm"
                      onClick={() => moveTrack(index, -1)}
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      className="min-h-10 rounded-xl border border-[var(--line)] px-3 text-sm"
                      onClick={() => moveTrack(index, 1)}
                    >
                      下移
                    </button>
                    <button
                      type="button"
                      className="min-h-10 rounded-xl border border-red-200 px-3 text-sm text-red-700"
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          tracks: c.tracks.filter((x) => x.id !== t.id),
                        }))
                      }
                    >
                      删除
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

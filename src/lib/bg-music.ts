/**
 * 全站背景音乐歌单（QQ 空间风格）。
 * 来源：upload/url 自建、stock（Jamendo）、netease/qqmusic（官方外链 iframe）。
 */

export type BgMusicKind = "audio" | "netease" | "qqmusic";

export type BgMusicSource =
  | "upload"
  | "url"
  | "stock"
  | "netease"
  | "qqmusic";

export type BgMusicTrack = {
  id: string;
  title: string;
  artist: string;
  kind: BgMusicKind;
  /** audio: 可播放 URL；netease/qqmusic: 平台歌曲数字 id */
  src: string;
  coverUrl?: string;
  /** 免费曲库署名（Jamendo / Mixkit 等） */
  credit?: string;
  source: BgMusicSource;
  enabled: boolean;
};

export type BgMusicConfig = {
  /** 前台是否展示悬浮播放器 */
  enabled: boolean;
  /** 循环整份歌单 */
  loopPlaylist: boolean;
  /** 默认展开播放器面板 */
  defaultOpen: boolean;
  /**
   * 进入站点时尝试自动播放。
   * 浏览器/微信常拦截「无手势带声自动播」；失败时等访客首次点击页面再续播。
   */
  autoplay: boolean;
  tracks: BgMusicTrack[];
};

export const DEFAULT_BG_MUSIC: BgMusicConfig = {
  enabled: false,
  loopPlaylist: true,
  defaultOpen: false,
  autoplay: false,
  tracks: [],
};

/** Pixabay / Mixkit 等：无稳定热链时引导站长下载后上传 */
export type FreeStockGuide = {
  id: string;
  title: string;
  hint: string;
  browseUrl: string;
};

export const FREE_STOCK_GUIDES: FreeStockGuide[] = [
  {
    id: "pixabay",
    title: "Pixabay 免版税音乐",
    hint: "下载 MP3 后在下方「上传音频」加入歌单（不可热链）",
    browseUrl: "https://pixabay.com/music/",
  },
  {
    id: "mixkit",
    title: "Mixkit 免版税音乐",
    hint: "下载后上传到本站；可用于网站背景音乐",
    browseUrl: "https://mixkit.co/free-stock-music/",
  },
  {
    id: "jamendo",
    title: "Jamendo（可 API 检索）",
    hint: "在系统设置填入免费 Client ID 后，可在本页直接搜索并加入",
    browseUrl: "https://developer.jamendo.com/",
  },
];

export function parseBgMusic(raw: string | null | undefined): BgMusicConfig {
  if (!raw?.trim()) return { ...DEFAULT_BG_MUSIC, tracks: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<BgMusicConfig>;
    const tracks = Array.isArray(parsed.tracks)
      ? parsed.tracks
          .map(normalizeTrack)
          .filter((t): t is BgMusicTrack => Boolean(t))
      : [];
    return {
      enabled: Boolean(parsed.enabled),
      loopPlaylist: parsed.loopPlaylist !== false,
      defaultOpen: Boolean(parsed.defaultOpen),
      autoplay: Boolean(parsed.autoplay),
      tracks,
    };
  } catch {
    return { ...DEFAULT_BG_MUSIC, tracks: [] };
  }
}

export function stringifyBgMusic(config: BgMusicConfig): string {
  return JSON.stringify({
    enabled: Boolean(config.enabled),
    loopPlaylist: config.loopPlaylist !== false,
    defaultOpen: Boolean(config.defaultOpen),
    autoplay: Boolean(config.autoplay),
    tracks: config.tracks.map(normalizeTrack).filter(Boolean),
  });
}

/**
 * 把误填成「音频直链」的网易云 / QQ 歌曲页纠正为外链 kind，
 * 避免 iOS 微信里 <audio> 去播一个 HTML 页面导致完全无声。
 */
export function coerceBgMusicTrackKind(
  kind: BgMusicKind,
  src: string,
): { kind: BgMusicKind; src: string; source?: BgMusicSource } {
  if (kind === "audio") {
    const neteaseId = parseNeteaseSongId(src);
    if (neteaseId && /163\.com|music\.163/i.test(src)) {
      return { kind: "netease", src: neteaseId, source: "netease" };
    }
    // 纯数字且来源已标 netease 时在 normalize 里处理；此处只认明确网易域名
    const qqId = parseQqmusicSongId(src);
    if (qqId && /y\.qq\.com|qq\.com/i.test(src)) {
      return { kind: "qqmusic", src: qqId, source: "qqmusic" };
    }
  }
  if (kind === "netease") {
    const id = parseNeteaseSongId(src);
    if (id) return { kind: "netease", src: id };
  }
  if (kind === "qqmusic") {
    const id = parseQqmusicSongId(src);
    if (id) return { kind: "qqmusic", src: id };
  }
  return { kind, src };
}

function normalizeTrack(raw: unknown): BgMusicTrack | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Partial<BgMusicTrack>;
  const title = String(t.title || "").trim().slice(0, 120);
  let src = String(t.src || "").trim().slice(0, 2000);
  if (!title || !src) return null;
  let kind: BgMusicKind =
    t.kind === "netease"
      ? "netease"
      : t.kind === "qqmusic"
        ? "qqmusic"
        : "audio";
  const coerced = coerceBgMusicTrackKind(kind, src);
  kind = coerced.kind;
  src = coerced.src;
  const source: BgMusicSource =
    coerced.source ||
    (t.source === "upload" ||
    t.source === "url" ||
    t.source === "stock" ||
    t.source === "netease" ||
    t.source === "qqmusic"
      ? t.source
      : kind === "netease"
        ? "netease"
        : kind === "qqmusic"
          ? "qqmusic"
          : "url");
  return {
    id: String(t.id || "").trim() || `t_${Math.random().toString(36).slice(2, 10)}`,
    title,
    artist: String(t.artist || "").trim().slice(0, 80),
    kind,
    src,
    coverUrl: String(t.coverUrl || "").trim().slice(0, 2000) || undefined,
    credit: String(t.credit || "").trim().slice(0, 200) || undefined,
    source,
    enabled: t.enabled !== false,
  };
}

/** 前台只取启用且有源的曲目 */
export function activeBgMusicTracks(config: BgMusicConfig): BgMusicTrack[] {
  if (!config.enabled) return [];
  return config.tracks.filter((t) => t.enabled && t.src);
}

export function neteaseEmbedSrc(songId: string, autoplay = false): string {
  const id = songId.replace(/\D/g, "");
  const auto = autoplay ? "1" : "0";
  return `https://music.163.com/outchain/player?type=2&id=${id}&auto=${auto}&height=66`;
}

/** QQ 音乐官方外链迷你播放器（需数字 songid，非 songmid） */
export function qqmusicEmbedSrc(songId: string): string {
  const id = songId.replace(/\D/g, "");
  return `https://i.y.qq.com/n2/m/outchain/player/index.html?songid=${id}&songtype=0`;
}

/** 从网易云分享链接或纯数字提取歌曲 id */
export function parseNeteaseSongId(input: string): string | null {
  const s = input.trim();
  if (/^\d{5,}$/.test(s)) return s;
  const m =
    /music\.163\.com\/(?:#\/)?song\?id=(\d+)/i.exec(s) ||
    /[?&]id=(\d+)/i.exec(s) ||
    /outchain\/player\?[^#]*[?&]id=(\d+)/i.exec(s);
  return m?.[1] || null;
}

/**
 * 从 QQ 音乐分享链接 / 外链 / 纯数字提取 songid。
 * 仅含 songmid（如 songDetail/0041nxUx…）的链接无法解析，需 PC 分享得到 songid。
 */
export function parseQqmusicSongId(input: string): string | null {
  const s = input.trim();
  if (/^\d{5,}$/.test(s)) return s;
  const m =
    /[?&#]songid=(\d+)/i.exec(s) ||
    /outchain\/player\/index\.html\?[^#]*songid=(\d+)/i.exec(s) ||
    /playsong\.html\?[^#]*songid=(\d+)/i.exec(s);
  return m?.[1] || null;
}

/** 是否为 iframe 外链曲目（不用本站 <audio>） */
export function isEmbedBgMusicKind(
  kind: BgMusicKind,
): kind is "netease" | "qqmusic" {
  return kind === "netease" || kind === "qqmusic";
}

import { redirect } from "next/navigation";
import { BgMusicStudioPanel } from "@/components/bg-music-studio-panel";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { parseBgMusic } from "@/lib/bg-music";
import { isAdmin } from "@/lib/roles";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function StudioBgMusicPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.role)) redirect("/studio");

  const row = await getSiteSettings();
  const config = parseBgMusic(row.bgMusicJson);

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="bg-music" area="admin" />
      <div>
        <h1 className="text-3xl font-semibold">背景音乐</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          预置歌单 + 访客点击播放（类似 QQ
          空间）。支持免版税曲库、本站上传、音频直链与网易云官方外链。
        </p>
      </div>
      <BgMusicStudioPanel
        initialConfig={config}
        initialJamendoClientId={row.jamendoClientId || ""}
        jamendoConfigured={Boolean(row.jamendoClientId?.trim())}
      />
    </div>
  );
}

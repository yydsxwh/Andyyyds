import { StudioPersonSocialPanel } from "@andyyyds/person/components/studio-person-social-panel";

export default function PersonAdminSocialPage() {
  return (
    <div className="grid gap-3">
      <p className="text-sm text-[var(--muted)]">
        这里沿用原来的自媒体同步。主页链接填好后，前台「自媒体」会展示合集和投稿。
      </p>
      <StudioPersonSocialPanel />
    </div>
  );
}

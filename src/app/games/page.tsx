import { ComingSoon } from "@/components/coming-soon";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";

export const metadata = {
  title: "游戏中心",
};

export default function GamesPage() {
  return (
    <NavPageTemplateShell type="games">
      <ComingSoon
        title="游戏中心"
        description="休闲与学习向游戏入口正在规划中，稍后与你见面。"
      />
    </NavPageTemplateShell>
  );
}
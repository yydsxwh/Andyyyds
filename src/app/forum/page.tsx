import { ComingSoon } from "@/components/coming-soon";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";

export const metadata = {
  title: "大学论坛",
};

export default function ForumPage() {
  return (
    <NavPageTemplateShell type="forum">
      <ComingSoon
        title="大学论坛"
        description="各大学分区讨论与交流同学即将上线，敬请期待。"
      />
    </NavPageTemplateShell>
  );
}

import { MarketingComingSoonView } from "@/components/marketing-coming-soon";

export const dynamic = "force-dynamic";

export default function StudioVipPage() {
  return (
    <MarketingComingSoonView
      title="VIP会员"
      navKey="vip"
      blurb="会员等级、专属价与权益包将在此配置。"
    />
  );
}

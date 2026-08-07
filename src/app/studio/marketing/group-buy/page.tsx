import { MarketingComingSoonView } from "@/components/marketing-coming-soon";

export const dynamic = "force-dynamic";

export default function StudioGroupBuyPage() {
  return (
    <MarketingComingSoonView
      title="拼团"
      navKey="group-buy"
      blurb="多人成团享优惠价，适合拉新与裂变。"
    />
  );
}

import { redirect } from "next/navigation";
import { StudioNav } from "@/components/studio-nav";
import { StudioPersonSocialPanel } from "@andyyyds/person/components/studio-person-social-panel";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

/** 站长：B站 / 抖音 / 小红书投稿 → 个人介绍 */
export default async function StudioPersonSocialPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) redirect("/studio");

  return (
    <div className="container space-y-6 py-10 sm:py-12">
      <StudioNav current="person-social" area="admin" />
      <div>
        <h1 className="text-2xl font-semibold">个人IP投稿</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          同步自己的抖音、B站、小红书、微信视频号投稿和合集，展示在前台「个人介绍」。用法和公众号宣传类似。
        </p>
      </div>
      <StudioPersonSocialPanel />
    </div>
  );
}

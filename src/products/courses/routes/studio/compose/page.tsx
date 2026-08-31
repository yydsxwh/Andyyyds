import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** 旧入口：跳转到课程中心内的「创建课程/资料」 */
export default async function StudioComposeRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ assets?: string }>;
}) {
  const params = await searchParams;
  const qs = params.assets
    ? `?assets=${encodeURIComponent(params.assets)}`
    : "";
  redirect(`/studio/courses/compose${qs}`);
}
